package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

// The sweep is the only thing that clears workspaces an organization deletion
// could not, so it is driven through the handler.

type sweepHarness struct {
	service *Service
	store   *reclaimAgentStore
	agents  *stubProvisioner
	deleter *stubDeleter
}

func newSweepHarness(pending ...cloudhub.OpenClawPendingReclaim) *sweepHarness {
	store := &reclaimAgentStore{pending: pending}
	agents := &stubProvisioner{}
	deleter := &stubDeleter{}
	return &sweepHarness{
		service: &Service{
			Store:                    &mocks.Store{OpenClawOrgAgentStore: store},
			OpenClawAgentProvisioner: agents,
			OpenClawSkillDeleter:     deleter,
			Logger:                   &mocks.TestLogger{},
		},
		store:   store,
		agents:  agents,
		deleter: deleter,
	}
}

func (h *sweepHarness) sweep(t *testing.T) (*httptest.ResponseRecorder, openClawWorkspaceReclaimResponse) {
	t.Helper()
	request := httptest.NewRequest(http.MethodPost, "/cloudhub/v2/openclaw/workspaces/reclaim", nil)
	recorder := httptest.NewRecorder()
	h.service.OpenClawWorkspaceReclaim(recorder, request)

	var response openClawWorkspaceReclaimResponse
	if recorder.Code == http.StatusOK {
		if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
			t.Fatalf("decode response %s: %v", recorder.Body, err)
		}
	}
	return recorder, response
}

func leftover(orgID, purpose, agentID string) cloudhub.OpenClawPendingReclaim {
	return cloudhub.OpenClawPendingReclaim{
		OrganizationID: orgID,
		Purpose:        purpose,
		AgentID:        agentID,
		DeletedAt:      time.Now().UTC().Add(-time.Hour),
	}
}

// The point of the endpoint: files an organization deletion left behind go
// away, and the mappings stop being owed.
func TestWorkspaceSweepReclaimsEveryLeftover(t *testing.T) {
	h := newSweepHarness(
		leftover("org-1", cloudhub.OpenClawAgentAuthoring, "org-1-authoring"),
		leftover("org-2", cloudhub.OpenClawAgentExecution, "org-2-execution"),
	)

	recorder, response := h.sweep(t)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", recorder.Code, recorder.Body)
	}
	if response.Reclaimed != 2 || response.Failed != 0 || len(response.Pending) != 0 {
		t.Fatalf("response = %#v, want two reclaimed and nothing pending", response)
	}
	if len(h.deleter.workspacesDeleted) != 2 || len(h.agents.removed) != 2 {
		t.Fatalf("did not clear both: workspaces=%v agents=%v",
			h.deleter.workspacesDeleted, h.agents.removed)
	}
	if len(h.store.marked) != 2 {
		t.Fatalf("marked = %v, want both taken out of the queue", h.store.marked)
	}
}

// A leftover that still cannot be cleared has to stay owed and be named, or an
// operator has no way to know the sweep did not finish.
func TestWorkspaceSweepKeepsWhatItCouldNotClear(t *testing.T) {
	h := newSweepHarness(
		leftover("org-1", cloudhub.OpenClawAgentAuthoring, "org-1-authoring"),
		leftover("org-2", cloudhub.OpenClawAgentExecution, "org-2-execution"),
	)
	h.deleter.failWorkspace = "org-2-execution"

	_, response := h.sweep(t)

	if response.Reclaimed != 1 || response.Failed != 1 {
		t.Fatalf("response = %#v, want one of each", response)
	}
	if len(response.Pending) != 1 || response.Pending[0].AgentID != "org-2-execution" {
		t.Fatalf("pending = %#v, want the agent that failed", response.Pending)
	}
	if response.Pending[0].Error == "" {
		t.Fatal("pending entry did not say why it failed")
	}
	if len(h.store.marked) != 1 {
		t.Fatalf("marked = %v, want only the one that was cleared", h.store.marked)
	}
}

// Deleting a workspace succeeds, but recording it does not. Reporting that as
// reclaimed would be a lie: the store still owes it, and the next sweep will
// see it again.
func TestWorkspaceSweepReportsAMarkThatDidNotStick(t *testing.T) {
	h := newSweepHarness(leftover("org-1", cloudhub.OpenClawAgentExecution, "org-1-execution"))
	h.store.markErr = errors.New("database down")

	_, response := h.sweep(t)

	if response.Reclaimed != 0 || response.Failed != 1 || len(response.Pending) != 1 {
		t.Fatalf("response = %#v, want the unrecorded reclaim reported as pending", response)
	}
}

// With nothing owed the sweep is how an operator checks that: an empty pending
// list is the answer, not an error.
func TestWorkspaceSweepReportsNothingOwed(t *testing.T) {
	h := newSweepHarness()

	recorder, response := h.sweep(t)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", recorder.Code, recorder.Body)
	}
	if response.Reclaimed != 0 || response.Failed != 0 || response.Pending == nil || len(response.Pending) != 0 {
		t.Fatalf("response = %#v, want an empty pending list", response)
	}
	if len(h.deleter.workspacesDeleted) != 0 {
		t.Fatalf("called skill-admin with nothing owed: %v", h.deleter.workspacesDeleted)
	}
}

// Without skill-admin the files cannot be deleted, so a sweep would mark
// leftovers cleared while they sit on the host.
func TestWorkspaceSweepRefusesWithoutSkillAdmin(t *testing.T) {
	h := newSweepHarness(leftover("org-1", cloudhub.OpenClawAgentExecution, "org-1-execution"))
	h.service.OpenClawSkillDeleter = nil

	recorder, _ := h.sweep(t)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503; body = %s", recorder.Code, recorder.Body)
	}
	if len(h.store.marked) != 0 {
		t.Fatalf("marked leftovers with no way to delete them: %v", h.store.marked)
	}
}

// A store that cannot be read must not be reported as nothing owed.
func TestWorkspaceSweepFailsWhenTheQueueCannotBeRead(t *testing.T) {
	h := newSweepHarness()
	h.store.pendingErr = errors.New("database down")

	recorder, _ := h.sweep(t)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500; body = %s", recorder.Code, recorder.Body)
	}
}
