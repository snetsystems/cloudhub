package mcpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/snetsystems/cloudhub-skill-admin-mcp/internal/skilldir"
)

type stubService struct{}

func (stubService) Delete(context.Context, skilldir.DeleteInput) (skilldir.DeleteResult, error) {
	return skilldir.DeleteResult{}, nil
}

func (stubService) DeleteWorkspace(context.Context, skilldir.DeleteWorkspaceInput) (skilldir.DeleteWorkspaceResult, error) {
	return skilldir.DeleteWorkspaceResult{}, nil
}

type recordingService struct {
	stubService
	inputs          []skilldir.DeleteInput
	workspaceInputs []skilldir.DeleteWorkspaceInput
}

func (s *recordingService) DeleteWorkspace(_ context.Context, input skilldir.DeleteWorkspaceInput) (skilldir.DeleteWorkspaceResult, error) {
	s.workspaceInputs = append(s.workspaceInputs, input)
	return skilldir.DeleteWorkspaceResult{AgentID: input.AgentID, Deleted: true, FileCount: 7}, nil
}

func (s *recordingService) Delete(_ context.Context, input skilldir.DeleteInput) (skilldir.DeleteResult, error) {
	s.inputs = append(s.inputs, input)
	return skilldir.DeleteResult{
		AgentID:   input.AgentID,
		SkillName: input.SkillName,
		Path:      "/workspaces/main/skills/" + input.SkillName,
		Deleted:   true,
		FileCount: 3,
	}, nil
}

type failingService struct{ stubService }

func (failingService) Delete(context.Context, skilldir.DeleteInput) (skilldir.DeleteResult, error) {
	return skilldir.DeleteResult{}, &skilldir.Error{
		Code:    skilldir.ErrorInvalidAgentID,
		Message: `agent id "nope!" is not a valid workspace directory name`,
	}
}

type bearerTransport struct {
	base  http.RoundTripper
	token string
}

func (t bearerTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	requestCopy := request.Clone(request.Context())
	requestCopy.Header.Set("Authorization", "Bearer "+t.token)
	return t.base.RoundTrip(requestCopy)
}

func connect(t *testing.T, handler http.Handler, token string) (*mcp.ClientSession, context.Context) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	t.Cleanup(cancel)

	client := mcp.NewClient(&mcp.Implementation{Name: "mcpserver-test", Version: "v0.1.0"}, nil)
	session, err := client.Connect(ctx, &mcp.StreamableClientTransport{
		Endpoint:             server.URL + "/mcp",
		HTTPClient:           &http.Client{Transport: bearerTransport{base: http.DefaultTransport, token: token}},
		DisableStandaloneSSE: true,
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { session.Close() })
	return session, ctx
}

// This fails if the server ever advertises more than the one destructive tool
// it is supposed to expose, or drops the annotations that tell a caller the
// tool deletes things.
func TestHandlerAdvertisesExactlyTheDeleteTools(t *testing.T) {
	session, ctx := connect(t, NewHandler(stubService{}, "secret"), "secret")

	result, err := session.ListTools(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	names := make([]string, 0, len(result.Tools))
	for _, tool := range result.Tools {
		names = append(names, tool.Name)
	}
	sort.Strings(names)
	want := []string{"delete_agent_workspace", "delete_workspace_skill"}
	if strings.Join(names, ",") != strings.Join(want, ",") {
		t.Fatalf("tools = %v, want %v", names, want)
	}
	// Both tools delete things and both are safe to repeat. A caller that
	// cannot see that from the annotations may treat them as ordinary reads.
	for _, tool := range result.Tools {
		annotations := tool.Annotations
		if annotations == nil || annotations.DestructiveHint == nil || !*annotations.DestructiveHint {
			t.Fatalf("%s DestructiveHint = %#v, want true", tool.Name, annotations)
		}
		if !annotations.IdempotentHint {
			t.Fatalf("%s IdempotentHint = false, want true", tool.Name)
		}
		if annotations.OpenWorldHint == nil || *annotations.OpenWorldHint {
			t.Fatalf("%s OpenWorldHint = %#v, want false", tool.Name, annotations.OpenWorldHint)
		}
	}
}

// This fails if the endpoint stops requiring the service token, which would
// leave a delete tool reachable by anything that can open a socket.
func TestHandlerRequiresTheBearerToken(t *testing.T) {
	server := httptest.NewServer(NewHandler(stubService{}, "secret"))
	defer server.Close()

	healthResponse, err := http.Get(server.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	healthResponse.Body.Close()
	if healthResponse.StatusCode != http.StatusOK {
		t.Fatalf("health status = %d, want 200", healthResponse.StatusCode)
	}

	for _, authorization := range []string{"", "Bearer wrong-token"} {
		request, err := http.NewRequest(http.MethodPost, server.URL+"/mcp", strings.NewReader(`{}`))
		if err != nil {
			t.Fatal(err)
		}
		request.Header.Set("Content-Type", "application/json")
		if authorization != "" {
			request.Header.Set("Authorization", authorization)
		}
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode != http.StatusUnauthorized {
			t.Errorf("Authorization %q status = %d, want 401", authorization, response.StatusCode)
		}
	}
}

// This fails if the tool stops forwarding the caller's arguments, which would
// silently delete the wrong skill or the right skill in the wrong workspace.
func TestDeleteToolForwardsItsArguments(t *testing.T) {
	service := &recordingService{}
	session, ctx := connect(t, NewHandler(service, "secret"), "secret")

	result, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name:      "delete_workspace_skill",
		Arguments: map[string]any{"agentId": "main", "skillName": "cpu-report"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.IsError {
		t.Fatalf("tool reported an error: %#v", result.Content)
	}
	if len(service.inputs) != 1 {
		t.Fatalf("service calls = %d, want 1", len(service.inputs))
	}
	if service.inputs[0].AgentID != "main" || service.inputs[0].SkillName != "cpu-report" {
		t.Fatalf("forwarded input = %#v", service.inputs[0])
	}
}

// This fails if a refusal stops carrying its error code, which is what lets
// CloudHub tell "agent not configured" apart from "delete failed".
func TestDeleteToolReportsStructuredErrors(t *testing.T) {
	session, ctx := connect(t, NewHandler(failingService{}, "secret"), "secret")

	result, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name:      "delete_workspace_skill",
		Arguments: map[string]any{"agentId": "nope", "skillName": "cpu-report"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !result.IsError {
		t.Fatal("IsError = false, want true")
	}
	text, ok := result.Content[0].(*mcp.TextContent)
	if !ok {
		t.Fatalf("content = %#v, want text", result.Content[0])
	}
	var decoded toolErrorOutput
	if err := json.Unmarshal([]byte(text.Text), &decoded); err != nil {
		t.Fatalf("decode %q: %v", text.Text, err)
	}
	if decoded.Error.Code != skilldir.ErrorInvalidAgentID {
		t.Fatalf("code = %q, want %q", decoded.Error.Code, skilldir.ErrorInvalidAgentID)
	}
}

// This fails if the workspace tool stops forwarding the agent it was given,
// which would reclaim the wrong organization's workspace.
func TestDeleteWorkspaceToolForwardsItsArgument(t *testing.T) {
	service := &recordingService{}
	session, ctx := connect(t, NewHandler(service, "secret"), "secret")

	result, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name:      "delete_agent_workspace",
		Arguments: map[string]any{"agentId": "cloudhub-org-1-execution"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.IsError {
		t.Fatalf("tool reported an error: %#v", result.Content)
	}
	if len(service.workspaceInputs) != 1 {
		t.Fatalf("workspace calls = %d, want 1", len(service.workspaceInputs))
	}
	if service.workspaceInputs[0].AgentID != "cloudhub-org-1-execution" {
		t.Fatalf("forwarded input = %#v", service.workspaceInputs[0])
	}
}
