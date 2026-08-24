package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/openclaw"
)

const (
	managedApprovalSessionID  = "11111111-1111-4111-8111-111111111111"
	managedApprovalSessionKey = "agent:main:cloudhub:org-a:42:" + managedApprovalSessionID
	managedApprovalToken      = "managed-approval-test-secret"
)

func TestOpenClawManagedApprovalInternalAPIRequiresConfiguredServiceToken(t *testing.T) {
	tests := []struct {
		name            string
		configuredToken string
		suppliedToken   string
		wantStatus      int
	}{
		{name: "empty configuration fails closed", wantStatus: http.StatusServiceUnavailable},
		{name: "missing credential", configuredToken: managedApprovalToken, wantStatus: http.StatusUnauthorized},
		{name: "wrong credential", configuredToken: managedApprovalToken, suppliedToken: "wrong-secret", wantStatus: http.StatusUnauthorized},
		{name: "matching bearer credential", configuredToken: managedApprovalToken, suppliedToken: managedApprovalToken, wantStatus: http.StatusCreated},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			handler, logger := newManagedApprovalTestHandler(t, test.configuredToken)
			request := httptest.NewRequest(http.MethodPost, "/api/v1/openclaw/managed-approvals", strings.NewReader(validManagedApprovalRequestBody()))
			if test.suppliedToken != "" {
				request.Header.Set("Authorization", "Bearer "+test.suppliedToken)
			}
			recorder := httptest.NewRecorder()

			handler.ServeHTTP(recorder, request)

			if recorder.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d: %s", recorder.Code, test.wantStatus, recorder.Body.String())
			}
			for _, message := range logger.Messages {
				body := strings.ToLower(message.Body)
				if strings.Contains(message.Body, managedApprovalToken) || strings.Contains(message.Body, "wrong-secret") || strings.Contains(body, "token") {
					t.Fatalf("log exposed token or token metadata: %#v", message)
				}
			}
		})
	}
}

func TestOpenClawManagedApprovalRejectsCollectorToken(t *testing.T) {
	logger := &mocks.TestLogger{}
	service, _ := newManagedApprovalTestService(t, "different-mcp-secret")
	service.Logger = logger
	service.InternalENV.KubernetesConfig.CollectorAuthToken = managedApprovalToken
	handler := NewMux(MuxOpts{Logger: logger, DisableGZip: true}, *service)

	recorder := performManagedApprovalRequest(handler, http.MethodPost, "/api/v1/openclaw/managed-approvals", validManagedApprovalRequestBody())

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d: %s", recorder.Code, http.StatusUnauthorized, recorder.Body.String())
	}
}

func TestOpenClawManagedApprovalCreateValidatesSessionAndTool(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantStatus int
	}{
		{name: "valid request", body: validManagedApprovalRequestBody(), wantStatus: http.StatusCreated},
		{
			name:       "valid qualified request",
			body:       strings.Replace(validManagedApprovalRequestBody(), "k8s_network__repair_network_policy_port", "mcp__k8s_network__repair_network_policy_port", 1),
			wantStatus: http.StatusCreated,
		},
		{
			name:       "unknown session",
			body:       strings.Replace(validManagedApprovalRequestBody(), managedApprovalSessionID, "22222222-2222-4222-8222-222222222222", 1),
			wantStatus: http.StatusUnprocessableEntity,
		},
		{
			name:       "unsupported unqualified legacy tool",
			body:       strings.Replace(validManagedApprovalRequestBody(), "k8s_network__repair_network_policy_port", "k8s_network__apply_network_policy_repair", 1),
			wantStatus: http.StatusUnprocessableEntity,
		},
		{
			name:       "unsupported qualified legacy tool",
			body:       strings.Replace(validManagedApprovalRequestBody(), "k8s_network__repair_network_policy_port", "mcp__k8s_network__apply_network_policy_repair", 1),
			wantStatus: http.StatusUnprocessableEntity,
		},
		{
			name:       "unsupported shell tool",
			body:       strings.Replace(validManagedApprovalRequestBody(), "k8s_network__repair_network_policy_port", "shell", 1),
			wantStatus: http.StatusUnprocessableEntity,
		},
		{
			name:       "missing stable identity",
			body:       strings.Replace(validManagedApprovalRequestBody(), `"toolCallId":"tool-call-1"`, `"toolCallId":""`, 1),
			wantStatus: http.StatusUnprocessableEntity,
		},
		{
			name:       "wrong timeout",
			body:       strings.Replace(validManagedApprovalRequestBody(), `"timeoutMs":120000`, `"timeoutMs":60000`, 1),
			wantStatus: http.StatusUnprocessableEntity,
		},
		{
			name:       "unknown field",
			body:       strings.Replace(validManagedApprovalRequestBody(), `"timeoutMs":120000`, `"timeoutMs":120000,"extra":true`, 1),
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			handler, _ := newManagedApprovalTestHandler(t, managedApprovalToken)
			recorder := performManagedApprovalRequest(handler, http.MethodPost, "/api/v1/openclaw/managed-approvals", test.body)
			if recorder.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d: %s", recorder.Code, test.wantStatus, recorder.Body.String())
			}
		})
	}
}

func TestOpenClawManagedApprovalCreateReturnsExistingRecordForRetry(t *testing.T) {
	handler, _ := newManagedApprovalTestHandler(t, managedApprovalToken)
	first := performManagedApprovalRequest(handler, http.MethodPost, "/api/v1/openclaw/managed-approvals", validManagedApprovalRequestBody())
	second := performManagedApprovalRequest(handler, http.MethodPost, "/api/v1/openclaw/managed-approvals", validManagedApprovalRequestBody())

	if first.Code != http.StatusCreated || second.Code != http.StatusOK {
		t.Fatalf("statuses = (%d, %d), want (201, 200): %s / %s", first.Code, second.Code, first.Body.String(), second.Body.String())
	}
	var firstResponse, secondResponse openClawManagedApprovalStatusResponse
	if err := json.NewDecoder(first.Body).Decode(&firstResponse); err != nil {
		t.Fatal(err)
	}
	if err := json.NewDecoder(second.Body).Decode(&secondResponse); err != nil {
		t.Fatal(err)
	}
	if firstResponse.ID == "" || firstResponse.ID != secondResponse.ID {
		t.Fatalf("approval IDs = (%q, %q), want one stable ID", firstResponse.ID, secondResponse.ID)
	}
}

func TestOpenClawManagedApprovalCreatePublishesRequestedEventOnlyOnce(t *testing.T) {
	service, _ := newManagedApprovalTestService(t, managedApprovalToken)
	gatewayEvents := make(chan openclaw.GatewayEvent)
	t.Cleanup(func() { close(gatewayEvents) })
	service.OpenClawGateway = &fakeOpenClawGateway{events: gatewayEvents}
	events := subscribeManagedApprovalEvents(t, service)

	first := httptest.NewRecorder()
	service.OpenClawManagedApprovalCreate(first, httptest.NewRequest(http.MethodPost, "/api/v1/openclaw/managed-approvals", strings.NewReader(validManagedApprovalRequestBody())))
	if first.Code != http.StatusCreated {
		t.Fatalf("first status = %d, want 201: %s", first.Code, first.Body.String())
	}
	event := readManagedApprovalEvent(t, events)
	if event.Kind != openclaw.EventApprovalRequested || event.SessionKey != managedApprovalSessionKey {
		t.Fatalf("event = %#v", event)
	}
	if event.Approval == nil || event.Approval.ID == "" || event.Approval.ToolName != "k8s_network__repair_network_policy_port" {
		t.Fatalf("approval = %#v", event.Approval)
	}
	assertManagedApprovalEventPublic(t, event)

	second := httptest.NewRecorder()
	service.OpenClawManagedApprovalCreate(second, httptest.NewRequest(http.MethodPost, "/api/v1/openclaw/managed-approvals", strings.NewReader(validManagedApprovalRequestBody())))
	if second.Code != http.StatusOK {
		t.Fatalf("retry status = %d, want 200: %s", second.Code, second.Body.String())
	}
	assertNoManagedApprovalEvent(t, events)
}

func TestOpenClawManagedApprovalCreateMapsSessionStoreFailure(t *testing.T) {
	logger := &mocks.TestLogger{}
	service := Service{
		Store: &Store{OpenClawSessionStore: &failingOpenClawSessionStore{
			OpenClawSessionStore: newOpenClawSessionStoreContract(),
		}},
		Logger:                   logger,
		openClawManagedApprovals: newOpenClawManagedApprovalStore(nil),
		InternalENV:              cloudhub.InternalEnvironment{MCPAuthToken: managedApprovalToken},
	}
	handler := NewMux(MuxOpts{Logger: logger, DisableGZip: true}, service)

	recorder := performManagedApprovalRequest(handler, http.MethodPost, "/api/v1/openclaw/managed-approvals", validManagedApprovalRequestBody())

	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502: %s", recorder.Code, recorder.Body.String())
	}
}

func TestOpenClawManagedApprovalStatusReturnsOnlyStateAndTimestamps(t *testing.T) {
	handler, _ := newManagedApprovalTestHandler(t, managedApprovalToken)
	created := performManagedApprovalRequest(handler, http.MethodPost, "/api/v1/openclaw/managed-approvals", validManagedApprovalRequestBody())
	if created.Code != http.StatusCreated {
		t.Fatalf("create status = %d: %s", created.Code, created.Body.String())
	}
	var createResponse openClawManagedApprovalStatusResponse
	if err := json.NewDecoder(created.Body).Decode(&createResponse); err != nil {
		t.Fatal(err)
	}

	status := performManagedApprovalRequest(handler, http.MethodGet, "/api/v1/openclaw/managed-approvals/"+createResponse.ID, "")
	if status.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", status.Code, status.Body.String())
	}
	var response map[string]interface{}
	if err := json.NewDecoder(status.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	wantKeys := []string{"id", "state", "createdAt", "expiresAt"}
	if len(response) != len(wantKeys) {
		t.Fatalf("response fields = %#v, want only %v", response, wantKeys)
	}
	for _, key := range wantKeys {
		if _, ok := response[key]; !ok {
			t.Fatalf("response omitted %q: %#v", key, response)
		}
	}
	if response["id"] != createResponse.ID || response["state"] != string(openClawManagedApprovalPending) {
		t.Fatalf("response = %#v", response)
	}
	for _, sensitive := range []string{managedApprovalSessionKey, managedApprovalToken, "toolCallId", "toolName", "title", "description"} {
		if strings.Contains(status.Body.String(), sensitive) {
			t.Fatalf("status response exposed %q: %s", sensitive, status.Body.String())
		}
	}
}

func newManagedApprovalTestHandler(t *testing.T, configuredToken string) (http.Handler, *mocks.TestLogger) {
	t.Helper()
	service, logger := newManagedApprovalTestService(t, configuredToken)
	return NewMux(MuxOpts{Logger: logger, DisableGZip: true}, *service), logger
}

func newManagedApprovalTestService(t *testing.T, configuredToken string) (*Service, *mocks.TestLogger) {
	t.Helper()
	store := newOpenClawSessionStoreContract()
	_, err := store.Create(context.Background(), &cloudhub.OpenClawSession{
		ID:             managedApprovalSessionID,
		OrganizationID: "org-a",
		UserID:         "42",
		AgentID:        "main",
		SessionKey:     managedApprovalSessionKey,
	})
	if err != nil {
		t.Fatal(err)
	}
	logger := &mocks.TestLogger{}
	service := &Service{
		Store:                    &Store{OpenClawSessionStore: store},
		Logger:                   logger,
		openClawManagedApprovals: newOpenClawManagedApprovalStore(nil),
		InternalENV:              cloudhub.InternalEnvironment{MCPAuthToken: configuredToken},
	}
	return service, logger
}

func subscribeManagedApprovalEvents(t *testing.T, service *Service) <-chan openclaw.GatewayEvent {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	events, _, unsubscribe, err := service.openClawEventFanout().Subscribe(ctx)
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	t.Cleanup(unsubscribe)
	t.Cleanup(cancel)
	return events
}

func readManagedApprovalEvent(t *testing.T, events <-chan openclaw.GatewayEvent) openclaw.GatewayEvent {
	t.Helper()
	select {
	case event := <-events:
		return event
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for managed approval event")
		return openclaw.GatewayEvent{}
	}
}

func assertNoManagedApprovalEvent(t *testing.T, events <-chan openclaw.GatewayEvent) {
	t.Helper()
	select {
	case event := <-events:
		t.Fatalf("unexpected managed approval event = %#v", event)
	case <-time.After(100 * time.Millisecond):
	}
}

func assertManagedApprovalEventPublic(t *testing.T, event openclaw.GatewayEvent) {
	t.Helper()
	response := openClawEventResponse(managedApprovalSessionID, event)
	if response.Approval == nil || response.Approval.Source != openClawApprovalSourceManaged {
		t.Fatalf("managed approval event source = %#v", response.Approval)
	}
	payload, err := json.Marshal(response)
	if err != nil {
		t.Fatal(err)
	}
	for _, sensitive := range []string{"sessionKey", "toolCallId", "idempotencyKey", managedApprovalToken} {
		if strings.Contains(string(payload), sensitive) {
			t.Fatalf("public event exposed %q: %s", sensitive, payload)
		}
	}
}

func performManagedApprovalRequest(handler http.Handler, method, target, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, target, strings.NewReader(body))
	request.Header.Set("Authorization", "Bearer "+managedApprovalToken)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

func validManagedApprovalRequestBody() string {
	return `{
		"sessionKey":"` + managedApprovalSessionKey + `",
		"toolName":"k8s_network__repair_network_policy_port",
		"toolCallId":"tool-call-1",
		"idempotencyKey":"",
		"title":"NetworkPolicy recovery approval",
		"description":"network-repair-demo/policy TCP 8081 to 8080",
		"severity":"warning",
		"timeoutMs":120000
	}`
}

type failingOpenClawSessionStore struct {
	cloudhub.OpenClawSessionStore
}

func (s *failingOpenClawSessionStore) Get(context.Context, string) (*cloudhub.OpenClawSession, error) {
	return nil, errors.New("session store unavailable")
}
