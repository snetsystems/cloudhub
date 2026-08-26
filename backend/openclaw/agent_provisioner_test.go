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
	authoring := AgentName("", "org-1", "authoring")
	execution := AgentName("", "org-1", "execution")
	other := AgentName("", "org-2", "execution")

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
	if AgentName("", "Org 1", "execution") == AgentName("", "org-1", "execution") {
		t.Fatal("two organization ids produced the same agent name")
	}
}

// seedRPC answers agents.files.get with template content for every seeded
// name, so a test can assert on what provisioning copied.
func seedRPC() *fakeSkillRPC {
	rpc := newProvisionerRPC()
	rpc.response["agents.files.get"] = json.RawMessage(
		`{"agentId":"cloudhub-template","workspace":"/workspaces/cloudhub-template",` +
			`"file":{"name":"AGENTS.md","path":"/x","missing":false,"content":"template body"}}`)
	rpc.response["agents.files.set"] = json.RawMessage(`{"ok":true}`)
	return rpc
}

// filesSet returns the name of every document written to an agent.
func filesSet(t *testing.T, rpc *fakeSkillRPC) map[string]string {
	t.Helper()
	written := map[string]string{}
	for i, call := range rpc.calls {
		if call != "agents.files.set" {
			continue
		}
		var params struct {
			AgentID string `json:"agentId"`
			Name    string `json:"name"`
			Content string `json:"content"`
		}
		if err := json.Unmarshal(rpc.params[i], &params); err != nil {
			t.Fatalf("decode agents.files.set params: %v", err)
		}
		written[params.Name] = params.AgentID + "|" + params.Content
	}
	return written
}

// A new organization gets an agent that already carries the shared operating
// instructions. Without this it starts on the Gateway's stock scaffolding,
// which says nothing about how this deployment expects an agent to behave.
func TestAgentProvisionerSeedsANewAgentFromTheTemplate(t *testing.T) {
	rpc := seedRPC()
	provisioner := NewAgentProvisioner(rpc, "/workspaces")

	if _, err := provisioner.Ensure(context.Background(), "cloudhub-org-1-execution"); err != nil {
		t.Fatalf("Ensure: %v", err)
	}

	written := filesSet(t, rpc)
	for _, name := range seededWorkspaceFiles {
		if written[name] != "cloudhub-org-1-execution|template body" {
			t.Fatalf("%s was written as %q, want the template body on the new agent", name, written[name])
		}
	}

	var read struct {
		AgentID string `json:"agentId"`
	}
	rpc.paramsFor(t, "agents.files.get", &read)
	if read.AgentID != TemplateAgentID {
		t.Fatalf("read from %q, want the template agent", read.AgentID)
	}
}

// The Gateway parses IDENTITY.md and rewrites it through agents.update, so a
// raw copy would clobber the fields that form round trips - and one identity
// shared by every organization is wrong anyway.
func TestAgentProvisionerNeverCopiesTheIdentityRecord(t *testing.T) {
	rpc := seedRPC()
	provisioner := NewAgentProvisioner(rpc, "/workspaces")

	if _, err := provisioner.Ensure(context.Background(), "cloudhub-org-1-execution"); err != nil {
		t.Fatalf("Ensure: %v", err)
	}
	if _, copied := filesSet(t, rpc)["IDENTITY.md"]; copied {
		t.Fatal("IDENTITY.md was copied from the template")
	}
}

// Provisioning is retried whenever an organization has no stored mapping, so
// it runs again against agents that already exist. Seeding those would
// overwrite instructions the organization edited.
func TestAgentProvisionerDoesNotSeedAnAgentThatAlreadyExists(t *testing.T) {
	rpc := seedRPC()
	rpc.err["agents.create"] = errors.New(`agent "cloudhub-org-1-execution" already exists`)
	provisioner := NewAgentProvisioner(rpc, "/workspaces")

	agentID, err := provisioner.Ensure(context.Background(), "cloudhub-org-1-execution")
	if err != nil {
		t.Fatalf("Ensure: %v", err)
	}
	if agentID != "cloudhub-org-1-execution" {
		t.Fatalf("agentID = %q", agentID)
	}
	if written := filesSet(t, rpc); len(written) != 0 {
		t.Fatalf("wrote %v to an existing agent", written)
	}
}

// An agent with stock scaffolding still works. Failing provisioning because
// the template is missing would block skill authoring on a deployment that
// never set one up.
func TestAgentProvisionerSucceedsWithoutATemplate(t *testing.T) {
	rpc := seedRPC()
	rpc.err["agents.files.get"] = errors.New("agent not found")
	provisioner := NewAgentProvisioner(rpc, "/workspaces")

	agentID, err := provisioner.Ensure(context.Background(), "cloudhub-org-1-execution")
	if err != nil {
		t.Fatalf("Ensure: %v", err)
	}
	if agentID != "cloudhub-org-1-execution" {
		t.Fatalf("agentID = %q", agentID)
	}
	if written := filesSet(t, rpc); len(written) != 0 {
		t.Fatalf("wrote %v with no template to read", written)
	}
}

// The built-in organization has the same id in every CloudHub, so two
// deployments sharing a Gateway derive one name for two different
// organizations - and hand them one workspace. This is the case the namespace
// exists for.
func TestOpenClawAgentNameSeparatesDeploymentsSharingAGateway(t *testing.T) {
	dev := AgentName("dev-237", "default", "execution")
	prod := AgentName("prod-72", "default", "execution")

	if dev == prod {
		t.Fatalf("two deployments produced the same agent name: %q", dev)
	}
	for _, name := range []string{dev, prod} {
		if !agentNamePattern.MatchString(name) || len(name) > maxAgentNameLength {
			t.Fatalf("AgentName produced %q, which is not a usable agent name", name)
		}
	}
}

// A deployment that already has agents must keep them. Its bindings are stored
// per organization and never recomputed, but a renamed scheme would strand any
// organization that has not been provisioned yet next to one that has.
func TestOpenClawAgentNameWithoutANamespaceIsUnchanged(t *testing.T) {
	if got, want := AgentName("", "org-1", "execution"), "cloudhub-org-1-c24787a7-execution"; got != want {
		t.Fatalf("AgentName = %q, want the original scheme %q", got, want)
	}
}

// The namespace is a label as well as a digest input. Two that slugify alike
// would collide on the label alone, which is the trap the organization digest
// already closes.
func TestOpenClawAgentNameSeparatesNamespacesThatNormalizeAlike(t *testing.T) {
	if AgentName("Prod 72", "default", "execution") == AgentName("prod-72", "default", "execution") {
		t.Fatal("two namespaces produced the same agent name")
	}
}

// A long namespace must not crowd out the organization digest or push the name
// past what the Gateway accepts.
func TestOpenClawAgentNameBoundsALongNamespace(t *testing.T) {
	name := AgentName(strings.Repeat("deployment-", 20), strings.Repeat("9", 64), "authoring")
	if !agentNamePattern.MatchString(name) || len(name) > maxAgentNameLength {
		t.Fatalf("AgentName produced %q (%d chars)", name, len(name))
	}
}
