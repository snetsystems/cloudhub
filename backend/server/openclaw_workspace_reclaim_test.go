package server

import (
	"context"
	"errors"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

// reclaimAgentStore answers All from a fixed mapping and records retirement.
type reclaimAgentStore struct {
	cloudhub.OpenClawOrgAgentStore

	agents        map[string]string
	allErr        error
	softDeleteErr error
	softDeleted   []string

	pending    []cloudhub.OpenClawPendingReclaim
	pendingErr error
	markErr    error
	marked     []string
}

func (s *reclaimAgentStore) All(_ context.Context, _ string) (map[string]string, error) {
	if s.allErr != nil {
		return nil, s.allErr
	}
	return s.agents, nil
}

func (s *reclaimAgentStore) SoftDelete(_ context.Context, organizationID string) error {
	s.softDeleted = append(s.softDeleted, organizationID)
	return s.softDeleteErr
}

func (s *reclaimAgentStore) PendingReclaim(context.Context) ([]cloudhub.OpenClawPendingReclaim, error) {
	if s.pendingErr != nil {
		return nil, s.pendingErr
	}
	return s.pending, nil
}

func (s *reclaimAgentStore) MarkReclaimed(_ context.Context, organizationID, purpose string) error {
	s.marked = append(s.marked, organizationID+"/"+purpose)
	return s.markErr
}

func newReclaimService(store *reclaimAgentStore, provisioner *stubProvisioner, deleter *stubDeleter) *Service {
	service := &Service{
		Store:  &mocks.Store{OpenClawOrgAgentStore: store},
		Logger: &mocks.TestLogger{},
	}
	if provisioner != nil {
		service.OpenClawAgentProvisioner = provisioner
	}
	if deleter != nil {
		service.OpenClawSkillDeleter = deleter
	}
	return service
}

// This is the whole point: an organization's agents and their workspaces go
// away with it, and the mapping is kept so the binding can be recovered.
func TestReclaimRemovesEveryAgentAndItsWorkspace(t *testing.T) {
	store := &reclaimAgentStore{agents: map[string]string{
		cloudhub.OpenClawAgentAuthoring: "org-1-authoring",
		cloudhub.OpenClawAgentExecution: "org-1-execution",
	}}
	provisioner := &stubProvisioner{}
	deleter := &stubDeleter{}

	newReclaimService(store, provisioner, deleter).reclaimOpenClawWorkspaces(context.Background(), "org-1")

	if len(provisioner.removed) != 2 {
		t.Fatalf("removed agents = %v, want both", provisioner.removed)
	}
	if len(deleter.workspacesDeleted) != 2 {
		t.Fatalf("reclaimed workspaces = %v, want both", deleter.workspacesDeleted)
	}
	for _, agentID := range []string{"org-1-authoring", "org-1-execution"} {
		if !includesAgent(provisioner.removed, agentID) {
			t.Fatalf("agent %q was not removed: %v", agentID, provisioner.removed)
		}
		if !includesAgent(deleter.workspacesDeleted, agentID) {
			t.Fatalf("workspace for %q was not reclaimed: %v", agentID, deleter.workspacesDeleted)
		}
	}
	if len(store.softDeleted) != 1 || store.softDeleted[0] != "org-1" {
		t.Fatalf("soft deleted = %v, want [org-1]", store.softDeleted)
	}
	// Marking is what takes these out of the sweep's queue. Without it every
	// organization ever deleted would be swept again forever.
	if len(store.marked) != 2 {
		t.Fatalf("marked reclaimed = %v, want both purposes", store.marked)
	}
}

// The organization is already gone by this point. Letting a Gateway failure
// abort the sweep would leave the other agent's workspace behind and the
// mapping live, with nothing recording that it still needs reclaiming.
func TestReclaimContinuesAndRetiresWhenTheGatewayFails(t *testing.T) {
	store := &reclaimAgentStore{agents: map[string]string{
		cloudhub.OpenClawAgentAuthoring: "org-1-authoring",
		cloudhub.OpenClawAgentExecution: "org-1-execution",
	}}
	provisioner := &stubProvisioner{removeErr: errors.New("gateway down")}
	deleter := &stubDeleter{workspaceErr: errors.New("skill-admin unreachable")}

	newReclaimService(store, provisioner, deleter).reclaimOpenClawWorkspaces(context.Background(), "org-1")

	if len(provisioner.removed) != 2 || len(deleter.workspacesDeleted) != 2 {
		t.Fatalf("sweep stopped early: removed=%v reclaimed=%v",
			provisioner.removed, deleter.workspacesDeleted)
	}
	if len(store.softDeleted) != 1 {
		t.Fatalf("mappings were not retired after the failures: %v", store.softDeleted)
	}
	// The files are still on the host. Marking these reclaimed would hide them
	// from the sweep, and nothing else records that they are owed.
	if len(store.marked) != 0 {
		t.Fatalf("marked workspaces reclaimed that were never deleted: %v", store.marked)
	}
}

// Only the agent that failed stays owed. Marking the whole organization on one
// failure would re-sweep workspaces that are already gone; marking none would
// leave a successful reclaim in the queue forever.
func TestReclaimMarksOnlyTheAgentsItActuallyCleared(t *testing.T) {
	store := &reclaimAgentStore{agents: map[string]string{
		cloudhub.OpenClawAgentAuthoring: "org-1-authoring",
		cloudhub.OpenClawAgentExecution: "org-1-execution",
	}}
	deleter := &stubDeleter{failWorkspace: "org-1-execution"}

	newReclaimService(store, &stubProvisioner{}, deleter).reclaimOpenClawWorkspaces(context.Background(), "org-1")

	want := "org-1/" + cloudhub.OpenClawAgentAuthoring
	if len(store.marked) != 1 || store.marked[0] != want {
		t.Fatalf("marked = %v, want [%s]", store.marked, want)
	}
}

// An organization that never used OpenClaw has no agents, and must not have
// its mappings touched or the Gateway called.
func TestReclaimDoesNothingWithoutAgents(t *testing.T) {
	store := &reclaimAgentStore{agents: map[string]string{}}
	provisioner := &stubProvisioner{}
	deleter := &stubDeleter{}

	newReclaimService(store, provisioner, deleter).reclaimOpenClawWorkspaces(context.Background(), "org-1")

	if len(provisioner.removed) != 0 || len(deleter.workspacesDeleted) != 0 {
		t.Fatalf("called the Gateway for an organization with no agents: %v %v",
			provisioner.removed, deleter.workspacesDeleted)
	}
	if len(store.softDeleted) != 0 {
		t.Fatalf("retired mappings that do not exist: %v", store.softDeleted)
	}
}

// A store that cannot be read must not lead to mappings being retired: that
// would lose the record of which workspaces still need reclaiming.
func TestReclaimDoesNotRetireWhenTheMappingsCannotBeRead(t *testing.T) {
	store := &reclaimAgentStore{allErr: errors.New("database down")}
	provisioner := &stubProvisioner{}
	deleter := &stubDeleter{}

	newReclaimService(store, provisioner, deleter).reclaimOpenClawWorkspaces(context.Background(), "org-1")

	if len(store.softDeleted) != 0 {
		t.Fatalf("retired mappings it could not read: %v", store.softDeleted)
	}
	if len(provisioner.removed) != 0 || len(deleter.workspacesDeleted) != 0 {
		t.Fatalf("acted on mappings it could not read: %v %v",
			provisioner.removed, deleter.workspacesDeleted)
	}
}

// On a deployment without OpenClaw the sweep must not touch the store at all.
// The store is nil there, so reading it would panic.
func TestReclaimSkipsWhenOpenClawIsNotConfigured(t *testing.T) {
	service := &Service{Store: &mocks.Store{}, Logger: &mocks.TestLogger{}}
	service.reclaimOpenClawWorkspaces(context.Background(), "org-1")
}

func includesAgent(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}
