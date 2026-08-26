package server

import (
	"context"
	"errors"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/openclaw"
)

func newBaselineService(agents *provisionAgentStore, provisioner *stubProvisioner, deleter *stubDeleter) *Service {
	return &Service{
		Store:                    &mocks.Store{OpenClawOrgAgentStore: agents},
		OpenClawAgentProvisioner: provisioner,
		OpenClawSkillDeleter:     deleter,
		Logger:                   &mocks.TestLogger{},
	}
}

// A new organization's agent starts with the template's skills already in its
// workspace. They are copied rather than proposed: the Gateway refuses a
// proposal whose description runs past 160 bytes, which every operational
// skill worth inheriting does.
func TestBaselineSkillsAreCopiedIntoANewExecutionAgent(t *testing.T) {
	agents := newProvisionAgentStore()
	deleter := &stubDeleter{}
	service := newBaselineService(agents, &stubProvisioner{id: "org-1-execution"}, deleter)

	if _, err := service.openClawAgentFor(context.Background(), "org-1", cloudhub.OpenClawAgentExecution); err != nil {
		t.Fatalf("openClawAgentFor: %v", err)
	}
	if len(deleter.copiedInto) != 1 || deleter.copiedInto[0] != "org-1-execution" {
		t.Fatalf("copied into %v, want the new execution agent", deleter.copiedInto)
	}
}

// Skills live in the execution agent's workspace. Seeding the authoring agent
// would put the baseline where nothing runs it.
func TestBaselineSkillsAreNotCopiedIntoTheAuthoringAgent(t *testing.T) {
	agents := newProvisionAgentStore()
	deleter := &stubDeleter{}
	service := newBaselineService(agents, &stubProvisioner{id: "org-1-authoring"}, deleter)

	if _, err := service.openClawAgentFor(context.Background(), "org-1", cloudhub.OpenClawAgentAuthoring); err != nil {
		t.Fatalf("openClawAgentFor: %v", err)
	}
	if len(deleter.copiedInto) != 0 {
		t.Fatalf("copied into %v for the authoring agent", deleter.copiedInto)
	}
}

// An organization whose agent already exists keeps what it has. Copying on
// every resolve would put back skills it retired on purpose.
func TestBaselineSkillsAreNotCopiedForAnAlreadyMappedAgent(t *testing.T) {
	agents := newProvisionAgentStore()
	agents.bound[cloudhub.OpenClawAgentExecution] = "already-mapped"
	deleter := &stubDeleter{}
	service := newBaselineService(agents, &stubProvisioner{}, deleter)

	if _, err := service.openClawAgentFor(context.Background(), "org-1", cloudhub.OpenClawAgentExecution); err != nil {
		t.Fatalf("openClawAgentFor: %v", err)
	}
	if len(deleter.copiedInto) != 0 {
		t.Fatalf("copied into %v for an agent that already existed", deleter.copiedInto)
	}
}

// The organization is waiting on this agent for the request that triggered
// provisioning. An agent with stock scaffolding still works; no agent at all
// does not.
func TestProvisioningSucceedsWhenTheBaselineCannotBeCopied(t *testing.T) {
	agents := newProvisionAgentStore()
	deleter := &stubDeleter{copyErr: errors.New("skill-admin is unreachable")}
	service := newBaselineService(agents, &stubProvisioner{id: "org-1-execution"}, deleter)

	agentID, err := service.openClawAgentFor(context.Background(), "org-1", cloudhub.OpenClawAgentExecution)
	if err != nil {
		t.Fatalf("openClawAgentFor: %v", err)
	}
	if agentID != "org-1-execution" {
		t.Fatalf("agentID = %q", agentID)
	}
}

// The skill-admin server is what can write into a workspace. A deployment
// without one still has to be able to provision agents.
func TestProvisioningSucceedsWithoutASkillAdminServer(t *testing.T) {
	agents := newProvisionAgentStore()
	service := &Service{
		Store:                    &mocks.Store{OpenClawOrgAgentStore: agents},
		OpenClawAgentProvisioner: &stubProvisioner{id: "org-1-execution"},
		Logger:                   &mocks.TestLogger{},
	}

	if _, err := service.openClawAgentFor(context.Background(), "org-1", cloudhub.OpenClawAgentExecution); err != nil {
		t.Fatalf("openClawAgentFor: %v", err)
	}
}

// The source is the template agent, not whatever the caller passes: copying
// from an organization's own workspace would spread one organization's skills
// into another.
func TestBaselineSkillsAreCopiedFromTheTemplateAgent(t *testing.T) {
	recorded := ""
	agents := newProvisionAgentStore()
	deleter := &recordingSourceDeleter{source: &recorded}
	service := &Service{
		Store:                    &mocks.Store{OpenClawOrgAgentStore: agents},
		OpenClawAgentProvisioner: &stubProvisioner{id: "org-1-execution"},
		OpenClawSkillDeleter:     deleter,
		Logger:                   &mocks.TestLogger{},
	}

	if _, err := service.openClawAgentFor(context.Background(), "org-1", cloudhub.OpenClawAgentExecution); err != nil {
		t.Fatalf("openClawAgentFor: %v", err)
	}
	if recorded != openclaw.TemplateAgentID {
		t.Fatalf("copied from %q, want %q", recorded, openclaw.TemplateAgentID)
	}
}

type recordingSourceDeleter struct {
	stubDeleter
	source *string
}

func (d *recordingSourceDeleter) CopyBaselineSkills(_ context.Context, sourceAgentID, _ string) error {
	*d.source = sourceAgentID
	return nil
}
