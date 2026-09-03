package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/oauth2"
	"github.com/snetsystems/cloudhub/backend/openclaw"
	"github.com/snetsystems/cloudhub/backend/roles"
)

func TestOpenClawRPCRejectsUnknownMethodWithoutGatewayCall(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	gateway := &fakeOpenClawRPCGateway{}
	svc := newOpenClawChatService(store, gateway)
	rr := httptest.NewRecorder()

	svc.OpenClawRPC(rr, openClawRequest(http.MethodPost, "/cloudhub/v2/openclaw/rpc", `{"method":"sessions.list","params":{}}`, 42, "org-a"))

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want %d: %s", rr.Code, http.StatusUnprocessableEntity, rr.Body.String())
	}
	if gateway.CallCount() != 0 {
		t.Fatalf("gateway calls = %d, want 0", gateway.CallCount())
	}
}

func TestOpenClawRPCAgentsListRelaysRawPayload(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	gateway := &fakeOpenClawRPCGateway{payload: json.RawMessage(`{"agents":[{"id":"main"}],"opaque":{"keep":true}}`)}
	svc := newOpenClawChatService(store, gateway)
	rr := httptest.NewRecorder()

	svc.OpenClawRPC(rr, openClawRequest(http.MethodPost, "/cloudhub/v2/openclaw/rpc", `{"method":"agents.list","params":{}}`, 42, "org-a"))

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", rr.Code, http.StatusOK, rr.Body.String())
	}
	if got := rr.Body.String(); !strings.Contains(got, `"opaque":{"keep":true}`) {
		t.Fatalf("response did not relay raw payload: %s", got)
	}
	if method, params := gateway.RecordedCall(); method != "agents.list" || string(params) != "{}" {
		t.Fatalf("gateway call = %q %s, want agents.list {}", method, params)
	}
}

func TestOpenClawRPCHistoryUsesOwnedStoredMapping(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{ID: "owned", OrganizationID: "org-a", UserID: "42", AgentID: "main", SessionKey: "server-session"})
	gateway := &fakeOpenClawRPCGateway{payload: json.RawMessage(`{"messages":[]}`)}
	svc := newOpenClawChatService(store, gateway)
	rr := httptest.NewRecorder()

	body := `{"method":"chat.history","sessionId":"owned","params":{"limit":50}}`
	svc.OpenClawRPC(rr, openClawRequest(http.MethodPost, "/cloudhub/v2/openclaw/rpc", body, 42, "org-a"))

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", rr.Code, http.StatusOK, rr.Body.String())
	}
	method, params := gateway.RecordedCall()
	if method != "chat.history" || !jsonObjectContains(params, `"sessionKey":"server-session"`, `"agentId":"main"`, `"limit":50`) {
		t.Fatalf("gateway call = %q %s", method, params)
	}
}

func TestOpenClawRPCHistoryRejectsSpoofedGatewayMapping(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{ID: "owned", OrganizationID: "org-a", UserID: "42", AgentID: "main", SessionKey: "server-session"})
	gateway := &fakeOpenClawRPCGateway{payload: json.RawMessage(`{"messages":[]}`)}
	svc := newOpenClawChatService(store, gateway)
	rr := httptest.NewRecorder()

	body := `{"method":"chat.history","sessionId":"owned","params":{"sessionKey":"attacker"}}`
	svc.OpenClawRPC(rr, openClawRequest(http.MethodPost, "/cloudhub/v2/openclaw/rpc", body, 42, "org-a"))

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want %d: %s", rr.Code, http.StatusUnprocessableEntity, rr.Body.String())
	}
	if gateway.CallCount() != 0 {
		t.Fatalf("gateway calls = %d, want 0", gateway.CallCount())
	}
}

func TestOpenClawRPCHistoryRejectsNonOwnedSession(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{ID: "other-user", OrganizationID: "org-a", UserID: "43", AgentID: "main", SessionKey: "server-session"})
	gateway := &fakeOpenClawRPCGateway{payload: json.RawMessage(`{"messages":[]}`)}
	svc := newOpenClawChatService(store, gateway)
	rr := httptest.NewRecorder()

	svc.OpenClawRPC(rr, openClawRequest(http.MethodPost, "/cloudhub/v2/openclaw/rpc", `{"method":"chat.history","sessionId":"other-user","params":{}}`, 42, "org-a"))

	if rr.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d: %s", rr.Code, http.StatusForbidden, rr.Body.String())
	}
	if gateway.CallCount() != 0 {
		t.Fatalf("gateway calls = %d, want 0", gateway.CallCount())
	}
}

func TestOpenClawRPCSendRequiresMemberAuthority(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{ID: "owned", OrganizationID: "org-a", UserID: "42", AgentID: "main", SessionKey: "server-session"})
	gateway := &fakeOpenClawRPCGateway{payload: json.RawMessage(`{"status":"accepted"}`)}
	svc := newOpenClawChatService(store, gateway)
	request := openClawRequest(http.MethodPost, "/cloudhub/v2/openclaw/rpc", `{"method":"chat.send","sessionId":"owned","params":{"message":"hello","idempotencyKey":"key-1"}}`, 42, "org-a")
	request = request.WithContext(context.WithValue(request.Context(), roles.ContextKey, roles.ViewerRoleName))
	rr := httptest.NewRecorder()

	svc.OpenClawRPC(rr, request)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d: %s", rr.Code, http.StatusForbidden, rr.Body.String())
	}
	if gateway.CallCount() != 0 {
		t.Fatalf("gateway calls = %d, want 0", gateway.CallCount())
	}
}

func TestOpenClawRPCSendUsesStoredMappingAndTouchesSession(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	session := &cloudhub.OpenClawSession{ID: "owned", OrganizationID: "org-a", UserID: "42", AgentID: "main", SessionKey: "server-session"}
	_, _ = store.Create(context.Background(), session)
	gateway := &fakeOpenClawRPCGateway{payload: json.RawMessage(`{"status":"accepted"}`)}
	svc := newOpenClawChatService(store, gateway)
	request := openClawRequest(http.MethodPost, "/cloudhub/v2/openclaw/rpc", `{"method":"chat.send","sessionId":"owned","params":{"message":"  hello  ","timeoutMs":50,"idempotencyKey":"key-1"}}`, 42, "org-a")
	request = request.WithContext(context.WithValue(request.Context(), roles.ContextKey, roles.MemberRoleName))
	rr := httptest.NewRecorder()

	svc.OpenClawRPC(rr, request)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", rr.Code, http.StatusOK, rr.Body.String())
	}
	method, params := gateway.RecordedCall()
	if method != "chat.send" || !jsonObjectContains(params, `"sessionKey":"server-session"`, `"agentId":"main"`, `"message":"hello"`, `"timeoutMs":50`, `"idempotencyKey":"key-1"`) {
		t.Fatalf("gateway call = %q %s", method, params)
	}
	if session.UpdatedAt.IsZero() {
		t.Fatal("successful send did not touch session")
	}
}

func TestOpenClawRPCRouteAllowsMemberButRejectsViewerSend(t *testing.T) {
	for _, tt := range []struct {
		name     string
		role     string
		wantCode int
	}{
		{name: "member", role: roles.MemberRoleName, wantCode: http.StatusOK},
		{name: "viewer", role: roles.ViewerRoleName, wantCode: http.StatusForbidden},
	} {
		t.Run(tt.name, func(t *testing.T) {
			store := newOpenClawSessionStoreContract()
			_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{ID: "owned", OrganizationID: "org-a", UserID: "42", AgentID: "main", SessionKey: "server-session"})
			gateway := &fakeOpenClawRPCGateway{payload: json.RawMessage(`{"status":"accepted"}`)}
			svc := newOpenClawChatService(store, gateway)
			user := &cloudhub.User{ID: 42, Roles: []cloudhub.Role{{Organization: "org-a", Name: tt.role}}}
			svc.Store = &Store{
				OpenClawSessionStore: store,
				OrganizationsStore: &mocks.OrganizationsStore{
					DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{ID: "org-a"}, nil
					},
					GetF: func(context.Context, cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{ID: "org-a"}, nil
					},
				},
				UsersStore: &mocks.UsersStore{
					GetF: func(context.Context, cloudhub.UserQuery) (*cloudhub.User, error) {
						return user, nil
					},
				},
			}
			handler := NewMux(MuxOpts{
				Logger:  svc.Logger,
				UseAuth: true,
				Auth: &mocks.Authenticator{Principal: oauth2.Principal{
					Subject:      "user",
					Issuer:       "test",
					Organization: "org-a",
				}},
			}, *svc)
			rr := httptest.NewRecorder()

			handler.ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/cloudhub/v2/openclaw/rpc", strings.NewReader(`{"method":"chat.send","sessionId":"owned","params":{"message":"hello","idempotencyKey":"key-1"}}`)))

			if rr.Code != tt.wantCode {
				t.Fatalf("status = %d, want %d: %s", rr.Code, tt.wantCode, rr.Body.String())
			}
			if tt.role == roles.MemberRoleName && gateway.CallCount() != 1 {
				t.Fatalf("gateway calls = %d, want 1", gateway.CallCount())
			}
			if tt.role == roles.ViewerRoleName && gateway.CallCount() != 0 {
				t.Fatalf("gateway calls = %d, want 0", gateway.CallCount())
			}
		})
	}
}

func jsonObjectContains(raw json.RawMessage, fragments ...string) bool {
	for _, fragment := range fragments {
		if !strings.Contains(string(raw), fragment) {
			return false
		}
	}
	return true
}

type fakeOpenClawRPCGateway struct {
	mu         sync.Mutex
	callMethod string
	callParams json.RawMessage
	callCount  int
	payload    json.RawMessage
	err        error
}

func (g *fakeOpenClawRPCGateway) Call(_ context.Context, method string, params interface{}) (json.RawMessage, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.callCount++
	g.callMethod = method
	g.callParams, _ = json.Marshal(params)
	return append(json.RawMessage(nil), g.payload...), g.err
}

func (g *fakeOpenClawRPCGateway) ListAgents(context.Context) (openclaw.AgentList, error) {
	return openclaw.AgentList{}, nil
}

func (g *fakeOpenClawRPCGateway) ListPluginApprovals(context.Context) ([]openclaw.PluginApproval, error) {
	return nil, nil
}

func (g *fakeOpenClawRPCGateway) ResolvePluginApproval(context.Context, openclaw.ResolvePluginApprovalParams) error {
	return nil
}

func (g *fakeOpenClawRPCGateway) History(context.Context, openclaw.HistoryParams) (openclaw.HistoryPage, error) {
	return openclaw.HistoryPage{}, nil
}

func (g *fakeOpenClawRPCGateway) SendMessage(context.Context, openclaw.SendMessageParams) (openclaw.SendMessageResult, error) {
	return openclaw.SendMessageResult{}, nil
}

func (g *fakeOpenClawRPCGateway) Subscribe(context.Context) (<-chan openclaw.GatewayEvent, error) {
	return nil, nil
}

func (g *fakeOpenClawRPCGateway) CallCount() int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.callCount
}

func (g *fakeOpenClawRPCGateway) RecordedCall() (string, json.RawMessage) {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.callMethod, append(json.RawMessage(nil), g.callParams...)
}

func (g *lifecycleGateway) Call(context.Context, string, interface{}) (json.RawMessage, error) {
	return nil, nil
}

var _ openClawGateway = (*fakeOpenClawRPCGateway)(nil)
