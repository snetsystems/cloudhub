package server

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

// LocalMockTemplatesManager implements cloudhub.TemplatesManager for local testing
type LocalMockTemplatesManager struct {
	AllF func(context.Context) ([]cloudhub.ConfigTemplate, error)
	GetF func(context.Context, string) (cloudhub.ConfigTemplate, error)
}

func (m *LocalMockTemplatesManager) All(ctx context.Context) ([]cloudhub.ConfigTemplate, error) {
	if m.AllF != nil {
		return m.AllF(ctx)
	}
	return nil, nil
}

func (m *LocalMockTemplatesManager) Get(ctx context.Context, id string) (cloudhub.ConfigTemplate, error) {
	if m.GetF != nil {
		return m.GetF(ctx, id)
	}
	return cloudhub.ConfigTemplate{}, nil
}

// LocalMockLogger for testing
type LocalMockLogger struct{}

func (m *LocalMockLogger) Debug(args ...interface{})                               { fmt.Println("DEBUG:", args) }
func (m *LocalMockLogger) Info(args ...interface{})                                { fmt.Println("INFO:", args) }
func (m *LocalMockLogger) Error(args ...interface{})                               { fmt.Println("ERROR:", args) }
func (m *LocalMockLogger) WithField(key string, value interface{}) cloudhub.Logger { return m }
func (m *LocalMockLogger) Writer() *io.PipeWriter                                  { return nil }

func TestGetCollectorConfig_Sharding(t *testing.T) {
	// Create 1000 devices spread across two orgs
	org1ID := "org1"
	org2ID := "org2"
	totalDevices := 1000
	var allDeviceIDs []string

	for i := 0; i < totalDevices; i++ {
		devID := fmt.Sprintf("dev-%04d", i)
		allDeviceIDs = append(allDeviceIDs, devID)
	}
	sort.Strings(allDeviceIDs)

	org1Devices := allDeviceIDs[:600]
	org2Devices := allDeviceIDs[600:]

	mockDeviceStore := &mocks.NetworkDeviceStore{
		GetF: func(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
			id := *q.ID
			org := org1ID
			if id >= "dev-0600" {
				org = org2ID
			}
			return &cloudhub.NetworkDevice{
				ID:           id,
				Organization: org,
				DeviceIP:     "10.0.0.1",
				SNMPConfig: cloudhub.SNMPConfig{
					Version:   "2c",
					Community: "public",
					Port:      161,
					Protocol:  "UDP",
				},
			}, nil
		},
	}

	mockOrgStore := &mocks.OrganizationsStore{
		GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
			id := *q.ID
			return &cloudhub.Organization{ID: id, Name: "Org-" + id}, nil
		},
	}

	mockDeviceOrgStore := &mocks.NetworkDeviceOrgStore{
		AllF: func(ctx context.Context) ([]cloudhub.NetworkDeviceOrg, error) {
			return []cloudhub.NetworkDeviceOrg{
				{ID: org1ID, CollectedDevicesIDs: org1Devices},
				{ID: org2ID, CollectedDevicesIDs: org2Devices},
			}, nil
		},
	}

	// We need generic mocks.Store that holds these
	mockStore := &mocks.Store{
		NetworkDeviceStore:    mockDeviceStore,
		OrganizationsStore:    mockOrgStore,
		NetworkDeviceOrgStore: mockDeviceOrgStore,
		SourcesStore: &mocks.SourcesStore{
			GetF: func(ctx context.Context, id int) (cloudhub.Source, error) {
				if id > 0 {
					return cloudhub.Source{}, fmt.Errorf("no more sources")
				}
				return cloudhub.Source{ID: 1, Name: "Influx1", URL: "http://influx:8086"}, nil
			},
		},
	}

	mockTemplatesManager := &LocalMockTemplatesManager{
		GetF: func(ctx context.Context, id string) (cloudhub.ConfigTemplate, error) {
			return cloudhub.ConfigTemplate{
				Template: `{{define "input"}}input { snmp { hosts => [{{.DeviceHostsV1AndV2}}] } }{{end}}{{define "filter_ouput"}}{{.DeviceFilter}}{{end}}{{define "snmp_v3_input"}}{{end}}{{define "comment"}}{{end}}`,
			}, nil
		},
	}

	mockLogger := &LocalMockLogger{}

	s := &Service{
		Store: mockStore,
		InternalENV: cloudhub.InternalEnvironment{
			TemplatesManager: mockTemplatesManager,
			Platform: &mocks.MockPlatform{},
		},
		Logger: mockLogger, // Use our mock logger
	}

	router := httprouter.New()
	router.GET("/api/v1/collectors/config/:shardID", s.GetCollectorConfig)

	// --- Test Case 1: Shard 0 (0-499) ---
	req := httptest.NewRequest("GET", "/api/v1/collectors/config/shard-0", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Shard 0: expected 200, got %d", rr.Code)
	}
	body := rr.Body.String()
	if !strings.Contains(body, "dev-0000") {
		t.Errorf("Shard 0: expected body to contain dev-0000")
	}
	if !strings.Contains(body, "dev-0499") {
		t.Errorf("Shard 0: expected body to contain dev-0499")
	}
	if strings.Contains(body, "dev-0500") {
		t.Errorf("Shard 0: expected body NOT to contain dev-0500")
	}

	etag := rr.Header().Get("ETag")
	if etag == "" {
		t.Errorf("Shard 0: expected ETag header")
	}

	// --- Test Case 2: Shard 1 (500-999) ---
	req2 := httptest.NewRequest("GET", "/api/v1/collectors/config/shard-1", nil)
	rr2 := httptest.NewRecorder()
	router.ServeHTTP(rr2, req2)

	if rr2.Code != http.StatusOK {
		t.Errorf("Shard 1: expected 200, got %d", rr2.Code)
	}
	body2 := rr2.Body.String()
	if strings.Contains(body2, "dev-0499") {
		t.Errorf("Shard 1: expected body NOT to contain dev-0499")
	}
	if !strings.Contains(body2, "dev-0500") {
		t.Errorf("Shard 1: expected body to contain dev-0500")
	}
	if !strings.Contains(body2, "dev-0999") {
		t.Errorf("Shard 1: expected body to contain dev-0999")
	}
	if strings.Contains(body2, "dev-1000") {
		t.Errorf("Shard 1: expected body NOT to contain dev-1000")
	}

	// --- Test Case 3: ETag 304 ---
	req3 := httptest.NewRequest("GET", "/api/v1/collectors/config/shard-0", nil)
	req3.Header.Set("If-None-Match", etag)
	rr3 := httptest.NewRecorder()
	router.ServeHTTP(rr3, req3)

	if rr3.Code != http.StatusNotModified {
		t.Errorf("ETag: expected 304, got %d", rr3.Code)
	}
	if rr3.Body.String() != "" {
		t.Errorf("ETag: expected empty body check 304, got %s", rr3.Body.String())
	}
}

func TestGetCollectorConfig_EmptyDevices(t *testing.T) {
	mockDeviceOrgStore := &mocks.NetworkDeviceOrgStore{
		AllF: func(ctx context.Context) ([]cloudhub.NetworkDeviceOrg, error) {
			return nil, fmt.Errorf("no Network Device found")
		},
	}

	mockStore := &mocks.Store{
		NetworkDeviceOrgStore: mockDeviceOrgStore,
	}

	mockLogger := &LocalMockLogger{}

	s := &Service{
		Store: mockStore,
		InternalENV: cloudhub.InternalEnvironment{
			Platform: &mocks.MockPlatform{},
		},
		Logger: mockLogger,
	}

	router := httprouter.New()
	router.GET("/api/v1/collectors/config/:shardID", s.GetCollectorConfig)

	req := httptest.NewRequest("GET", "/api/v1/collectors/config/shard-0", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("EmptyDevices: expected 200 OK (handled error), got %d. Body: %s", rr.Code, rr.Body.String())
	}

	// ETag should be present even for empty config
	etag := rr.Header().Get("ETag")
	if etag == "" {
		t.Errorf("EmptyDevices: expected ETag header")
	}

	// Test 304 for empty config
	req2 := httptest.NewRequest("GET", "/api/v1/collectors/config/shard-0", nil)
	req2.Header.Set("If-None-Match", etag)
	rr2 := httptest.NewRecorder()
	router.ServeHTTP(rr2, req2)

	if rr2.Code != http.StatusNotModified {
		t.Errorf("EmptyDevices: expected 304 Not Modified, got %d", rr2.Code)
	}
}
