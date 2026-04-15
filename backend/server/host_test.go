package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/log"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

func TestIsPrivateIP(t *testing.T) {
	tests := []struct {
		ip   string
		want bool
	}{
		{"10.0.0.1", true},
		{"10.255.255.255", true},
		{"172.16.0.1", true},
		{"172.31.255.255", true},
		{"192.168.1.1", true},
		{"192.168.0.0", true},
		// not private
		{"172.15.0.1", false},
		{"172.32.0.1", false},
		{"8.8.8.8", false},
		{"127.0.0.1", false},
		{"not-an-ip", false},
	}
	for _, tc := range tests {
		got := isPrivateIP(tc.ip)
		if got != tc.want {
			t.Errorf("isPrivateIP(%q) = %v, want %v", tc.ip, got, tc.want)
		}
	}
}

func TestToHostResponse_FilterPrivateIPs(t *testing.T) {
	h := cloudhub.Host{
		ID:       "host-1",
		MinionID: "minion-001",
		Hostname: "server-01",
		IPInterfaces: []cloudhub.IPInterface{
			{InterfaceName: "eth0", IPAddress: "192.168.1.10"},
			{InterfaceName: "lo", IPAddress: "127.0.0.1"},
			{InterfaceName: "eth1", IPAddress: "8.8.8.8"},
			{InterfaceName: "eth2", IPAddress: "10.0.0.5"},
		},
		OS:         "linux",
		OSVersion:  "20.04",
		Arch:       "amd64",
		MemTotalKB: 16384000,
		CPUCores:   8,
		SourceType: "salt",
		OrgID:      "",
		CreatedAt:  time.Now(),
	}

	resp := toHostResponse(h)

	// Only private IPs: 192.168.1.10 and 10.0.0.5
	if len(resp.PrivateIPs) != 2 {
		t.Fatalf("expected 2 private IPs, got %d: %v", len(resp.PrivateIPs), resp.PrivateIPs)
	}

	privateSet := map[string]bool{}
	for _, ip := range resp.PrivateIPs {
		privateSet[ip] = true
	}
	if !privateSet["192.168.1.10"] {
		t.Error("expected 192.168.1.10 in privateIps")
	}
	if !privateSet["10.0.0.5"] {
		t.Error("expected 10.0.0.5 in privateIps")
	}

	// Other fields pass through
	if resp.ID != "host-1" || resp.MinionID != "minion-001" || resp.Hostname != "server-01" {
		t.Errorf("unexpected basic fields: %+v", resp)
	}
	if resp.Links.Self != "/cloudhub/v2/hosts/server-01" {
		t.Errorf("unexpected links: %+v", resp.Links)
	}
}

// --- mock HostStore for handler tests ---

type mockHostStore struct {
	AddFn    func(ctx context.Context, h *cloudhub.Host) (*cloudhub.Host, error)
	GetFn    func(ctx context.Context, q cloudhub.HostQuery) (*cloudhub.Host, error)
	AllFn    func(ctx context.Context) ([]cloudhub.Host, error)
	UpdateFn func(ctx context.Context, h *cloudhub.Host) (*cloudhub.Host, error)
	PatchFn  func(ctx context.Context, hostname string, patch cloudhub.HostPatch) (*cloudhub.Host, error)
	DeleteFn func(ctx context.Context, hostname string) error
}

func (m *mockHostStore) Add(ctx context.Context, h *cloudhub.Host) (*cloudhub.Host, error) {
	return m.AddFn(ctx, h)
}
func (m *mockHostStore) Get(ctx context.Context, q cloudhub.HostQuery) (*cloudhub.Host, error) {
	return m.GetFn(ctx, q)
}
func (m *mockHostStore) All(ctx context.Context) ([]cloudhub.Host, error) {
	return m.AllFn(ctx)
}
func (m *mockHostStore) Update(ctx context.Context, h *cloudhub.Host) (*cloudhub.Host, error) {
	return m.UpdateFn(ctx, h)
}
func (m *mockHostStore) Patch(ctx context.Context, hostname string, patch cloudhub.HostPatch) (*cloudhub.Host, error) {
	return m.PatchFn(ctx, hostname, patch)
}
func (m *mockHostStore) Delete(ctx context.Context, hostname string) error {
	return m.DeleteFn(ctx, hostname)
}

func newServiceWithHostStore(hs cloudhub.HostStore) *Service {
	store := &mocks.Store{HostStore: hs}
	return &Service{
		Store:  store,
		Logger: log.New(log.DebugLevel),
	}
}

func TestPatchHost_Success(t *testing.T) {
	status := "rejected"
	updated := &cloudhub.Host{
		ID:       "host-1",
		MinionID: "minion-001",
		Hostname: "server-01",
		Status:   "rejected",
	}

	svc := newServiceWithHostStore(&mockHostStore{
		PatchFn: func(_ context.Context, hostname string, patch cloudhub.HostPatch) (*cloudhub.Host, error) {
			if hostname != "server-01" {
				t.Errorf("unexpected hostname: %s", hostname)
			}
			if patch.Status == nil || *patch.Status != "rejected" {
				t.Errorf("unexpected patch status: %v", patch.Status)
			}
			return updated, nil
		},
	})

	body, _ := json.Marshal(map[string]string{"status": status})
	req := httptest.NewRequest(http.MethodPatch, "/cloudhub/v2/hosts/server-01", bytes.NewReader(body))
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{
		{Key: "hostname", Value: "server-01"},
	}))
	rr := httptest.NewRecorder()

	svc.PatchHost(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp hostResponse
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Status != "rejected" {
		t.Errorf("expected status=rejected, got %q", resp.Status)
	}
}

func TestPatchHost_NotFound(t *testing.T) {
	svc := newServiceWithHostStore(&mockHostStore{
		PatchFn: func(_ context.Context, _ string, _ cloudhub.HostPatch) (*cloudhub.Host, error) {
			return nil, cloudhub.ErrHostNotFound
		},
	})

	body, _ := json.Marshal(map[string]string{"status": "rejected"})
	req := httptest.NewRequest(http.MethodPatch, "/cloudhub/v2/hosts/ghost", bytes.NewReader(body))
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{
		{Key: "hostname", Value: "ghost"},
	}))
	rr := httptest.NewRecorder()

	svc.PatchHost(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rr.Code)
	}
}

func TestPatchHost_InvalidStatus(t *testing.T) {
	svc := newServiceWithHostStore(&mockHostStore{})

	body, _ := json.Marshal(map[string]string{"status": "unknown"})
	req := httptest.NewRequest(http.MethodPatch, "/cloudhub/v2/hosts/server-01", bytes.NewReader(body))
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{
		{Key: "hostname", Value: "server-01"},
	}))
	rr := httptest.NewRecorder()

	svc.PatchHost(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected 422, got %d", rr.Code)
	}
}

func TestUpdateHost_NotFound(t *testing.T) {
	svc := newServiceWithHostStore(&mockHostStore{
		GetFn: func(_ context.Context, _ cloudhub.HostQuery) (*cloudhub.Host, error) {
			return nil, cloudhub.ErrHostNotFound
		},
		UpdateFn: func(_ context.Context, _ *cloudhub.Host) (*cloudhub.Host, error) {
			return nil, cloudhub.ErrHostNotFound
		},
	})

	body, _ := json.Marshal(map[string]interface{}{
		"hostname": "new-host",
		"status":   "accepted",
	})
	req := httptest.NewRequest(http.MethodPut, "/cloudhub/v2/hosts/server-01", bytes.NewReader(body))
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{
		{Key: "hostname", Value: "server-01"},
	}))
	rr := httptest.NewRecorder()

	svc.UpdateHost(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rr.Code)
	}
}

func TestRegisterHost_MissingHostname(t *testing.T) {
	svc := newServiceWithHostStore(&mockHostStore{})

	body, _ := json.Marshal(map[string]string{"minionId": "minion-001"})
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/hosts", bytes.NewReader(body))
	rr := httptest.NewRecorder()

	svc.RegisterHost(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected 422, got %d", rr.Code)
	}
}

func TestBulkUpsertHosts_AllCreate(t *testing.T) {
	seen := make(map[string]*cloudhub.Host)
	svc := newServiceWithHostStore(&mockHostStore{
		GetFn: func(_ context.Context, q cloudhub.HostQuery) (*cloudhub.Host, error) {
			if q.Hostname == nil {
				return nil, fmt.Errorf("hostname required")
			}
			if h, ok := seen[*q.Hostname]; ok {
				return h, nil
			}
			return nil, cloudhub.ErrHostNotFound
		},
		AddFn: func(_ context.Context, h *cloudhub.Host) (*cloudhub.Host, error) {
			cp := *h
			cp.ID = h.Hostname + "-id"
			seen[h.Hostname] = &cp
			return &cp, nil
		},
		UpdateFn: func(_ context.Context, h *cloudhub.Host) (*cloudhub.Host, error) {
			cp := *h
			seen[h.Hostname] = &cp
			return &cp, nil
		},
	})

	body, _ := json.Marshal(bulkUpsertHostsRequest{Hosts: []hostRequest{
		{Hostname: "host-a", MinionID: "host-a", Status: "accepted"},
		{Hostname: "host-b", MinionID: "host-b", Status: "accepted"},
	}})
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v1/hosts/bulk-upsert", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	svc.BulkUpsertHosts(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp bulkUpsertHostsResponse
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Created) != 2 || len(resp.Updated) != 0 || len(resp.Failed) != 0 {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestBulkUpsertHosts_UpdatePreservesIsCollector(t *testing.T) {
	seen := map[string]*cloudhub.Host{
		"host-a": {
			ID:          "id-a",
			Hostname:    "host-a",
			MinionID:    "host-a",
			IsCollector: true,
			OrgID:       "org-1",
			Status:      "accepted",
		},
	}
	var updated *cloudhub.Host
	svc := newServiceWithHostStore(&mockHostStore{
		GetFn: func(_ context.Context, q cloudhub.HostQuery) (*cloudhub.Host, error) {
			return seen[*q.Hostname], nil
		},
		AddFn: func(_ context.Context, h *cloudhub.Host) (*cloudhub.Host, error) {
			t.Fatal("Add should not be called")
			return nil, nil
		},
		UpdateFn: func(_ context.Context, h *cloudhub.Host) (*cloudhub.Host, error) {
			updated = h
			cp := *h
			return &cp, nil
		},
	})

	body, _ := json.Marshal(bulkUpsertHostsRequest{Hosts: []hostRequest{
		{Hostname: "host-a", MinionID: "host-a", OS: "Linux", Status: "accepted", IsCollector: false},
	}})
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v1/hosts/bulk-upsert", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	svc.BulkUpsertHosts(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	if updated == nil || !updated.IsCollector {
		t.Fatalf("IsCollector should be preserved from existing row, got %+v", updated)
	}
	if updated.OrgID != "org-1" {
		t.Fatalf("OrgID should be preserved, got %q", updated.OrgID)
	}
}

func TestBulkUpsertHosts_EmptyHosts_Returns400(t *testing.T) {
	svc := newServiceWithHostStore(&mockHostStore{})
	body, _ := json.Marshal(bulkUpsertHostsRequest{Hosts: []hostRequest{}})
	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v1/hosts/bulk-upsert", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	svc.BulkUpsertHosts(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}
