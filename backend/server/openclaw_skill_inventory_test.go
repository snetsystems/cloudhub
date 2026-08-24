package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/openclaw"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

// The skill list is CloudHub's own record of what it published. This handler
// is the Gateway's answer to the same question, which is what makes a stale or
// hand-edited workspace visible.

func getInventory(agents *fakeOrgAgentStore, publisher openClawSkillPublisher) *httptest.ResponseRecorder {
	service := &Service{
		Store:                  &mocks.Store{OpenClawOrgAgentStore: agents},
		OpenClawSkillPublisher: publisher,
		Logger:                 &mocks.TestLogger{},
	}

	request := httptest.NewRequest(http.MethodGet, "/cloudhub/v2/openclaw/skill-inventory", nil)
	ctx := request.Context()
	ctx = context.WithValue(ctx, organizations.ContextKey, "org-1")
	ctx = context.WithValue(ctx, UserContextKey, &cloudhub.User{ID: 9, Name: "admin"})

	recorder := httptest.NewRecorder()
	service.OpenClawSkillInventory(recorder, request.WithContext(ctx))
	return recorder
}

func decodeInventory(t *testing.T, recorder *httptest.ResponseRecorder) (string, []map[string]interface{}) {
	t.Helper()
	var got struct {
		AgentID string                   `json:"agentId"`
		Skills  []map[string]interface{} `json:"skills"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v; body = %s", err, recorder.Body)
	}
	return got.AgentID, got.Skills
}

// Only workspace skills belong to an organization. An agent also carries the
// skills OpenClaw ships with, which CloudHub neither published nor manages.
func TestOpenClawSkillInventoryReturnsOnlyWorkspaceSkills(t *testing.T) {
	agents := &fakeOrgAgentStore{agentID: "agent-exec"}
	publisher := &stubPublisher{inventory: []openclaw.SkillInventoryEntry{
		{Name: "github", Source: "openclaw-bundled", Raw: json.RawMessage(`{"name":"github"}`)},
		{
			Name:   "cpu-report",
			Source: openclaw.WorkspaceSource,
			Raw:    json.RawMessage(`{"name":"cpu-report","eligible":true,"modelVisible":true}`),
		},
	}}

	recorder := getInventory(agents, publisher)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", recorder.Code, recorder.Body)
	}
	agentID, skills := decodeInventory(t, recorder)
	if agentID != "agent-exec" {
		t.Fatalf("agentId = %q", agentID)
	}
	if len(skills) != 1 || skills[0]["name"] != "cpu-report" {
		t.Fatalf("skills = %+v, want only the workspace one", skills)
	}
	// Gateway-defined fields must survive the round trip untouched.
	if skills[0]["eligible"] != true || skills[0]["modelVisible"] != true {
		t.Fatalf("gateway fields were dropped: %+v", skills[0])
	}
	if publisher.inventoryFor[0] != "agent-exec" {
		t.Fatalf("inventory read for %q, want the organization's execution agent", publisher.inventoryFor[0])
	}
	if agents.purposes[0] != cloudhub.OpenClawAgentExecution || agents.orgIDs[0] != "org-1" {
		t.Fatalf("mapping looked up as %q/%q", agents.orgIDs[0], agents.purposes[0])
	}
}

// A status view must not provision an agent. An organization that has
// published nothing simply has nothing to report.
func TestOpenClawSkillInventoryReportsNothingWhenNoAgentIsMapped(t *testing.T) {
	agents := &fakeOrgAgentStore{err: cloudhub.ErrOpenClawAgentNotMapped}
	publisher := &stubPublisher{}

	recorder := getInventory(agents, publisher)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", recorder.Code, recorder.Body)
	}
	agentID, skills := decodeInventory(t, recorder)
	if agentID != "" || len(skills) != 0 {
		t.Fatalf("agentId = %q, skills = %+v", agentID, skills)
	}
	if len(publisher.inventoryFor) != 0 {
		t.Fatal("the Gateway was called even though no agent is mapped")
	}
}

// The Gateway being down is reported as such, so the caller can tell "no
// skills" apart from "could not ask".
func TestOpenClawSkillInventoryReportsAGatewayFailure(t *testing.T) {
	recorder := getInventory(
		&fakeOrgAgentStore{agentID: "agent-exec"},
		&stubPublisher{inventoryErr: errors.New("gateway down")},
	)
	if recorder.Code == http.StatusOK {
		t.Fatalf("status = %d, want a failure", recorder.Code)
	}
}

func TestOpenClawSkillInventoryRequiresAnOrganization(t *testing.T) {
	service := &Service{
		Store:                  &mocks.Store{OpenClawOrgAgentStore: &fakeOrgAgentStore{}},
		OpenClawSkillPublisher: &stubPublisher{},
		Logger:                 &mocks.TestLogger{},
	}
	request := httptest.NewRequest(http.MethodGet, "/cloudhub/v2/openclaw/skill-inventory", nil)
	recorder := httptest.NewRecorder()
	service.OpenClawSkillInventory(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", recorder.Code)
	}
}

// Without a Gateway there is nothing to ask, and saying so is different from
// reporting an empty inventory.
func TestOpenClawSkillInventoryReportsAMissingGateway(t *testing.T) {
	service := &Service{
		Store:  &mocks.Store{OpenClawOrgAgentStore: &fakeOrgAgentStore{agentID: "agent-exec"}},
		Logger: &mocks.TestLogger{},
	}
	request := httptest.NewRequest(http.MethodGet, "/cloudhub/v2/openclaw/skill-inventory", nil)
	ctx := context.WithValue(request.Context(), organizations.ContextKey, "org-1")
	ctx = context.WithValue(ctx, UserContextKey, &cloudhub.User{ID: 9, Name: "admin"})

	recorder := httptest.NewRecorder()
	service.OpenClawSkillInventory(recorder, request.WithContext(ctx))

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", recorder.Code)
	}
}
