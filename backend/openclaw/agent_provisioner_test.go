package openclaw

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func newProvisionerRPC() *fakeSkillRPC {
	rpc := newFakeSkillRPC()
	rpc.response["agents.create"] = json.RawMessage(
		`{"ok":true,"agentId":"cloudhub-org-1-execution","workspace":"/workspaces/cloudhub-org-1-execution"}`)
	return rpc
}

// This fails if provisioning stops isolating organizations: the workspace path
// is what keeps one organization's skills out of another's agent, and it has
// to be derived from the agent, not shared.
func TestAgentProvisionerCreatesAnIsolatedWorkspace(t *testing.T) {
	rpc := newProvisionerRPC()
	provisioner := NewAgentProvisioner(rpc, "/workspaces")

	agentID, err := provisioner.Ensure(context.Background(), "cloudhub-org-1-execution")
	if err != nil {
		t.Fatalf("Ensure: %v", err)
	}
	if agentID != "cloudhub-org-1-execution" {
		t.Fatalf("agentID = %q", agentID)
	}

	var params struct {
		Name      string `json:"name"`
		Workspace string `json:"workspace"`
	}
	rpc.paramsFor(t, "agents.create", &params)
	if params.Name != "cloudhub-org-1-execution" {
		t.Fatalf("name = %q", params.Name)
	}
	if params.Workspace != "/workspaces/cloudhub-org-1-execution" {
		t.Fatalf("workspace = %q, want it under the configured root", params.Workspace)
	}
}

// The Gateway derives the agent id from the name it is given and answers with
// the id it actually used. Storing the requested name instead would leave
// CloudHub addressing an agent that does not exist.
func TestAgentProvisionerUsesTheIDTheGatewayReturns(t *testing.T) {
	rpc := newProvisionerRPC()
	rpc.response["agents.create"] = json.RawMessage(`{"ok":true,"agentId":"renamed-by-gateway"}`)
	provisioner := NewAgentProvisioner(rpc, "/workspaces")

	agentID, err := provisioner.Ensure(context.Background(), "cloudhub-org-1-execution")
	if err != nil {
		t.Fatalf("Ensure: %v", err)
	}
	if agentID != "renamed-by-gateway" {
		t.Fatalf("agentID = %q, want the Gateway's id", agentID)
	}
}

// Provisioning is retried whenever an organization has no mapping, so an agent
// left over from a half-finished attempt must not block it.
func TestAgentProvisionerTreatsAnExistingAgentAsSuccess(t *testing.T) {
	rpc := newProvisionerRPC()
	rpc.err["agents.create"] = errors.New(`agent "cloudhub-org-1-execution" already exists`)
	provisioner := NewAgentProvisioner(rpc, "/workspaces")

	agentID, err := provisioner.Ensure(context.Background(), "cloudhub-org-1-execution")
	if err != nil {
		t.Fatalf("Ensure(existing agent) = %v, want success", err)
	}
	if agentID != "cloudhub-org-1-execution" {
		t.Fatalf("agentID = %q, want the requested agent", agentID)
	}
}

func TestAgentProvisionerReportsOtherGatewayFailures(t *testing.T) {
	rpc := newProvisionerRPC()
	rpc.err["agents.create"] = errors.New("gateway down")
	provisioner := NewAgentProvisioner(rpc, "/workspaces")

	if _, err := provisioner.Ensure(context.Background(), "cloudhub-org-1-execution"); err == nil {
		t.Fatal("Ensure succeeded despite a Gateway failure")
	}
}

// An empty response would otherwise be stored as an empty agent id, which the
// Gateway resolves to its default agent - another organization's workspace.
func TestAgentProvisionerRejectsAResponseWithoutAnID(t *testing.T) {
	rpc := newProvisionerRPC()
	rpc.response["agents.create"] = json.RawMessage(`{"ok":true}`)
	provisioner := NewAgentProvisioner(rpc, "/workspaces")

	if _, err := provisioner.Ensure(context.Background(), "cloudhub-org-1-execution"); err == nil {
		t.Fatal("Ensure accepted a response with no agent id")
	}
}

func TestNewAgentProvisionerRequiresAWorkspaceRoot(t *testing.T) {
	if _, err := NewAgentProvisioner(newProvisionerRPC(), "  ").Ensure(context.Background(), "a"); err == nil {
		t.Fatal("Ensure succeeded without a workspace root")
	}
	if _, err := NewAgentProvisioner(newProvisionerRPC(), "relative/path").Ensure(context.Background(), "a"); err == nil {
		t.Fatal("Ensure succeeded with a relative workspace root")
	}
}

// The agent name becomes a directory under the workspace root, so anything
// that could climb out of it has to be refused before it reaches a path join.
func TestAgentProvisionerRejectsUnusableAgentNames(t *testing.T) {
	provisioner := NewAgentProvisioner(newProvisionerRPC(), "/workspaces")
	for _, name := range []string{"", "..", "a/b", "../escape", "/absolute", strings.Repeat("a", 200)} {
		if _, err := provisioner.Ensure(context.Background(), name); err == nil {
			t.Fatalf("Ensure(%q) succeeded, want rejection", name)
		}
	}
}

// This fails if provisioning starts naming two purposes the same, which would
// point drafting and execution at one workspace and undo the separation.
func TestOpenClawAgentNameIsUniquePerOrganizationAndPurpose(t *testing.T) {
	authoring := AgentName("org-1", "authoring")
	execution := AgentName("org-1", "execution")
	other := AgentName("org-2", "execution")

	for _, name := range []string{authoring, execution, other} {
		if !agentNamePattern.MatchString(name) {
			t.Fatalf("AgentName produced %q, which is not a usable agent name", name)
		}
	}
	if authoring == execution || execution == other {
		t.Fatalf("names collide: %q %q %q", authoring, execution, other)
	}
}

// Organization ids are not guaranteed to be slug-safe. An id that normalized
// to the same name as another organization's would hand one organization the
// other's workspace.
func TestOpenClawAgentNameSeparatesOrganizationsThatNormalizeAlike(t *testing.T) {
	if AgentName("Org 1", "execution") == AgentName("org-1", "execution") {
		t.Fatal("two organization ids produced the same agent name")
	}
}
