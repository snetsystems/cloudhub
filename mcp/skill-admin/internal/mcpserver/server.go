package mcpserver

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/snetsystems/cloudhub-skill-admin-mcp/internal/skilldir"
)

// SkillDirectoryService removes workspace skill directories and whole agent
// workspaces, and places a template's skills in a new one.
type SkillDirectoryService interface {
	Delete(context.Context, skilldir.DeleteInput) (skilldir.DeleteResult, error)
	DeleteWorkspace(context.Context, skilldir.DeleteWorkspaceInput) (skilldir.DeleteWorkspaceResult, error)
	Copy(context.Context, skilldir.CopyInput) (skilldir.CopyResult, error)
}

type toolError struct {
	Code    skilldir.ErrorCode `json:"code"`
	Message string             `json:"message"`
}

type toolErrorOutput struct {
	Error toolError `json:"error"`
}

// NewHandler serves the MCP endpoint plus a health check.
func NewHandler(service SkillDirectoryService, serviceToken string) http.Handler {
	server := mcp.NewServer(
		&mcp.Implementation{Name: "skill-admin", Version: "v0.1.0"},
		nil,
	)
	registerTools(server, service)

	streamable := mcp.NewStreamableHTTPHandler(
		func(*http.Request) *mcp.Server { return server },
		nil,
	)
	mux := http.NewServeMux()
	mux.Handle("/mcp", requireBearerToken(serviceToken, streamable))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		w.WriteHeader(http.StatusOK)
	})
	return mux
}

func registerTools(server *mcp.Server, service SkillDirectoryService) {
	destructive := true
	closedWorld := false
	mcp.AddTool[skilldir.DeleteInput, any](
		server,
		&mcp.Tool{
			Name: "delete_workspace_skill",
			Description: "Delete one skill directory from a configured agent workspace. " +
				"Succeeds when the skill is already absent. The Gateway exposes no skill-delete API; this is how a skill is retired.",
			Annotations: &mcp.ToolAnnotations{
				DestructiveHint: &destructive,
				IdempotentHint:  true,
				OpenWorldHint:   &closedWorld,
			},
		},
		func(ctx context.Context, _ *mcp.CallToolRequest, input skilldir.DeleteInput) (*mcp.CallToolResult, any, error) {
			result, err := service.Delete(ctx, input)
			if err != nil {
				return failureResult(err), nil, nil
			}
			return nil, result, nil
		},
	)
	mcp.AddTool[skilldir.DeleteWorkspaceInput, any](
		server,
		&mcp.Tool{
			Name: "delete_agent_workspace",
			Description: "Delete an agent's whole workspace directory. " +
				"Succeeds when it is already absent. Used to reclaim the workspace of a deleted organization: " +
				"the Gateway's agents.delete removes the agent record but leaves its files.",
			Annotations: &mcp.ToolAnnotations{
				DestructiveHint: &destructive,
				IdempotentHint:  true,
				OpenWorldHint:   &closedWorld,
			},
		},
		func(ctx context.Context, _ *mcp.CallToolRequest, input skilldir.DeleteWorkspaceInput) (*mcp.CallToolResult, any, error) {
			result, err := service.DeleteWorkspace(ctx, input)
			if err != nil {
				return failureResult(err), nil, nil
			}
			return nil, result, nil
		},
	)
	// Copying adds nothing and removes nothing that was already there, so it
	// is not marked destructive: a name the target already has is skipped
	// rather than overwritten, which is also what makes it idempotent.
	notDestructive := false
	mcp.AddTool[skilldir.CopyInput, any](
		server,
		&mcp.Tool{
			Name: "copy_workspace_skills",
			Description: "Copy every skill directory from one agent workspace into another, skipping names the target already has. " +
				"Used to give a newly provisioned organization its baseline skills. " +
				"The Gateway's skills.proposals API caps a description at 160 bytes; skills placed as files have no such cap, which is why these are copied rather than proposed.",
			Annotations: &mcp.ToolAnnotations{
				DestructiveHint: &notDestructive,
				IdempotentHint:  true,
				OpenWorldHint:   &closedWorld,
			},
		},
		func(ctx context.Context, _ *mcp.CallToolRequest, input skilldir.CopyInput) (*mcp.CallToolResult, any, error) {
			result, err := service.Copy(ctx, input)
			if err != nil {
				return failureResult(err), nil, nil
			}
			return nil, result, nil
		},
	)
}

func failureResult(err error) *mcp.CallToolResult {
	code := skilldir.CodeOf(err)
	if code == "" {
		code = skilldir.ErrorDeleteFailed
	}
	message := string(code)
	var serviceErr *skilldir.Error
	if errors.As(err, &serviceErr) && serviceErr.Message != "" {
		message = serviceErr.Message
	}
	output := toolErrorOutput{Error: toolError{Code: code, Message: message}}
	encoded, _ := json.Marshal(output)
	return &mcp.CallToolResult{
		Content:           []mcp.Content{&mcp.TextContent{Text: string(encoded)}},
		StructuredContent: output,
		IsError:           true,
	}
}

func requireBearerToken(serviceToken string, next http.Handler) http.Handler {
	expected := sha256.Sum256([]byte("Bearer " + serviceToken))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		provided := sha256.Sum256([]byte(r.Header.Get("Authorization")))
		if subtle.ConstantTimeCompare(provided[:], expected[:]) != 1 {
			w.Header().Set("WWW-Authenticate", "Bearer")
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
