package server

import (
	"context"
	"errors"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

// provisionAgentStore records what was bound and answers Get from what Ensure
// has stored, the way the real store does.
type provisionAgentStore struct {
	cloudhub.OpenClawOrgAgentStore

	bound      map[string]string
	getErr     error
	ensureErr  error
	ensureArgs []string
}

func newProvisionAgentStore() *provisionAgentStore {
	return &provisionAgentStore{bound: map[string]string{}}
}

func (s *provisionAgentStore) Get(_ context.Context, _, purpose string) (string, error) {
	if s.getErr != nil {
		return "", s.getErr
	}
	agentID, ok := s.bound[purpose]
	if !ok {
		return "", cloudhub.ErrOpenClawAgentNotMapped
	}
	return agentID, nil
}

func (s *provisionAgentStore) Ensure(_ context.Context, _, purpose, agentID string) (string, error) {
	s.ensureArgs = append(s.ensureArgs, purpose+"="+agentID)
	if s.ensureErr != nil {
		return "", s.ensureErr
	}
	if existing, ok := s.bound[purpose]; ok {
		return existing, nil
	}
	s.bound[purpose] = agentID
	return agentID, nil
}

type stubProvisioner struct {
	names     []string
	removed   []string
	id        string
	err       error
	removeErr error
}

func (p *stubProvisioner) Remove(_ context.Context, agentID string) error {
	p.removed = append(p.removed, agentID)
	return p.removeErr
}

func (p *stubProvisioner) Ensure(_ context.Context, name string) (string, error) {
	p.names = append(p.names, name)
	if p.err != nil {
		return "", p.err
	}
	if p.id != "" {
		return p.id, nil
	}
	return name, nil
}

func newAgentResolveService(store *provisionAgentStore, provisioner openClawAgentProvisioner) *Service {
	return &Service{
		Store:                    &mocks.Store{OpenClawOrgAgentStore: store},
		OpenClawAgentProvisioner: provisioner,
		Logger:                   &mocks.TestLogger{},
	}
}

// An organization that already has an agent must not be provisioned again:
// creating a second workspace would strand the skills in the first.
func TestOpenClawAgentForReturnsTheMappedAgentWithoutProvisioning(t *testing.T) {
	store := newProvisionAgentStore()
	store.bound[cloudhub.OpenClawAgentExecution] = "already-mapped"
	provisioner := &stubProvisioner{}
	service := newAgentResolveService(store, provisioner)

	agentID, err := service.openClawAgentFor(context.Background(), "org-1", cloudhub.OpenClawAgentExecution)
	if err != nil {
		t.Fatalf("openClawAgentFor: %v", err)
	}
	if agentID != "already-mapped" {
		t.Fatalf("agentID = %q", agentID)
	}
	if len(provisioner.names) != 0 {
		t.Fatalf("provisioned despite an existing mapping: %v", provisioner.names)
	}
}

// This is the lazy path: the first request for an organization creates its
// agent and records the binding.
func TestOpenClawAgentForProvisionsOnFirstUse(t *testing.T) {
	store := newProvisionAgentStore()
	provisioner := &stubProvisioner{}
	service := newAgentResolveService(store, provisioner)

	agentID, err := service.openClawAgentFor(context.Background(), "org-1", cloudhub.OpenClawAgentExecution)
	if err != nil {
		t.Fatalf("openClawAgentFor: %v", err)
	}
	want := openclawAgentName("org-1", cloudhub.OpenClawAgentExecution)
	if agentID != want {
		t.Fatalf("agentID = %q, want %q", agentID, want)
	}
	if len(provisioner.names) != 1 || provisioner.names[0] != want {
		t.Fatalf("provisioned %v, want [%s]", provisioner.names, want)
	}
	if store.bound[cloudhub.OpenClawAgentExecution] != want {
		t.Fatalf("binding = %q, want %q", store.bound[cloudhub.OpenClawAgentExecution], want)
	}
}

// Two purposes must land on two agents. Sharing one would put drafts in the
// workspace the execution agent reads, which is what separating them prevents.
func TestOpenClawAgentForProvisionsEachPurposeSeparately(t *testing.T) {
	store := newProvisionAgentStore()
	service := newAgentResolveService(store, &stubProvisioner{})
	ctx := context.Background()

	authoring, err := service.openClawAgentFor(ctx, "org-1", cloudhub.OpenClawAgentAuthoring)
	if err != nil {
		t.Fatalf("authoring: %v", err)
	}
	execution, err := service.openClawAgentFor(ctx, "org-1", cloudhub.OpenClawAgentExecution)
	if err != nil {
		t.Fatalf("execution: %v", err)
	}
	if authoring == execution {
		t.Fatalf("both purposes resolved to %q", authoring)
	}
	if len(store.bound) != 2 {
		t.Fatalf("bindings = %#v, want one per purpose", store.bound)
	}
}

// If two requests provision at once, the store keeps the first binding. The
// caller must be handed that one, not the agent it just created, or the two
// requests would work against different workspaces.
func TestOpenClawAgentForYieldsToAnExistingBinding(t *testing.T) {
	store := newProvisionAgentStore()
	store.bound[cloudhub.OpenClawAgentExecution] = "won-the-race"
	store.getErr = cloudhub.ErrOpenClawAgentNotMapped // Get raced ahead of the other request's write.
	service := newAgentResolveService(store, &stubProvisioner{})

	agentID, err := service.openClawAgentFor(context.Background(), "org-1", cloudhub.OpenClawAgentExecution)
	if err != nil {
		t.Fatalf("openClawAgentFor: %v", err)
	}
	if agentID != "won-the-race" {
		t.Fatalf("agentID = %q, want the binding that won", agentID)
	}
}

// With no provisioner configured the old behaviour stands: an administrator
// maps the agent by hand, and the caller is told so.
func TestOpenClawAgentForReportsNotMappedWithoutAProvisioner(t *testing.T) {
	store := newProvisionAgentStore()
	service := newAgentResolveService(store, nil)

	_, err := service.openClawAgentFor(context.Background(), "org-1", cloudhub.OpenClawAgentExecution)
	if !errors.Is(err, cloudhub.ErrOpenClawAgentNotMapped) {
		t.Fatalf("error = %v, want ErrOpenClawAgentNotMapped", err)
	}
}

// A Gateway that cannot create the agent must not leave a binding behind: the
// next request would resolve to an agent that does not exist.
func TestOpenClawAgentForDoesNotBindWhenProvisioningFails(t *testing.T) {
	store := newProvisionAgentStore()
	service := newAgentResolveService(store, &stubProvisioner{err: errors.New("gateway down")})

	if _, err := service.openClawAgentFor(context.Background(), "org-1", cloudhub.OpenClawAgentExecution); err == nil {
		t.Fatal("openClawAgentFor succeeded despite a provisioning failure")
	}
	if len(store.ensureArgs) != 0 {
		t.Fatalf("bound an agent that was never created: %v", store.ensureArgs)
	}
}

// The Gateway may hand back a different id than the name it was asked for, and
// that id is what has to be stored.
func TestOpenClawAgentForBindsTheIDTheGatewayReturned(t *testing.T) {
	store := newProvisionAgentStore()
	service := newAgentResolveService(store, &stubProvisioner{id: "gateway-chosen-id"})

	agentID, err := service.openClawAgentFor(context.Background(), "org-1", cloudhub.OpenClawAgentExecution)
	if err != nil {
		t.Fatalf("openClawAgentFor: %v", err)
	}
	if agentID != "gateway-chosen-id" {
		t.Fatalf("agentID = %q", agentID)
	}
	if store.bound[cloudhub.OpenClawAgentExecution] != "gateway-chosen-id" {
		t.Fatalf("binding = %q", store.bound[cloudhub.OpenClawAgentExecution])
	}
}
