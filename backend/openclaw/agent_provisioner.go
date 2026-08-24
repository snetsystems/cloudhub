package openclaw

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"path"
	"regexp"
	"strings"
)

// maxAgentNameLength bounds the directory name the workspace root gets.
const maxAgentNameLength = 100

// agentNamePattern is what the Gateway accepts unchanged. It slugifies the
// name it is given, so producing a name that is already a slug is what makes
// the returned agent id predictable.
var agentNamePattern = regexp.MustCompile(`^[a-z][a-z0-9-]*$`)

var agentNameUnsafe = regexp.MustCompile(`[^a-z0-9]+`)

// AgentName is the Gateway agent name for one organization and purpose.
//
// It carries a slug of the organization id so the Gateway config stays
// readable, plus a short digest of the raw id. The digest is what guarantees
// uniqueness: organization ids are not slug-safe, and two that normalized to
// the same slug would otherwise share a workspace, which is exactly the
// isolation this provisioning exists to provide.
//
// The organization's name is deliberately not part of this. It would read
// better, but the name is resolved once at provisioning and never revisited,
// so renaming the organization would leave the agent labelled with the old
// one. A label that can drift out of true is worse here than a plain id: this
// name is what an operator reads to decide which workspace belongs to whom.
func AgentName(organizationID, purpose string) string {
	slug := agentNameUnsafe.ReplaceAllString(strings.ToLower(organizationID), "-")
	slug = strings.Trim(slug, "-")
	if len(slug) > 24 {
		slug = strings.Trim(slug[:24], "-")
	}
	if slug == "" {
		slug = "org"
	}
	sum := sha256.Sum256([]byte(organizationID))
	return fmt.Sprintf("cloudhub-%s-%s-%s", slug, hex.EncodeToString(sum[:])[:8], purpose)
}

// AgentProvisioner creates the Gateway agent an organization uses, along with
// the workspace that isolates its skills.
//
// Provisioning is lazy: an organization gets a workspace the first time it
// needs one, not when it is created. Creating them up front would make
// organization creation depend on the Gateway being reachable, and would
// scaffold workspaces for organizations that never use OpenClaw.
type AgentProvisioner struct {
	rpc           SkillRPC
	workspaceRoot string
}

// NewAgentProvisioner returns a provisioner that creates agents on one Gateway
// with workspaces under workspaceRoot.
//
// workspaceRoot is an absolute path as the Gateway process sees it, not as
// CloudHub does: agents.create is what creates the directory, so a
// containerized Gateway needs its in-container path. Passing a host path fails
// with EACCES from inside the container.
func NewAgentProvisioner(rpc SkillRPC, workspaceRoot string) *AgentProvisioner {
	return &AgentProvisioner{rpc: rpc, workspaceRoot: strings.TrimSpace(workspaceRoot)}
}

// Ensure creates the named agent and returns the id the Gateway assigned.
//
// An agent that already exists is a success. Provisioning is retried whenever
// an organization has no stored mapping, so a half-finished attempt - agent
// created, mapping not yet written - must not leave the organization stuck.
func (p *AgentProvisioner) Ensure(ctx context.Context, name string) (string, error) {
	if !path.IsAbs(p.workspaceRoot) {
		return "", fmt.Errorf("openclaw: workspace root %q must be an absolute path", p.workspaceRoot)
	}
	if len(name) > maxAgentNameLength || !agentNamePattern.MatchString(name) {
		return "", fmt.Errorf("openclaw: %q is not a usable agent name", name)
	}

	raw, err := p.rpc.Call(ctx, "agents.create", map[string]interface{}{
		"name":      name,
		"workspace": path.Join(p.workspaceRoot, name),
	})
	if err != nil {
		if isAgentAlreadyExists(err) {
			return name, nil
		}
		return "", fmt.Errorf("openclaw: create agent %q: %w", name, err)
	}

	var created struct {
		AgentID string `json:"agentId"`
	}
	if err := json.Unmarshal(raw, &created); err != nil {
		return "", fmt.Errorf("%w: decode agents.create response: %v", ErrProtocol, err)
	}
	if created.AgentID == "" {
		// An empty id would be stored and later sent to the Gateway, which
		// resolves it to the default agent - another organization's workspace.
		return "", fmt.Errorf("%w: agents.create returned no agent id", ErrProtocol)
	}
	return created.AgentID, nil
}

// isAgentAlreadyExists reports whether the Gateway refused because the agent is
// already there. The Gateway signals this in the message rather than with a
// distinct code, so the text is what there is to match on.
func isAgentAlreadyExists(err error) bool {
	return strings.Contains(strings.ToLower(err.Error()), "already exists")
}

// Remove deletes an agent record from the Gateway.
//
// This does not reclaim the workspace: agents.delete drops the config entry
// and leaves the directory on disk, and the RPC has no option to change that.
// The files are removed separately, through the skill-admin server.
//
// An agent that is already gone is a success, so organization deletion can be
// retried.
func (p *AgentProvisioner) Remove(ctx context.Context, agentID string) error {
	if agentID == "" {
		return fmt.Errorf("openclaw: agent id is required")
	}
	if _, err := p.rpc.Call(ctx, "agents.delete", map[string]interface{}{"agentId": agentID}); err != nil {
		if isAgentNotFound(err) {
			return nil
		}
		return fmt.Errorf("openclaw: delete agent %q: %w", agentID, err)
	}
	return nil
}

// isAgentNotFound reports whether the Gateway refused because the agent is
// already gone. Like the create path, this is signalled in the message.
func isAgentNotFound(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "not found") || strings.Contains(message, "unknown agent")
}
