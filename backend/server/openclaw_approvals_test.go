package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/oauth2"
	"github.com/snetsystems/cloudhub/backend/openclaw"
	"github.com/snetsystems/cloudhub/backend/roles"
)

func TestOpenClawSessionApprovalsFiltersToOwnedGatewaySession(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{
		ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned",
	})
	gateway := &fakeOpenClawGateway{approvals: []openclaw.PluginApproval{
		{
			ID: "plugin:owned", Title: "NetworkPolicy 복구 승인", Description: "demo/allow TCP 8081 → 8080",
			Severity: "warning", ToolName: "k8s_network__apply_network_policy_repair",
			AllowedDecisions: []openclaw.PluginApprovalDecision{openclaw.DecisionAllowOnce, openclaw.DecisionDeny},
			SessionKey:       "session-owned", CreatedAtMs: 1786700000000, ExpiresAtMs: 1786700120000,
		},
		{ID: "plugin:foreign", SessionKey: "session-foreign"},
	}}
	svc := newOpenClawChatService(store, gateway)
	recorder := httptest.NewRecorder()
	request := withApprovalParams(
		openClawRequest(http.MethodGet, "/cloudhub/v2/openclaw/sessions/owned/approvals", "", 42, "org-a"),
		"owned", "",
	)

	svc.OpenClawSessionApprovals(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Approvals []struct {
			ID               string                            `json:"id"`
			Source           string                            `json:"source"`
			Title            string                            `json:"title"`
			AllowedDecisions []openclaw.PluginApprovalDecision `json:"allowedDecisions"`
			CreatedAt        int64                             `json:"createdAt"`
			ExpiresAt        int64                             `json:"expiresAt"`
		} `json:"approvals"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	if len(response.Approvals) != 1 || response.Approvals[0].ID != "plugin:owned" {
		t.Fatalf("approvals = %#v", response.Approvals)
	}
	if response.Approvals[0].Title != "NetworkPolicy 복구 승인" || response.Approvals[0].CreatedAt != 1786700000000 || response.Approvals[0].ExpiresAt != 1786700120000 {
		t.Fatalf("approval = %#v", response.Approvals[0])
	}
	if response.Approvals[0].Source != "native" {
		t.Fatalf("approval source = %q, want native", response.Approvals[0].Source)
	}
	if len(response.Approvals[0].AllowedDecisions) != 2 {
		t.Fatalf("allowed decisions = %v", response.Approvals[0].AllowedDecisions)
	}
	if strings.Contains(recorder.Body.String(), "session-owned") || strings.Contains(recorder.Body.String(), "session-foreign") {
		t.Fatalf("response exposed Gateway session key: %s", recorder.Body.String())
	}
}

func TestOpenClawSessionApprovalsEnforcesOwnershipAndMapsGatewayErrors(t *testing.T) {
	tests := []struct {
		name       string
		requestID  string
		userID     uint64
		gatewayErr error
		wantStatus int
	}{
		{name: "foreign user", requestID: "owned", userID: 43, wantStatus: http.StatusForbidden},
		{name: "missing session", requestID: "missing", userID: 42, wantStatus: http.StatusNotFound},
		{name: "gateway timeout", requestID: "owned", userID: 42, gatewayErr: openclaw.ErrRequestTimeout, wantStatus: http.StatusGatewayTimeout},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			store := newOpenClawSessionStoreContract()
			_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{
				ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned",
			})
			gateway := &fakeOpenClawGateway{approvalsErr: test.gatewayErr}
			svc := newOpenClawChatService(store, gateway)
			recorder := httptest.NewRecorder()
			request := withApprovalParams(
				openClawRequest(http.MethodGet, "/approvals", "", test.userID, "org-a"),
				test.requestID, "",
			)

			svc.OpenClawSessionApprovals(recorder, request)

			if recorder.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d: %s", recorder.Code, test.wantStatus, recorder.Body.String())
			}
		})
	}
}

func TestOpenClawSessionApprovalsIncludesManagedApproval(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{
		ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned",
	})
	now := time.Date(2026, 8, 14, 7, 0, 0, 0, time.UTC)
	managedStore := newOpenClawManagedApprovalStore(func() time.Time { return now })
	managed, _, err := managedStore.Create(openClawManagedApprovalCreate{
		SessionKey: "session-owned", ToolName: "k8s_network__apply_network_policy_repair",
		ToolCallID: "tool-call-managed", Title: "Managed repair", Description: "repair policy",
		Severity: "warning", Timeout: 2 * time.Minute,
	})
	if err != nil {
		t.Fatal(err)
	}
	gateway := &fakeOpenClawGateway{approvals: []openclaw.PluginApproval{
		{
			ID: "plugin:native", SessionKey: "session-owned", Title: "Native approval",
			AllowedDecisions: []openclaw.PluginApprovalDecision{openclaw.DecisionAllowOnce},
			CreatedAtMs:      now.Add(-time.Minute).UnixMilli(), ExpiresAtMs: now.Add(time.Minute).UnixMilli(),
		},
	}}
	svc := newOpenClawChatService(store, gateway)
	svc.openClawManagedApprovals = managedStore
	recorder := httptest.NewRecorder()
	request := withApprovalParams(openClawRequest(http.MethodGet, "/approvals", "", 42, "org-a"), "owned", "")

	svc.OpenClawSessionApprovals(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", recorder.Code, recorder.Body.String())
	}
	var response openClawApprovalsResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	if len(response.Approvals) != 2 || response.Approvals[0].ID != managed.ID || response.Approvals[1].ID != "plugin:native" {
		t.Fatalf("approvals = %#v, want managed then native", response.Approvals)
	}
	if !strings.HasPrefix(response.Approvals[0].ID, "cloudhub:") ||
		len(response.Approvals[0].AllowedDecisions) != 2 ||
		response.Approvals[0].AllowedDecisions[0] != openclaw.DecisionAllowOnce ||
		response.Approvals[0].AllowedDecisions[1] != openclaw.DecisionDeny {
		t.Fatalf("managed approval = %#v", response.Approvals[0])
	}
}

func TestOpenClawSessionApprovalsReturnsManagedWhenGatewayListFails(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{
		ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned",
	})
	managedStore := newOpenClawManagedApprovalStore(time.Now)
	managed, _, err := managedStore.Create(openClawManagedApprovalCreate{
		SessionKey: "session-owned", ToolName: "k8s_network__apply_network_policy_repair",
		ToolCallID: "tool-call-managed", Title: "Managed repair", Timeout: 2 * time.Minute,
	})
	if err != nil {
		t.Fatal(err)
	}
	svc := newOpenClawChatService(store, &fakeOpenClawGateway{approvalsErr: openclaw.ErrRequestTimeout})
	svc.openClawManagedApprovals = managedStore
	recorder := httptest.NewRecorder()
	request := withApprovalParams(openClawRequest(http.MethodGet, "/approvals", "", 42, "org-a"), "owned", "")

	svc.OpenClawSessionApprovals(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", recorder.Code, recorder.Body.String())
	}
	var response openClawApprovalsResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	if len(response.Approvals) != 1 || response.Approvals[0].ID != managed.ID {
		t.Fatalf("approvals = %#v, want managed approval", response.Approvals)
	}
}

func TestOpenClawSessionApprovalsReportsCompleteSourcesForEmptySnapshot(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{
		ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned",
	})
	svc := newOpenClawChatService(store, &fakeOpenClawGateway{})
	svc.openClawManagedApprovals = newOpenClawManagedApprovalStore(time.Now)
	recorder := httptest.NewRecorder()
	request := withApprovalParams(openClawRequest(http.MethodGet, "/approvals", "", 42, "org-a"), "owned", "")

	svc.OpenClawSessionApprovals(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Approvals       []openClawApprovalDTO `json:"approvals"`
		CompleteSources []string              `json:"completeSources"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	if len(response.Approvals) != 0 {
		t.Fatalf("approvals = %#v, want empty", response.Approvals)
	}
	if got := strings.Join(response.CompleteSources, ","); got != "managed,native" {
		t.Fatalf("complete sources = %q, want managed,native", got)
	}
}

func TestOpenClawSessionApprovalsMarksManagedSnapshotCompleteWhenGatewayListFails(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{
		ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned",
	})
	managedStore := newOpenClawManagedApprovalStore(time.Now)
	managed, _, err := managedStore.Create(openClawManagedApprovalCreate{
		SessionKey: "session-owned", ToolName: "k8s_network__apply_network_policy_repair",
		ToolCallID: "tool-call-managed", Title: "Managed repair", Timeout: 2 * time.Minute,
	})
	if err != nil {
		t.Fatal(err)
	}
	svc := newOpenClawChatService(store, &fakeOpenClawGateway{approvalsErr: openclaw.ErrRequestTimeout})
	svc.openClawManagedApprovals = managedStore
	recorder := httptest.NewRecorder()
	request := withApprovalParams(openClawRequest(http.MethodGet, "/approvals", "", 42, "org-a"), "owned", "")

	svc.OpenClawSessionApprovals(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Approvals []struct {
			ID     string `json:"id"`
			Source string `json:"source"`
		} `json:"approvals"`
		CompleteSources []string `json:"completeSources"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	if len(response.Approvals) != 1 || response.Approvals[0].ID != managed.ID || response.Approvals[0].Source != "managed" {
		t.Fatalf("approvals = %#v, want one managed approval", response.Approvals)
	}
	if got := strings.Join(response.CompleteSources, ","); got != "managed" {
		t.Fatalf("complete sources = %q, want managed", got)
	}
}

func TestOpenClawSessionApprovalsReturnsCompleteManagedEmptySnapshotWhenGatewayListFails(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{
		ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned",
	})
	svc := newOpenClawChatService(store, &fakeOpenClawGateway{approvalsErr: openclaw.ErrRequestTimeout})
	svc.openClawManagedApprovals = newOpenClawManagedApprovalStore(time.Now)
	recorder := httptest.NewRecorder()
	request := withApprovalParams(openClawRequest(http.MethodGet, "/approvals", "", 42, "org-a"), "owned", "")

	svc.OpenClawSessionApprovals(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want managed-only 200: %s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Approvals       []openClawApprovalDTO `json:"approvals"`
		CompleteSources []string              `json:"completeSources"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	if len(response.Approvals) != 0 || strings.Join(response.CompleteSources, ",") != "managed" {
		t.Fatalf("response = %#v, want empty managed-complete snapshot", response)
	}
}

func TestOpenClawSessionApprovalResolveDispatchesCloudHubIDLocally(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{
		ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned",
	})
	managedStore := newOpenClawManagedApprovalStore(time.Now)
	managed, _, err := managedStore.Create(openClawManagedApprovalCreate{
		SessionKey: "session-owned", ToolName: "k8s_network__apply_network_policy_repair",
		ToolCallID: "tool-call-managed", Title: "Managed repair", Timeout: 2 * time.Minute,
	})
	if err != nil {
		t.Fatal(err)
	}
	gateway := &fakeOpenClawGateway{}
	svc := newOpenClawChatService(store, gateway)
	svc.openClawManagedApprovals = managedStore
	recorder := httptest.NewRecorder()
	request := withApprovalParams(
		openClawRequest(http.MethodPost, "/resolve", `{"decision":"allow-once"}`, 42, "org-a"),
		"owned", managed.ID,
	)

	svc.OpenClawSessionApprovalResolve(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204: %s", recorder.Code, recorder.Body.String())
	}
	resolved, err := managedStore.Get(managed.ID)
	if err != nil {
		t.Fatal(err)
	}
	if resolved.State != openClawManagedApprovalAllowed || resolved.Decision != openclaw.DecisionAllowOnce {
		t.Fatalf("resolved approval = %#v", resolved)
	}
	if gateway.approvalListCalls != 0 || gateway.resolveApprovalCalls != 0 {
		t.Fatalf("gateway calls = (list %d, resolve %d), want none", gateway.approvalListCalls, gateway.resolveApprovalCalls)
	}
}

func TestOpenClawManagedApprovalResolvePublishesEventsOnlyAfterSuccessfulResolution(t *testing.T) {
	now := time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name             string
		decision         string
		recordSessionKey string
		expire           bool
		duplicate        bool
		wantStatus       int
		wantEvent        bool
		wantDecision     openclaw.PluginApprovalDecision
	}{
		{name: "allow once", decision: "allow-once", recordSessionKey: "session-owned", wantStatus: http.StatusNoContent, wantEvent: true, wantDecision: openclaw.DecisionAllowOnce},
		{name: "deny", decision: "deny", recordSessionKey: "session-owned", wantStatus: http.StatusNoContent, wantEvent: true, wantDecision: openclaw.DecisionDeny},
		{name: "rejected decision", decision: "allow-always", recordSessionKey: "session-owned", wantStatus: http.StatusUnprocessableEntity},
		{name: "foreign session", decision: "deny", recordSessionKey: "session-foreign", wantStatus: http.StatusConflict},
		{name: "expired", decision: "allow-once", recordSessionKey: "session-owned", expire: true, wantStatus: http.StatusConflict},
		{name: "duplicate resolution", decision: "allow-once", recordSessionKey: "session-owned", duplicate: true, wantStatus: http.StatusConflict},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			current := now
			store := newOpenClawSessionStoreContract()
			_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{
				ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned",
			})
			managedStore := newOpenClawManagedApprovalStore(func() time.Time { return current })
			managed, _, err := managedStore.Create(openClawManagedApprovalCreate{
				SessionKey: test.recordSessionKey, ToolName: "k8s_network__repair_network_policy_port",
				ToolCallID: "tool-call-event", Title: "Managed repair", Description: "repair policy",
				Severity: "warning", Timeout: time.Minute,
			})
			if err != nil {
				t.Fatal(err)
			}
			if test.expire {
				current = current.Add(time.Minute)
			}
			if test.duplicate {
				if _, err := managedStore.Resolve(managed.ID, "session-owned", openclaw.DecisionAllowOnce); err != nil {
					t.Fatal(err)
				}
			}
			gatewayEvents := make(chan openclaw.GatewayEvent)
			t.Cleanup(func() { close(gatewayEvents) })
			gateway := &fakeOpenClawGateway{events: gatewayEvents}
			svc := newOpenClawChatService(store, gateway)
			svc.openClawManagedApprovals = managedStore
			events := subscribeManagedApprovalEvents(t, svc)
			recorder := httptest.NewRecorder()
			request := withApprovalParams(
				openClawRequest(http.MethodPost, "/resolve", `{"decision":"`+test.decision+`"}`, 42, "org-a"),
				"owned", managed.ID,
			)

			svc.OpenClawSessionApprovalResolve(recorder, request)

			if recorder.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d: %s", recorder.Code, test.wantStatus, recorder.Body.String())
			}
			if !test.wantEvent {
				assertNoManagedApprovalEvent(t, events)
				return
			}
			event := readManagedApprovalEvent(t, events)
			if event.Kind != openclaw.EventApprovalResolved || event.ApprovalDecision != test.wantDecision {
				t.Fatalf("resolved event = %#v", event)
			}
			if event.ApprovalResolvedAtMs == 0 {
				t.Fatal("resolved event has no timestamp")
			}
			if event.ApprovalResolvedBy != "42" {
				t.Fatalf("resolved by = %q, want 42", event.ApprovalResolvedBy)
			}
			assertManagedApprovalEventPublic(t, event)
		})
	}
}

func TestOpenClawSessionApprovalResolveRejectsManagedApprovalFromOtherSession(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{
		ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned",
	})
	managedStore := newOpenClawManagedApprovalStore(time.Now)
	managed, _, err := managedStore.Create(openClawManagedApprovalCreate{
		SessionKey: "session-foreign", ToolName: "k8s_network__apply_network_policy_repair",
		ToolCallID: "tool-call-foreign", Title: "Foreign repair", Timeout: 2 * time.Minute,
	})
	if err != nil {
		t.Fatal(err)
	}
	svc := newOpenClawChatService(store, &fakeOpenClawGateway{})
	svc.openClawManagedApprovals = managedStore
	recorder := httptest.NewRecorder()
	request := withApprovalParams(
		openClawRequest(http.MethodPost, "/resolve", `{"decision":"deny"}`, 42, "org-a"),
		"owned", managed.ID,
	)

	svc.OpenClawSessionApprovalResolve(recorder, request)

	if recorder.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409: %s", recorder.Code, recorder.Body.String())
	}
	unchanged, err := managedStore.Get(managed.ID)
	if err != nil {
		t.Fatal(err)
	}
	if unchanged.State != openClawManagedApprovalPending {
		t.Fatalf("state = %q, want pending", unchanged.State)
	}
}

func TestOpenClawSessionApprovalResolvePreservesNativeGatewayPath(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{
		ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned",
	})
	now := time.Now().UnixMilli()
	gateway := &fakeOpenClawGateway{approvals: []openclaw.PluginApproval{
		pendingApproval("plugin:native", "session-owned", now+60_000),
	}}
	svc := newOpenClawChatService(store, gateway)
	svc.openClawManagedApprovals = newOpenClawManagedApprovalStore(time.Now)
	recorder := httptest.NewRecorder()
	request := withApprovalParams(
		openClawRequest(http.MethodPost, "/resolve", `{"decision":"deny"}`, 42, "org-a"),
		"owned", "plugin:native",
	)

	svc.OpenClawSessionApprovalResolve(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204: %s", recorder.Code, recorder.Body.String())
	}
	if gateway.approvalListCalls != 1 || gateway.resolveApprovalCalls != 1 || gateway.resolvedApproval.ID != "plugin:native" {
		t.Fatalf("gateway calls = list %d, resolve %d, params %#v", gateway.approvalListCalls, gateway.resolveApprovalCalls, gateway.resolvedApproval)
	}
}

func TestOpenClawSessionApprovalResolveAllowsOnlyOwnedPendingFullID(t *testing.T) {
	now := time.Now().UnixMilli()
	tests := []struct {
		name         string
		approvalID   string
		body         string
		approvals    []openclaw.PluginApproval
		resolveErr   error
		wantStatus   int
		wantCalls    int
		wantDecision openclaw.PluginApprovalDecision
	}{
		{
			name: "allow once", approvalID: "plugin:full-id", body: `{"decision":"allow-once"}`,
			approvals:  []openclaw.PluginApproval{pendingApproval("plugin:full-id", "session-owned", now+60_000)},
			wantStatus: http.StatusNoContent, wantCalls: 1, wantDecision: openclaw.DecisionAllowOnce,
		},
		{
			name: "deny", approvalID: "plugin:full-id", body: `{"decision":"deny"}`,
			approvals:  []openclaw.PluginApproval{pendingApproval("plugin:full-id", "session-owned", now+60_000)},
			wantStatus: http.StatusNoContent, wantCalls: 1, wantDecision: openclaw.DecisionDeny,
		},
		{
			name: "prefix is not full ID", approvalID: "plugin:full", body: `{"decision":"allow-once"}`,
			approvals:  []openclaw.PluginApproval{pendingApproval("plugin:full-id", "session-owned", now+60_000)},
			wantStatus: http.StatusConflict,
		},
		{
			name: "cross session", approvalID: "plugin:full-id", body: `{"decision":"allow-once"}`,
			approvals:  []openclaw.PluginApproval{pendingApproval("plugin:full-id", "session-foreign", now+60_000)},
			wantStatus: http.StatusConflict,
		},
		{
			name: "expired", approvalID: "plugin:full-id", body: `{"decision":"allow-once"}`,
			approvals:  []openclaw.PluginApproval{pendingApproval("plugin:full-id", "session-owned", now-1)},
			wantStatus: http.StatusConflict,
		},
		{
			name: "missing pending", approvalID: "plugin:full-id", body: `{"decision":"allow-once"}`,
			wantStatus: http.StatusConflict,
		},
		{
			name: "allow always rejected", approvalID: "plugin:full-id", body: `{"decision":"allow-always"}`,
			approvals:  []openclaw.PluginApproval{pendingApproval("plugin:full-id", "session-owned", now+60_000)},
			wantStatus: http.StatusUnprocessableEntity,
		},
		{
			name: "unknown field rejected", approvalID: "plugin:full-id", body: `{"decision":"deny","extra":true}`,
			approvals:  []openclaw.PluginApproval{pendingApproval("plugin:full-id", "session-owned", now+60_000)},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "gateway conflict", approvalID: "plugin:full-id", body: `{"decision":"allow-once"}`,
			approvals:  []openclaw.PluginApproval{pendingApproval("plugin:full-id", "session-owned", now+60_000)},
			resolveErr: &openclaw.RPCError{Code: "CONFLICT", Message: "already resolved"},
			wantStatus: http.StatusConflict, wantCalls: 1, wantDecision: openclaw.DecisionAllowOnce,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			store := newOpenClawSessionStoreContract()
			_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{
				ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned",
			})
			gateway := &fakeOpenClawGateway{approvals: test.approvals, resolveApprovalErr: test.resolveErr}
			svc := newOpenClawChatService(store, gateway)
			recorder := httptest.NewRecorder()
			request := withApprovalParams(
				openClawRequest(http.MethodPost, "/resolve", test.body, 42, "org-a"),
				"owned", test.approvalID,
			)

			svc.OpenClawSessionApprovalResolve(recorder, request)

			if recorder.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d: %s", recorder.Code, test.wantStatus, recorder.Body.String())
			}
			if gateway.resolveApprovalCalls != test.wantCalls {
				t.Fatalf("resolve calls = %d, want %d", gateway.resolveApprovalCalls, test.wantCalls)
			}
			if test.wantCalls == 1 && gateway.resolvedApproval != (openclaw.ResolvePluginApprovalParams{
				ID: test.approvalID, Decision: test.wantDecision,
			}) {
				t.Fatalf("resolved = %#v", gateway.resolvedApproval)
			}
		})
	}
}

func TestOpenClawApprovalRoutesRequireViewerAndEditorRoles(t *testing.T) {
	tests := []struct {
		name        string
		method      string
		role        string
		path        string
		body        string
		wantStatus  int
		wantResolve int
	}{
		{
			name: "viewer can list", method: http.MethodGet, role: roles.ViewerRoleName,
			path: "/cloudhub/v2/openclaw/sessions/owned/approvals", wantStatus: http.StatusOK,
		},
		{
			name: "editor can resolve", method: http.MethodPost, role: roles.EditorRoleName,
			path: "/cloudhub/v2/openclaw/sessions/owned/approvals/plugin:full-id/resolve",
			body: `{"decision":"allow-once"}`, wantStatus: http.StatusNoContent, wantResolve: 1,
		},
		{
			name: "member cannot resolve", method: http.MethodPost, role: roles.MemberRoleName,
			path: "/cloudhub/v2/openclaw/sessions/owned/approvals/plugin:full-id/resolve",
			body: `{"decision":"allow-once"}`, wantStatus: http.StatusForbidden,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			store := newOpenClawSessionStoreContract()
			_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{
				ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned",
			})
			gateway := &fakeOpenClawGateway{approvals: []openclaw.PluginApproval{
				pendingApproval("plugin:full-id", "session-owned", time.Now().Add(time.Minute).UnixMilli()),
			}}
			svc := newOpenClawChatService(store, gateway)
			user := &cloudhub.User{ID: 42, Roles: []cloudhub.Role{{Organization: "org-a", Name: test.role}}}
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
				Logger: svc.Logger, UseAuth: true,
				Auth: &mocks.Authenticator{Principal: oauth2.Principal{
					Subject: "user", Issuer: "test", Organization: "org-a",
				}},
			}, *svc)
			recorder := httptest.NewRecorder()

			handler.ServeHTTP(recorder, httptest.NewRequest(test.method, test.path, strings.NewReader(test.body)))

			if recorder.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d: %s", recorder.Code, test.wantStatus, recorder.Body.String())
			}
			if test.method == http.MethodGet && !strings.Contains(recorder.Body.String(), `"approvals"`) {
				t.Fatalf("list route did not return approvals JSON: %s", recorder.Body.String())
			}
			if gateway.resolveApprovalCalls != test.wantResolve {
				t.Fatalf("resolve calls = %d, want %d", gateway.resolveApprovalCalls, test.wantResolve)
			}
		})
	}
}

func pendingApproval(id, sessionKey string, expiresAt int64) openclaw.PluginApproval {
	return openclaw.PluginApproval{
		ID: id, SessionKey: sessionKey, ExpiresAtMs: expiresAt,
		AllowedDecisions: []openclaw.PluginApprovalDecision{openclaw.DecisionAllowOnce, openclaw.DecisionDeny},
	}
}

func withApprovalParams(request *http.Request, sessionID, approvalID string) *http.Request {
	return request.WithContext(httprouter.WithParams(request.Context(), httprouter.Params{
		{Key: "id", Value: sessionID},
		{Key: "approvalId", Value: approvalID},
	}))
}
