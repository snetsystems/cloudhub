package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/openclaw"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

// A baseline skill is copied into the agent's workspace as files and has no
// CloudHub record, so the Gateway is the only place its content exists. This
// handler is how it is read.

func getWorkspaceSkill(agents *fakeOrgAgentStore, publisher openClawSkillPublisher, name string) *httptest.ResponseRecorder {
	service := &Service{
		Store:                  &mocks.Store{OpenClawOrgAgentStore: agents},
		OpenClawSkillPublisher: publisher,
		Logger:                 &mocks.TestLogger{},
	}

	request := httptest.NewRequest(http.MethodGet, "/cloudhub/v2/openclaw/skill-inventory/"+name, nil)
	ctx := request.Context()
	ctx = context.WithValue(ctx, organizations.ContextKey, "org-1")
	ctx = context.WithValue(ctx, UserContextKey, &cloudhub.User{ID: 9, Name: "admin"})
	ctx = httprouter.WithParams(ctx, httprouter.Params{{Key: "name", Value: name}})

	recorder := httptest.NewRecorder()
	service.OpenClawSkillInventoryFiles(recorder, request.WithContext(ctx))
	return recorder
}

// The whole point is showing what a skill says, support files included.
func TestWorkspaceSkillReturnsTheFilesTheAgentHolds(t *testing.T) {
	agents := &fakeOrgAgentStore{agentID: "org-1-execution"}
	publisher := &stubPublisher{workspaceFiles: []openclaw.SkillFile{
		{Path: "SKILL.md", Content: "# cpu"},
		{Path: "references/limits.md", Content: "limits"},
	}}

	recorder := getWorkspaceSkill(agents, publisher, "cpu-report")
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d; body = %s", recorder.Code, recorder.Body)
	}

	var got struct {
		AgentID string `json:"agentId"`
		Name    string `json:"name"`
		Files   []struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		} `json:"files"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v; body = %s", err, recorder.Body)
	}
	if got.AgentID != "org-1-execution" || got.Name != "cpu-report" {
		t.Fatalf("agentId = %q name = %q", got.AgentID, got.Name)
	}
	if len(got.Files) != 2 || got.Files[1].Path != "references/limits.md" || got.Files[1].Content != "limits" {
		t.Fatalf("files = %+v", got.Files)
	}
	if len(publisher.workspaceFor) != 1 || publisher.workspaceFor[0] != "org-1-execution/cpu-report" {
		t.Fatalf("read %v, want the organization's execution agent", publisher.workspaceFor)
	}
}

// Reading a skill must not provision an agent. Looking at something is not a
// reason to create a workspace.
func TestWorkspaceSkillDoesNotProvisionAnAgent(t *testing.T) {
	agents := &fakeOrgAgentStore{err: cloudhub.ErrOpenClawAgentNotMapped}
	publisher := &stubPublisher{}

	recorder := getWorkspaceSkill(agents, publisher, "cpu-report")
	if recorder.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409; body = %s", recorder.Code, recorder.Body)
	}
	if len(publisher.workspaceFor) != 0 {
		t.Fatalf("asked the Gateway for %v despite no mapping", publisher.workspaceFor)
	}
}

// The organization is read from the request context, never from the caller, so
// one organization cannot read another's workspace.
func TestWorkspaceSkillReadsTheCallersOwnAgent(t *testing.T) {
	agents := &fakeOrgAgentStore{agentID: "org-1-execution"}
	getWorkspaceSkill(agents, &stubPublisher{workspaceFiles: []openclaw.SkillFile{{Path: "SKILL.md"}}}, "cpu-report")

	if len(agents.orgIDs) != 1 || agents.orgIDs[0] != "org-1" {
		t.Fatalf("looked up %v, want the context organization", agents.orgIDs)
	}
	if len(agents.purposes) != 1 || agents.purposes[0] != cloudhub.OpenClawAgentExecution {
		t.Fatalf("purposes = %v, want execution", agents.purposes)
	}
}

// A name the agent does not hold is the Gateway's answer, not a CloudHub
// error, and it must not read as an empty skill.
func TestWorkspaceSkillReportsAGatewayFailure(t *testing.T) {
	agents := &fakeOrgAgentStore{agentID: "org-1-execution"}
	publisher := &stubPublisher{workspaceErr: errors.New("holds no skill named \"nope\"")}

	recorder := getWorkspaceSkill(agents, publisher, "nope")
	if recorder.Code == http.StatusOK {
		t.Fatalf("status = 200, want a failure; body = %s", recorder.Body)
	}
}
