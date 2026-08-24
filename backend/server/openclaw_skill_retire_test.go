package server

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

// The retirement handler is the one place a destructive Gateway-side action is
// triggered from an HTTP request, so it is tested end to end through the
// handler rather than through its parts.

// fakeSkillStore records what the handler asked of the store and returns
// whatever the test set up.
type fakeSkillStore struct {
	cloudhub.OpenClawSkillStore

	skill     *cloudhub.OpenClawSkill
	getErr    error
	getOrgIDs []string
	getIDs    []string
	delErr    error
	deleted   []string
	delOrg    []string
}

func (s *fakeSkillStore) Get(_ context.Context, organizationID, id string) (*cloudhub.OpenClawSkill, error) {
	s.getOrgIDs = append(s.getOrgIDs, organizationID)
	s.getIDs = append(s.getIDs, id)
	if s.getErr != nil {
		return nil, s.getErr
	}
	return s.skill, nil
}

func (s *fakeSkillStore) Delete(_ context.Context, organizationID, id string) error {
	s.delOrg = append(s.delOrg, organizationID)
	s.deleted = append(s.deleted, id)
	return s.delErr
}

// fakeOrgAgentStore resolves the agent whose workspace holds the skill.
type fakeOrgAgentStore struct {
	cloudhub.OpenClawOrgAgentStore

	agentID  string
	err      error
	purposes []string
	orgIDs   []string
}

func (s *fakeOrgAgentStore) Get(_ context.Context, organizationID, purpose string) (string, error) {
	s.orgIDs = append(s.orgIDs, organizationID)
	s.purposes = append(s.purposes, purpose)
	if s.err != nil {
		return "", s.err
	}
	return s.agentID, nil
}

// stubDeleter stands in for the skill-admin MCP client.
type stubDeleter struct {
	agents            []string
	skills            []string
	workspacesDeleted []string
	err               error
	workspaceErr      error
	failWorkspace     string // only this agent's workspace delete fails
}

func (d *stubDeleter) DeleteWorkspace(_ context.Context, agentID string) error {
	d.workspacesDeleted = append(d.workspacesDeleted, agentID)
	if d.failWorkspace != "" {
		if agentID == d.failWorkspace {
			return errors.New("skill-admin refused")
		}
		return nil
	}
	return d.workspaceErr
}

func (d *stubDeleter) Delete(_ context.Context, agentID, skillName string) error {
	d.agents = append(d.agents, agentID)
	d.skills = append(d.skills, skillName)
	return d.err
}

type retireHarness struct {
	service *Service
	skills  *fakeSkillStore
	agents  *fakeOrgAgentStore
	deleter *stubDeleter
}

// newRetireHarness wires a Service with just enough around the retirement
// handler to drive it from an HTTP request: an authenticated organization
// context, the two stores it reads, and the deleter it calls.
func newRetireHarness(t *testing.T) *retireHarness {
	t.Helper()
	skills := &fakeSkillStore{
		skill: &cloudhub.OpenClawSkill{
			ID:             "skill-1",
			OrganizationID: "org-1",
			Name:           "cpu-report",
		},
	}
	agents := &fakeOrgAgentStore{agentID: "agent-1"}
	deleter := &stubDeleter{}
	return &retireHarness{
		service: &Service{
			Store: &mocks.Store{
				OpenClawSkillStore:    skills,
				OpenClawOrgAgentStore: agents,
			},
			OpenClawSkillDeleter: deleter,
			Logger:               &mocks.TestLogger{},
		},
		skills:  skills,
		agents:  agents,
		deleter: deleter,
	}
}

// retire issues DELETE /skills/{id} against the handler.
func (h *retireHarness) retire(id string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodDelete, "/cloudhub/v2/openclaw/skills/"+id, nil)
	ctx := request.Context()
	ctx = context.WithValue(ctx, organizations.ContextKey, "org-1")
	ctx = context.WithValue(ctx, UserContextKey, &cloudhub.User{ID: 9, Name: "admin"})
	ctx = httprouter.WithParams(ctx, httprouter.Params{{Key: "id", Value: id}})

	recorder := httptest.NewRecorder()
	h.service.OpenClawSkillDelete(recorder, request.WithContext(ctx))
	return recorder
}

// This fails if retirement stops deleting from the workspace, stops hiding the
// skill, or stops scoping either to the caller's organization.
func TestOpenClawSkillDeleteRemovesFromTheWorkspaceThenHidesTheSkill(t *testing.T) {
	h := newRetireHarness(t)

	recorder := h.retire("skill-1")

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204; body = %s", recorder.Code, recorder.Body)
	}
	if len(h.deleter.skills) != 1 || h.deleter.skills[0] != "cpu-report" {
		t.Fatalf("deleted skills = %v, want [cpu-report]", h.deleter.skills)
	}
	// The agent is what scopes the deletion to one workspace. Sending the
	// wrong one deletes another organization's copy of the same skill.
	if len(h.deleter.agents) != 1 || h.deleter.agents[0] != "agent-1" {
		t.Fatalf("deleted from agents = %v, want [agent-1]", h.deleter.agents)
	}
	if len(h.agents.purposes) != 1 || h.agents.purposes[0] != cloudhub.OpenClawAgentExecution {
		t.Fatalf("agent purposes = %v, want [%s]", h.agents.purposes, cloudhub.OpenClawAgentExecution)
	}
	if len(h.skills.deleted) != 1 || h.skills.deleted[0] != "skill-1" {
		t.Fatalf("soft deleted = %v, want [skill-1]", h.skills.deleted)
	}
	if h.skills.delOrg[0] != "org-1" || h.skills.getOrgIDs[0] != "org-1" {
		t.Fatalf("store calls not scoped to org-1: get=%v delete=%v", h.skills.getOrgIDs, h.skills.delOrg)
	}
}

// The order matters and is the point of the handler. Hiding a skill whose
// files are still in the workspace would leave the agent able to run something
// CloudHub reports as retired, and nothing in the UI would show it.
func TestOpenClawSkillDeleteKeepsTheSkillVisibleWhenTheWorkspaceDeleteFails(t *testing.T) {
	h := newRetireHarness(t)
	h.deleter.err = errors.New("skill-admin unreachable")

	recorder := h.retire("skill-1")

	if recorder.Code == http.StatusNoContent {
		t.Fatal("retirement reported success even though the workspace delete failed")
	}
	if len(h.skills.deleted) != 0 {
		t.Fatalf("skill was hidden despite the failed delete: %v", h.skills.deleted)
	}
}

// A skill that is not this organization's must not be deletable, and the
// workspace must not be touched while finding that out.
func TestOpenClawSkillDeleteDoesNotTouchTheWorkspaceForAnUnknownSkill(t *testing.T) {
	h := newRetireHarness(t)
	h.skills.getErr = cloudhub.ErrOpenClawSkillNotFound

	recorder := h.retire("someone-elses-skill")

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404; body = %s", recorder.Code, recorder.Body)
	}
	if len(h.deleter.skills) != 0 {
		t.Fatalf("workspace delete attempted for an unknown skill: %v", h.deleter.skills)
	}
}

// Without an agent mapping there is no workspace to delete from. Guessing one
// would delete from whichever workspace the Gateway defaults to.
func TestOpenClawSkillDeleteRefusesWhenNoExecutionAgentIsMapped(t *testing.T) {
	h := newRetireHarness(t)
	h.agents.err = cloudhub.ErrOpenClawAgentNotMapped

	recorder := h.retire("skill-1")

	if recorder.Code == http.StatusNoContent {
		t.Fatal("retirement succeeded without an execution agent")
	}
	if len(h.deleter.skills) != 0 {
		t.Fatalf("workspace delete attempted without an agent: %v", h.deleter.skills)
	}
	if len(h.skills.deleted) != 0 {
		t.Fatalf("skill was hidden without an agent: %v", h.skills.deleted)
	}
}

// With no skill-admin configured there is no way to remove the files, so the
// request must fail rather than hide a skill that stays live on the agent.
func TestOpenClawSkillDeleteRefusesWhenSkillAdminIsNotConfigured(t *testing.T) {
	h := newRetireHarness(t)
	h.service.OpenClawSkillDeleter = nil

	recorder := h.retire("skill-1")

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503; body = %s", recorder.Code, recorder.Body)
	}
	if len(h.skills.deleted) != 0 {
		t.Fatalf("skill was hidden with no way to delete its files: %v", h.skills.deleted)
	}
}

// Retirement is an organization-scoped action; an unauthenticated request must
// not reach the stores at all.
func TestOpenClawSkillDeleteRequiresAnOrganizationContext(t *testing.T) {
	h := newRetireHarness(t)

	request := httptest.NewRequest(http.MethodDelete, "/cloudhub/v2/openclaw/skills/skill-1", nil)
	ctx := httprouter.WithParams(request.Context(), httprouter.Params{{Key: "id", Value: "skill-1"}})
	recorder := httptest.NewRecorder()
	h.service.OpenClawSkillDelete(recorder, request.WithContext(ctx))

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body = %s", recorder.Code, recorder.Body)
	}
	if len(h.skills.getIDs) != 0 || len(h.deleter.skills) != 0 {
		t.Fatalf("unauthenticated request reached the stores: get=%v delete=%v", h.skills.getIDs, h.deleter.skills)
	}
}
