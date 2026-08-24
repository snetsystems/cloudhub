package openclaw

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// newSkillAdminServer stands in for the skill-admin MCP server. It records the
// arguments it was called with and returns whatever the caller asked it to.
func newSkillAdminServer(t *testing.T, token string, respond func(map[string]any) (any, error)) (*httptest.Server, *[]map[string]any) {
	t.Helper()
	var received []map[string]any

	server := mcp.NewServer(&mcp.Implementation{Name: "skill-admin", Version: "test"}, nil)
	mcp.AddTool[map[string]any, any](
		server,
		&mcp.Tool{Name: deleteWorkspaceSkillTool, Description: "test double"},
		func(_ context.Context, _ *mcp.CallToolRequest, input map[string]any) (*mcp.CallToolResult, any, error) {
			received = append(received, input)
			result, err := respond(input)
			if err != nil {
				return &mcp.CallToolResult{
					Content: []mcp.Content{&mcp.TextContent{Text: err.Error()}},
					IsError: true,
				}, nil, nil
			}
			return nil, result, nil
		},
	)

	streamable := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return server }, nil)
	mux := http.NewServeMux()
	mux.Handle("/mcp", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if token != "" && r.Header.Get("Authorization") != "Bearer "+token {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		streamable.ServeHTTP(w, r)
	}))
	httpServer := httptest.NewServer(mux)
	t.Cleanup(httpServer.Close)
	return httpServer, &received
}

// This fails if Delete stops naming the skill and the workspace it is deleting
// from. agentId is what scopes the deletion: without it the wrong
// organization's copy of a skill would be removed.
func TestSkillDeleterSendsTheAgentAndSkill(t *testing.T) {
	server, received := newSkillAdminServer(t, "secret", func(map[string]any) (any, error) {
		return map[string]any{"deleted": true, "fileCount": 2}, nil
	})

	deleter, err := NewSkillDeleter(server.URL+"/mcp", "secret")
	if err != nil {
		t.Fatalf("NewSkillDeleter: %v", err)
	}
	if err := deleter.Delete(context.Background(), "agent-1", "cpu-report"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if len(*received) != 1 {
		t.Fatalf("tool calls = %d, want 1", len(*received))
	}
	call := (*received)[0]
	if call["agentId"] != "agent-1" || call["skillName"] != "cpu-report" {
		t.Fatalf("arguments = %#v", call)
	}
}

// Retiring a skill that is already gone is a success. The server reports it as
// deleted:false, and treating that as an error would make a retried retirement
// look broken.
func TestSkillDeleterAcceptsAnAlreadyAbsentSkill(t *testing.T) {
	server, _ := newSkillAdminServer(t, "secret", func(map[string]any) (any, error) {
		return map[string]any{"deleted": false, "fileCount": 0}, nil
	})

	deleter, err := NewSkillDeleter(server.URL+"/mcp", "secret")
	if err != nil {
		t.Fatalf("NewSkillDeleter: %v", err)
	}
	if err := deleter.Delete(context.Background(), "agent-1", "cpu-report"); err != nil {
		t.Fatalf("Delete(absent skill) = %v, want success", err)
	}
}

// A refused deletion arrives as a tool result flagged IsError, not as a
// transport failure. Missing that would mark a skill retired in CloudHub while
// its files stayed in the workspace.
func TestSkillDeleterReportsAToolRefusal(t *testing.T) {
	server, _ := newSkillAdminServer(t, "secret", func(map[string]any) (any, error) {
		return nil, errAdminRefusal{}
	})

	deleter, err := NewSkillDeleter(server.URL+"/mcp", "secret")
	if err != nil {
		t.Fatalf("NewSkillDeleter: %v", err)
	}
	err = deleter.Delete(context.Background(), "agent-1", "cpu-report")
	if err == nil {
		t.Fatal("Delete succeeded despite a tool error")
	}
	if !strings.Contains(err.Error(), "unknown_agent") {
		t.Fatalf("error = %v, want the tool's message", err)
	}
}

type errAdminRefusal struct{}

func (errAdminRefusal) Error() string {
	return `{"error":{"code":"unknown_agent","message":"agent has no configured workspace"}}`
}

// The bearer token is the only thing standing between the network and a tool
// that deletes files.
func TestSkillDeleterFailsWithoutTheRightToken(t *testing.T) {
	server, _ := newSkillAdminServer(t, "secret", func(map[string]any) (any, error) {
		return map[string]any{"deleted": true}, nil
	})

	deleter, err := NewSkillDeleter(server.URL+"/mcp", "wrong-token")
	if err != nil {
		t.Fatalf("NewSkillDeleter: %v", err)
	}
	if err := deleter.Delete(context.Background(), "agent-1", "cpu-report"); err == nil {
		t.Fatal("Delete succeeded with the wrong token")
	}
}

func TestNewSkillDeleterRejectsAnUnusableEndpoint(t *testing.T) {
	for _, endpoint := range []string{"", "   ", "not-a-url", "ftp://host/mcp"} {
		if _, err := NewSkillDeleter(endpoint, "secret"); err == nil {
			t.Fatalf("NewSkillDeleter(%q) succeeded, want an error", endpoint)
		}
	}
}

// Deleting is rare, so the client connects per call rather than holding a
// session open. This fails if a call leaks state that breaks the next one.
func TestSkillDeleterHandlesConsecutiveCalls(t *testing.T) {
	server, received := newSkillAdminServer(t, "secret", func(map[string]any) (any, error) {
		return map[string]any{"deleted": true}, nil
	})

	deleter, err := NewSkillDeleter(server.URL+"/mcp", "secret")
	if err != nil {
		t.Fatalf("NewSkillDeleter: %v", err)
	}
	for _, name := range []string{"first-skill", "second-skill"} {
		if err := deleter.Delete(context.Background(), "agent-1", name); err != nil {
			t.Fatalf("Delete(%s): %v", name, err)
		}
	}
	if len(*received) != 2 {
		t.Fatalf("tool calls = %d, want 2", len(*received))
	}
	encoded, _ := json.Marshal(*received)
	if !strings.Contains(string(encoded), "second-skill") {
		t.Fatalf("second call never arrived: %s", encoded)
	}
}
