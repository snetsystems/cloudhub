package openclaw

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// The tools the skill-admin MCP server exposes. See mcp/skill-admin.
const (
	deleteWorkspaceSkillTool = "delete_workspace_skill"
	deleteAgentWorkspaceTool = "delete_agent_workspace"
)

// skillDeleterTimeout bounds one delete, connection included.
const skillDeleterTimeout = 30 * time.Second

// SkillDeleter removes a skill directory from a Gateway agent workspace by
// calling the skill-admin MCP server directly.
//
// It does not go through the Gateway. MCP tools only enter an agent's tool set
// once that agent's runtime has connected the MCP transport, which happens on
// an agent turn: until then the Gateway reports the tool as unavailable. Making
// retirement depend on an agent having recently run a turn would mean
// retirement starts failing after a Gateway restart, so CloudHub talks to the
// server itself.
//
// Not registering the tool with the Gateway also means no agent can reach it.
type SkillDeleter struct {
	endpoint   string
	token      string
	httpClient *http.Client
}

// NewSkillDeleter returns a deleter for one skill-admin server. endpoint is the
// server's MCP URL; token is the bearer token it requires.
func NewSkillDeleter(endpoint, token string) (*SkillDeleter, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return nil, fmt.Errorf("openclaw: skill-admin endpoint is required")
	}
	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, fmt.Errorf("openclaw: skill-admin endpoint %q must be an absolute HTTP or HTTPS URL", endpoint)
	}
	return &SkillDeleter{
		endpoint:   endpoint,
		token:      strings.TrimSpace(token),
		httpClient: &http.Client{Timeout: skillDeleterTimeout},
	}, nil
}

// bearerTransport attaches the service token to every request.
type bearerTransport struct {
	base  http.RoundTripper
	token string
}

func (t bearerTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	base := t.base
	if base == nil {
		base = http.DefaultTransport
	}
	if t.token == "" {
		return base.RoundTrip(request)
	}
	requestCopy := request.Clone(request.Context())
	requestCopy.Header.Set("Authorization", "Bearer "+t.token)
	return base.RoundTrip(requestCopy)
}

// Delete removes skillName from agentID's workspace.
//
// Deleting a skill that is already gone succeeds: the server reports it as
// deleted:false, and a retried retirement must not look like a failure.
//
// A connection is opened per call. Retirement is rare, and a short-lived
// session keeps this from holding a socket open for the process lifetime.
func (d *SkillDeleter) Delete(ctx context.Context, agentID, skillName string) error {
	return d.call(ctx, deleteWorkspaceSkillTool, map[string]any{
		"agentId":   agentID,
		"skillName": skillName,
	}, fmt.Sprintf("delete skill %q", skillName))
}

// DeleteWorkspace removes an agent's whole workspace directory.
//
// This reclaims the disk an organization's agent used. The Gateway's
// agents.delete removes the agent record but leaves its files behind, so
// without this a deleted organization's workspace stays on the host forever.
//
// A workspace that is already gone succeeds: an organization that never used
// OpenClaw has none, and deletion may be retried.
func (d *SkillDeleter) DeleteWorkspace(ctx context.Context, agentID string) error {
	return d.call(ctx, deleteAgentWorkspaceTool, map[string]any{
		"agentId": agentID,
	}, fmt.Sprintf("delete workspace for agent %q", agentID))
}

// call opens a session, invokes one tool, and closes. Deleting is rare, so a
// short-lived session avoids holding a socket for the process lifetime.
func (d *SkillDeleter) call(ctx context.Context, tool string, arguments map[string]any, what string) error {
	ctx, cancel := context.WithTimeout(ctx, skillDeleterTimeout)
	defer cancel()

	session, err := d.connect(ctx)
	if err != nil {
		return fmt.Errorf("openclaw: %s: connect to skill-admin: %w", what, err)
	}
	defer session.Close()

	result, err := session.CallTool(ctx, &mcp.CallToolParams{Name: tool, Arguments: arguments})
	if err != nil {
		return fmt.Errorf("openclaw: %s: %w", what, err)
	}
	if result.IsError {
		return fmt.Errorf("openclaw: %s: %s", what, toolResultMessage(result))
	}
	return nil
}

// connect opens one MCP session to the skill-admin server.
func (d *SkillDeleter) connect(ctx context.Context) (*mcp.ClientSession, error) {
	httpClient := &http.Client{
		Timeout:   d.httpClient.Timeout,
		Transport: bearerTransport{base: http.DefaultTransport, token: d.token},
	}
	client := mcp.NewClient(&mcp.Implementation{Name: "cloudhub", Version: "v1"}, nil)
	return client.Connect(ctx, &mcp.StreamableClientTransport{
		Endpoint:             d.endpoint,
		HTTPClient:           httpClient,
		DisableStandaloneSSE: true,
	}, nil)
}

// toolResultMessage pulls a readable message out of a failed tool result. The
// server sends a JSON error envelope, but a transport-level refusal can arrive
// as plain text, so the raw text is the fallback.
func toolResultMessage(result *mcp.CallToolResult) string {
	for _, content := range result.Content {
		text, ok := content.(*mcp.TextContent)
		if !ok || text.Text == "" {
			continue
		}
		var envelope struct {
			Error struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := json.Unmarshal([]byte(text.Text), &envelope); err == nil && envelope.Error.Code != "" {
			if envelope.Error.Message != "" {
				return fmt.Sprintf("%s (%s)", envelope.Error.Message, envelope.Error.Code)
			}
			return envelope.Error.Code
		}
		return text.Text
	}
	return "the skill-admin server refused the call"
}
