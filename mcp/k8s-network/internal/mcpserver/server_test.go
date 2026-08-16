package mcpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/snetsystems/cloudhub-k8s-network-mcp/internal/repair"
)

type stubRepairService struct{}

func (stubRepairService) Inspect(context.Context, repair.InspectInput) (repair.InspectResult, error) {
	return repair.InspectResult{}, nil
}

func (stubRepairService) Repair(context.Context, repair.RepairInput) (repair.RepairResult, error) {
	return repair.RepairResult{}, nil
}

type recordingRepairService struct {
	inspectInputs []repair.InspectInput
	repairInputs  []repair.RepairInput
}

func (s *recordingRepairService) Inspect(_ context.Context, in repair.InspectInput) (repair.InspectResult, error) {
	s.inspectInputs = append(s.inspectInputs, in)
	return repair.InspectResult{Namespace: in.Namespace}, nil
}

func (s *recordingRepairService) Repair(_ context.Context, in repair.RepairInput) (repair.RepairResult, error) {
	s.repairInputs = append(s.repairInputs, in)
	return repair.RepairResult{Namespace: in.Namespace, PolicyName: in.PolicyName, CurrentPort: in.DesiredPort}, nil
}

type failingRepairService struct{ stubRepairService }

func (failingRepairService) Repair(context.Context, repair.RepairInput) (repair.RepairResult, error) {
	return repair.RepairResult{}, &repair.ServiceError{
		Code:    repair.ErrorResourceConflict,
		Message: "NetworkPolicy changed after inspection",
		Cause:   errors.New("internal-sensitive-cause"),
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

func TestHandlerRequiresBearerTokenAndListsExactTools(t *testing.T) {
	handler := NewHandler(stubRepairService{}, "mcp-service-secret")
	server := httptest.NewServer(handler)
	defer server.Close()

	healthResponse, err := http.Get(server.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	healthResponse.Body.Close()
	if healthResponse.StatusCode != http.StatusOK {
		t.Fatalf("health status = %d", healthResponse.StatusCode)
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

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	httpClient := &http.Client{Transport: bearerTransport{
		base:  http.DefaultTransport,
		token: "mcp-service-secret",
	}}
	client := mcp.NewClient(&mcp.Implementation{Name: "mcpserver-test", Version: "v0.1.0"}, nil)
	session, err := client.Connect(ctx, &mcp.StreamableClientTransport{
		Endpoint:             server.URL + "/mcp",
		HTTPClient:           httpClient,
		DisableStandaloneSSE: true,
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()

	result, err := session.ListTools(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	names := make([]string, 0, len(result.Tools))
	for _, tool := range result.Tools {
		names = append(names, tool.Name)
	}
	sort.Strings(names)
	want := []string{
		"inspect_network_policy_path",
		"repair_network_policy_port",
	}
	if strings.Join(names, "\n") != strings.Join(want, "\n") {
		t.Fatalf("tool names = %v, want %v", names, want)
	}
	var repairTool *mcp.Tool
	for _, tool := range result.Tools {
		if tool.Name == "repair_network_policy_port" {
			repairTool = tool
			break
		}
	}
	if repairTool == nil {
		t.Fatal("repair tool was not advertised")
	}
	if repairTool.Annotations == nil {
		t.Fatal("repair tool annotations are missing")
	}
	if repairTool.Annotations.DestructiveHint == nil || !*repairTool.Annotations.DestructiveHint {
		t.Fatalf("repair destructive hint = %v, want true", repairTool.Annotations.DestructiveHint)
	}
	if !repairTool.Annotations.IdempotentHint {
		t.Fatal("repair idempotent hint = false, want true")
	}
	if repairTool.Annotations.OpenWorldHint == nil || *repairTool.Annotations.OpenWorldHint {
		t.Fatalf("repair open-world hint = %v, want false", repairTool.Annotations.OpenWorldHint)
	}
}

func TestToolsCallInspectAndRepairAndReturnStructuredErrors(t *testing.T) {
	service := &recordingRepairService{}
	session, closeSession := connectTestSession(t, NewHandler(service, "mcp-service-secret"))
	defer closeSession()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	calls := []*mcp.CallToolParams{
		{Name: "inspect_network_policy_path", Arguments: map[string]any{
			"namespace": "network-repair-demo", "sourceWorkload": "frontend", "destinationService": "backend",
		}},
		{Name: "repair_network_policy_port", Arguments: map[string]any{
			"namespace": "network-repair-demo", "sourceWorkload": "frontend", "destinationService": "backend",
			"policyName": "allow", "expectedCurrentPort": 8081, "desiredPort": 8080,
		}},
	}
	for _, call := range calls {
		result, err := session.CallTool(ctx, call)
		if err != nil {
			t.Fatalf("CallTool(%s): %v", call.Name, err)
		}
		if result.IsError {
			t.Fatalf("CallTool(%s) returned tool error: %#v", call.Name, result.Content)
		}
	}
	wantInspectInputs := []repair.InspectInput{{
		Namespace: "network-repair-demo", SourceWorkload: "frontend", DestinationService: "backend",
	}}
	if !reflect.DeepEqual(service.inspectInputs, wantInspectInputs) {
		t.Fatalf("inspect inputs = %v, want %v", service.inspectInputs, wantInspectInputs)
	}
	wantRepairInputs := []repair.RepairInput{{
		Namespace: "network-repair-demo", SourceWorkload: "frontend", DestinationService: "backend",
		PolicyName: "allow", ExpectedCurrentPort: 8081, DesiredPort: 8080,
	}}
	if !reflect.DeepEqual(service.repairInputs, wantRepairInputs) {
		t.Fatalf("repair inputs = %v, want %v", service.repairInputs, wantRepairInputs)
	}

	failingSession, closeFailingSession := connectTestSession(t, NewHandler(failingRepairService{}, "mcp-service-secret"))
	defer closeFailingSession()
	result, err := failingSession.CallTool(ctx, calls[1])
	if err != nil {
		t.Fatal(err)
	}
	if !result.IsError {
		t.Fatal("failed apply did not set isError")
	}
	encoded, err := json.Marshal(result.StructuredContent)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(encoded), `"code":"resource_conflict"`) {
		t.Fatalf("structured error = %s", encoded)
	}
	if strings.Contains(string(encoded), "internal-sensitive-cause") {
		t.Fatalf("structured error exposed internal cause: %s", encoded)
	}
}

func connectTestSession(t *testing.T, handler http.Handler) (*mcp.ClientSession, func()) {
	t.Helper()
	server := httptest.NewServer(handler)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	httpClient := &http.Client{Transport: bearerTransport{
		base:  http.DefaultTransport,
		token: "mcp-service-secret",
	}}
	client := mcp.NewClient(&mcp.Implementation{Name: "mcpserver-test", Version: "v0.1.0"}, nil)
	session, err := client.Connect(ctx, &mcp.StreamableClientTransport{
		Endpoint:             server.URL + "/mcp",
		HTTPClient:           httpClient,
		DisableStandaloneSSE: true,
	}, nil)
	if err != nil {
		cancel()
		server.Close()
		t.Fatal(err)
	}
	return session, func() {
		_ = session.Close()
		cancel()
		server.Close()
	}
}
