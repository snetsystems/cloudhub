package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bouk/httprouter"
	"github.com/snetsystems/cloudhub/backend/hubble"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

func emptyHubbleManager() *hubble.Manager {
	return hubble.NewManager(hubble.ManagerConfig{}, &mocks.TestLogger{})
}

func TestHubbleClustersHandler_NoManager(t *testing.T) {
	s := &Service{Logger: &mocks.TestLogger{}}

	req := httptest.NewRequest("GET", "/cloudhub/v1/hubble/clusters", nil)
	rr := httptest.NewRecorder()
	s.HubbleClustersHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rr.Code)
	}
	var resp hubbleClustersResponse
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Clusters) != 0 {
		t.Fatalf("clusters = %v, want empty when manager is nil", resp.Clusters)
	}
}

func TestHubbleSnapshotHandler_NoManager(t *testing.T) {
	s := &Service{Logger: &mocks.TestLogger{}}

	req := httptest.NewRequest("GET", "/cloudhub/v1/hubble/clusters/foo/snapshot", nil)
	req = req.WithContext(
		httprouter.WithParams(req.Context(), httprouter.Params{{Key: "name", Value: "foo"}}),
	)
	rr := httptest.NewRecorder()
	s.HubbleOverviewSnapshotHandler(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rr.Code)
	}
}

func TestHubbleSnapshotHandler_UnknownCluster(t *testing.T) {
	// Construct a service with an empty manager so lookup returns nil.
	s := &Service{
		Logger:        &mocks.TestLogger{},
		HubbleManager: emptyHubbleManager(),
	}

	req := httptest.NewRequest("GET", "/cloudhub/v1/hubble/clusters/missing/snapshot", nil)
	req = req.WithContext(
		httprouter.WithParams(req.Context(), httprouter.Params{{Key: "name", Value: "missing"}}),
	)
	rr := httptest.NewRecorder()
	s.HubbleOverviewSnapshotHandler(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rr.Code)
	}
}

func TestHubbleWSPushInterval_UsesConfiguredInterval(t *testing.T) {
	s := &Service{HubbleSnapshotInterval: 5 * time.Second}

	if got := s.hubbleWSPushInterval(); got != 5*time.Second {
		t.Fatalf("hubbleWSPushInterval = %s, want 5s", got)
	}
}

func TestHubbleWSPushInterval_DefaultsWhenUnset(t *testing.T) {
	s := &Service{}

	if got := s.hubbleWSPushInterval(); got != defaultHubbleWSPushInterval {
		t.Fatalf("hubbleWSPushInterval = %s, want %s", got, defaultHubbleWSPushInterval)
	}
}

func TestFilterHubbleFlowsByNamespace_IncludesEitherEndpoint(t *testing.T) {
	flows := []hubble.FlowRecord{
		{SrcNamespace: "demo", DstNamespace: "other", SrcPod: "a"},
		{SrcNamespace: "other", DstNamespace: "demo", SrcPod: "b"},
		{SrcNamespace: "other", DstNamespace: "other", SrcPod: "c"},
	}

	got := filterHubbleFlowsByNamespace(flows, "demo")
	if len(got) != 2 {
		t.Fatalf("len(filtered) = %d, want 2", len(got))
	}
	if got[0].SrcPod != "a" || got[1].SrcPod != "b" {
		t.Fatalf("filtered = %+v, want source/destination namespace matches only", got)
	}
}

func TestLimitHubbleFlows_AppliesAfterNamespaceFilter(t *testing.T) {
	flows := []hubble.FlowRecord{
		{SrcNamespace: "demo", SrcPod: "a"},
		{DstNamespace: "demo", SrcPod: "b"},
		{SrcNamespace: "demo", SrcPod: "c"},
	}

	got := limitHubbleFlows(filterHubbleFlowsByNamespace(flows, "demo"), 2)
	if len(got) != 2 {
		t.Fatalf("len(limited) = %d, want 2", len(got))
	}
	if got[0].SrcPod != "a" || got[1].SrcPod != "b" {
		t.Fatalf("limited = %+v, want newest order preserved", got)
	}
}

func TestFilterHubbleFlows_AppliesQueryFields(t *testing.T) {
	flows := []hubble.FlowRecord{
		{
			SrcNamespace: "demo", DstNamespace: "payments",
			SrcWorkload: "frontend", DstWorkload: "api",
			SrcPod: "frontend-1", DstPod: "api-1",
			Verdict: "DROPPED", DropReason: "Policy denied",
			Protocol: "TCP", DstPort: 8080, L7: "HTTP GET /checkout -> 403",
		},
		{
			SrcNamespace: "demo", DstNamespace: "payments",
			SrcWorkload: "frontend", DstWorkload: "redis",
			Verdict: "FORWARDED", Protocol: "TCP", DstPort: 6379,
		},
		{
			SrcNamespace: "demo", DstNamespace: "",
			SrcWorkload: "worker", DstWorkload: "Unknown Workload",
			DstID: "ext:fqdn:api.example.com", DstIP: "203.0.113.10",
			Verdict: "FORWARDED", Protocol: "TCP", DstPort: 443,
			L7: "HTTP GET /v1/orders -> 200",
		},
	}

	filter := hubbleFlowFilter{
		Namespace:   "demo",
		SrcWorkload: "front",
		DstWorkload: "api",
		Verdicts:    map[string]struct{}{"DROPPED": {}},
		DropReason:  "policy",
		Protocol:    "tcp",
		Port:        8080,
		L7Type:      "http",
		L7Query:     "checkout",
		Query:       "frontend-1",
	}

	got := filterHubbleFlows(flows, filter)
	if len(got) != 1 {
		t.Fatalf("len(filtered) = %d, want 1: %+v", len(got), got)
	}
	if got[0].DstWorkload != "api" {
		t.Fatalf("filtered = %+v, want api flow", got)
	}
}

func TestFilterHubbleFlows_ExternalOnlyMatchesExternalEndpoint(t *testing.T) {
	flows := []hubble.FlowRecord{
		{SrcID: "wl:demo/frontend", DstID: "wl:demo/api", SrcNamespace: "demo", DstNamespace: "demo", DstIP: "10.0.0.1"},
		{SrcID: "wl:demo/frontend", DstID: "ext:fqdn:api.example.com", DstIP: "203.0.113.10"},
		{SrcID: "ext:unknown", DstID: "wl:demo/frontend", SrcIP: "198.51.100.2"},
	}

	got := filterHubbleFlows(flows, hubbleFlowFilter{ExternalOnly: true})
	if len(got) != 2 {
		t.Fatalf("len(filtered) = %d, want 2: %+v", len(got), got)
	}
	if got[0].DstID != "ext:fqdn:api.example.com" || got[1].SrcID != "ext:unknown" {
		t.Fatalf("filtered = %+v, want flows touching external endpoints", got)
	}
}
