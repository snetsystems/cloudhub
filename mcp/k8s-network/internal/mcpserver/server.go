package mcpserver

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/snetsystems/cloudhub-k8s-network-mcp/internal/repair"
)

type RepairService interface {
	Inspect(context.Context, repair.InspectInput) (repair.InspectResult, error)
	Repair(context.Context, repair.RepairInput) (repair.RepairResult, error)
}

type toolError struct {
	Code    repair.ErrorCode `json:"code"`
	Message string           `json:"message"`
}

type toolErrorOutput struct {
	Error toolError `json:"error"`
}

func NewHandler(service RepairService, serviceToken string) http.Handler {
	server := mcp.NewServer(
		&mcp.Implementation{Name: "k8s-network", Version: "v0.1.0"},
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

func registerTools(server *mcp.Server, service RepairService) {
	mcp.AddTool[repair.InspectInput, any](
		server,
		&mcp.Tool{
			Name:        "inspect_network_policy_path",
			Description: "Inspect a workload-to-service path and find supported NetworkPolicy port mismatches without changing Kubernetes.",
			Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true},
		},
		func(ctx context.Context, _ *mcp.CallToolRequest, input repair.InspectInput) (*mcp.CallToolResult, any, error) {
			result, err := service.Inspect(ctx, input)
			if err != nil {
				return failureResult(err), nil, nil
			}
			return nil, result, nil
		},
	)
	destructive := true
	closedWorld := false
	mcp.AddTool[repair.RepairInput, any](
		server,
		&mcp.Tool{
			Name:        "repair_network_policy_port",
			Description: "After CloudHub approval, re-inspect, apply, and verify one supported NetworkPolicy port repair without external plan state.",
			Annotations: &mcp.ToolAnnotations{
				DestructiveHint: &destructive,
				IdempotentHint:  true,
				OpenWorldHint:   &closedWorld,
			},
		},
		func(ctx context.Context, _ *mcp.CallToolRequest, input repair.RepairInput) (*mcp.CallToolResult, any, error) {
			result, err := service.Repair(ctx, input)
			if err != nil {
				return failureResult(err), nil, nil
			}
			return nil, result, nil
		},
	)
}

func failureResult(err error) *mcp.CallToolResult {
	code := repair.ErrorCodeOf(err)
	if code == "" {
		code = repair.ErrorCloudHubProxyUnavailable
	}
	message := string(code)
	var serviceErr *repair.ServiceError
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
