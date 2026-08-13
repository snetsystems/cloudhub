package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/bouk/httprouter"
	"github.com/gorilla/websocket"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/openclaw"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

func TestOpenClawSessionsCreateUsesAuthenticatedOwnerAndServerSession(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	svc := newOpenClawChatService(store, nil)
	req := openClawRequest(http.MethodPost, "/cloudhub/v2/openclaw/sessions", `{
		"title":"Investigate latency",
		"sessionKey":"agent:attacker:other",
		"agentId":"attacker"
	}`, 42, "org-a")
	rr := httptest.NewRecorder()

	svc.OpenClawSessions(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d: %s", rr.Code, http.StatusCreated, rr.Body.String())
	}
	if len(store.items) != 1 {
		t.Fatalf("created sessions = %d, want 1", len(store.items))
	}
	for _, session := range store.items {
		if session.OrganizationID != "org-a" || session.UserID != "42" {
			t.Fatalf("owner = (%q, %q), want (org-a, 42)", session.OrganizationID, session.UserID)
		}
		if session.AgentID != "cloudhub-chat" {
			t.Fatalf("agent ID = %q, want cloudhub-chat", session.AgentID)
		}
		wantSessionKey := "agent:cloudhub-chat:cloudhub:org-a:42:" + session.ID
		if session.SessionKey != wantSessionKey {
			t.Fatalf("session key = %q, want %q", session.SessionKey, wantSessionKey)
		}
	}
	if strings.Contains(rr.Body.String(), "sessionKey") || strings.Contains(rr.Body.String(), "agentId") {
		t.Fatalf("create response exposed internal gateway mapping: %s", rr.Body.String())
	}
}

func TestOpenClawSessionsCreateBindsConfiguredAgentIntoTheSessionKey(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	svc := newOpenClawChatService(store, nil)
	svc.OpenClawAgentID = "main"
	rr := httptest.NewRecorder()

	svc.OpenClawSessions(rr, openClawRequest(http.MethodPost, "/cloudhub/v2/openclaw/sessions", `{"title":"x"}`, 42, "org-a"))

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d: %s", rr.Code, http.StatusCreated, rr.Body.String())
	}
	for _, session := range store.items {
		if session.AgentID != "main" {
			t.Fatalf("agent ID = %q, want main", session.AgentID)
		}
		if want := "agent:main:cloudhub:org-a:42:" + session.ID; session.SessionKey != want {
			t.Fatalf("session key = %q, want %q", session.SessionKey, want)
		}
	}
}

func TestOpenClawSessionsCreateResolvesGatewayDefaultAgentWhenUnconfigured(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	gateway := &fakeOpenClawGateway{agents: openclaw.AgentList{DefaultID: "  gateway-default  "}}
	svc := newOpenClawChatService(store, gateway)
	svc.OpenClawAgentID = ""
	rr := httptest.NewRecorder()

	svc.OpenClawSessions(rr, openClawRequest(http.MethodPost, "/cloudhub/v2/openclaw/sessions", `{"title":"x"}`, 42, "org-a"))

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d: %s", rr.Code, http.StatusCreated, rr.Body.String())
	}
	if gateway.ListAgentsCalls() != 1 {
		t.Fatalf("agents.list calls = %d, want 1", gateway.ListAgentsCalls())
	}
	for _, session := range store.items {
		if session.AgentID != "gateway-default" {
			t.Fatalf("agent ID = %q, want gateway-default", session.AgentID)
		}
		if want := "agent:gateway-default:cloudhub:org-a:42:" + session.ID; session.SessionKey != want {
			t.Fatalf("session key = %q, want %q", session.SessionKey, want)
		}
	}
}

func TestOpenClawSessionsCreateRejectsUnresolvableDefaultAgent(t *testing.T) {
	for _, tt := range []struct {
		name     string
		gateway  openClawGateway
		wantCode int
	}{
		{"no gateway to ask", nil, http.StatusServiceUnavailable},
		{"gateway reports no default", &fakeOpenClawGateway{agents: openclaw.AgentList{DefaultID: "   "}}, http.StatusBadGateway},
	} {
		t.Run(tt.name, func(t *testing.T) {
			store := newOpenClawSessionStoreContract()
			svc := newOpenClawChatService(store, tt.gateway)
			svc.OpenClawAgentID = ""
			rr := httptest.NewRecorder()

			svc.OpenClawSessions(rr, openClawRequest(http.MethodPost, "/cloudhub/v2/openclaw/sessions", `{"title":"x"}`, 42, "org-a"))

			if rr.Code != tt.wantCode {
				t.Fatalf("status = %d, want %d: %s", rr.Code, tt.wantCode, rr.Body.String())
			}
			if len(store.items) != 0 {
				t.Fatalf("created %d sessions, want none stored without a resolved agent", len(store.items))
			}
		})
	}
}

func TestOpenClawSessionsListScopesToAuthenticatedUser(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	for _, session := range []*cloudhub.OpenClawSession{
		{ID: "owned", OrganizationID: "org-a", UserID: "42", Title: "owned"},
		{ID: "other-user", OrganizationID: "org-a", UserID: "43", Title: "other user"},
		{ID: "other-org", OrganizationID: "org-b", UserID: "42", Title: "other org"},
	} {
		if _, err := store.Create(context.Background(), session); err != nil {
			t.Fatal(err)
		}
	}
	svc := newOpenClawChatService(store, nil)
	rr := httptest.NewRecorder()

	svc.OpenClawSessions(rr, openClawRequest(http.MethodGet, "/cloudhub/v2/openclaw/sessions", "", 42, "org-a"))

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", rr.Code, http.StatusOK, rr.Body.String())
	}
	var response struct {
		Sessions []struct {
			ID string `json:"id"`
		} `json:"sessions"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	if len(response.Sessions) != 1 || response.Sessions[0].ID != "owned" {
		t.Fatalf("sessions = %#v, want only owned", response.Sessions)
	}
}

func TestOpenClawSessionHistoryRejectsCrossUserAndCrossOrganization(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	for _, session := range []*cloudhub.OpenClawSession{
		{ID: "other-user", OrganizationID: "org-a", UserID: "43", SessionKey: "session-other-user"},
		{ID: "other-org", OrganizationID: "org-b", UserID: "42", SessionKey: "session-other-org"},
	} {
		if _, err := store.Create(context.Background(), session); err != nil {
			t.Fatal(err)
		}
	}
	gateway := &fakeOpenClawGateway{}
	svc := newOpenClawChatService(store, gateway)
	for _, tt := range []struct {
		id         string
		wantStatus int
	}{
		// Same organization, another user: the handler's ownership check denies it.
		{id: "other-user", wantStatus: http.StatusForbidden},
		// Another organization: the organization-scoped store reports the
		// session as missing, so the request never reaches that check and
		// the response does not confirm that the session exists.
		{id: "other-org", wantStatus: http.StatusNotFound},
	} {
		t.Run(tt.id, func(t *testing.T) {
			req := openClawRequest(http.MethodGet, "/cloudhub/v2/openclaw/sessions/"+tt.id+"/messages", "", 42, "org-a")
			req = withOpenClawSessionID(req, tt.id)
			rr := httptest.NewRecorder()

			svc.OpenClawSessionMessages(rr, req)

			if rr.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d: %s", rr.Code, tt.wantStatus, rr.Body.String())
			}
		})
	}
	if gateway.historyCalls != 0 {
		t.Fatalf("history calls = %d, want 0", gateway.historyCalls)
	}
}

func TestOpenClawSessionHistoryUsesStoredMappingAndRelaysRawResponse(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	session := &cloudhub.OpenClawSession{ID: "owned", OrganizationID: "org-a", UserID: "42", AgentID: "main", SessionKey: "server-session"}
	_, _ = store.Create(context.Background(), session)
	gateway := &fakeOpenClawGateway{history: openclaw.HistoryPage{
		Raw: json.RawMessage(`{
			"sessionKey":"server-session",
			"sessionId":"internal-1",
			"totalMessages":1,
			"messages":[{"id":"internal-message","role":"assistant","content":[{"type":"text","text":"hello"}],"timestamp":1234}],
			"__openclaw":{"source":"gateway"},
			"opaque":{"keep":true}
		}`),
		Offset:        0,
		NextOffset:    intPointer(50),
		HasMore:       true,
		TotalMessages: 1,
		Messages: []openclaw.Message{{
			ID:        "internal-message",
			Role:      "assistant",
			Content:   []openclaw.ContentPart{{Type: "text", Text: "hello"}},
			Timestamp: 1234,
		}},
	}}
	svc := newOpenClawChatService(store, gateway)
	req := openClawRequest(http.MethodGet, "/cloudhub/v2/openclaw/sessions/owned/messages?limit=50&maxChars=100000", "", 42, "org-a")
	req = withOpenClawSessionID(req, "owned")
	rr := httptest.NewRecorder()

	svc.OpenClawSessionMessages(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", rr.Code, http.StatusOK, rr.Body.String())
	}
	if gateway.historyParams.SessionKey != "server-session" || gateway.historyParams.AgentID != "main" {
		t.Fatalf("history mapping = %#v, want stored session and agent", gateway.historyParams)
	}
	if gateway.historyParams.Limit != 50 || gateway.historyParams.MaxChars != 100000 {
		t.Fatalf("history limits = %#v, want limit 50/max chars 100000", gateway.historyParams)
	}
	if equal, err := jsonEqual(rr.Body.String(), string(gateway.history.Raw)); err != nil || !equal {
		t.Fatalf("history response = %s, want raw gateway payload %s", rr.Body.Bytes(), gateway.history.Raw)
	}
}

func TestOpenClawSessionMessageForwardsOnlySafeRequestFields(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{ID: "owned", OrganizationID: "org-a", UserID: "42", AgentID: "main", SessionKey: "server-session"})
	gateway := &fakeOpenClawGateway{send: openclaw.SendMessageResult{RunID: "internal-run", Status: "accepted"}}
	svc := newOpenClawChatService(store, gateway)
	req := openClawRequest(http.MethodPost, "/cloudhub/v2/openclaw/sessions/owned/messages", `{
		"message":"check latency",
		"sessionKey":"agent:attacker:other",
		"agentId":"attacker",
		"timeoutMs":2000,
		"idempotencyKey":"request-1"
	}`, 42, "org-a")
	req = withOpenClawSessionID(req, "owned")
	rr := httptest.NewRecorder()

	svc.OpenClawSessionMessage(rr, req)

	if rr.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d: %s", rr.Code, http.StatusAccepted, rr.Body.String())
	}
	if gateway.sendParams.SessionKey != "server-session" || gateway.sendParams.AgentID != "main" {
		t.Fatalf("send mapping = %#v, want stored session and agent", gateway.sendParams)
	}
	if gateway.sendParams.Message != "check latency" || gateway.sendParams.TimeoutMs != 2000 || gateway.sendParams.IdempotencyKey != "request-1" {
		t.Fatalf("send params = %#v", gateway.sendParams)
	}
	if !gateway.sendHadDeadline {
		t.Fatal("send context had no handler timeout deadline")
	}
	if strings.Contains(rr.Body.String(), "internal-run") {
		t.Fatalf("message response exposed gateway run ID: %s", rr.Body.String())
	}
}

func TestOpenClawHandlersEnforceRequestLimitsAndMapGatewayErrors(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{ID: "owned", OrganizationID: "org-a", UserID: "42", AgentID: "main", SessionKey: "server-session"})
	for _, test := range []struct {
		name       string
		method     string
		url        string
		body       string
		gatewayErr error
		want       int
	}{
		{name: "oversized message", method: http.MethodPost, url: "/cloudhub/v2/openclaw/sessions/owned/messages", body: `{"message":"` + strings.Repeat("x", maxOpenClawMessageBytes+1) + `"}`, want: http.StatusRequestEntityTooLarge},
		{name: "too many history messages", method: http.MethodGet, url: "/cloudhub/v2/openclaw/sessions/owned/messages?limit=101", want: http.StatusUnprocessableEntity},
		{name: "gateway timeout", method: http.MethodPost, url: "/cloudhub/v2/openclaw/sessions/owned/messages", body: `{"message":"hello","idempotencyKey":"timeout"}`, gatewayErr: openclaw.ErrRequestTimeout, want: http.StatusGatewayTimeout},
		{name: "gateway conflict", method: http.MethodPost, url: "/cloudhub/v2/openclaw/sessions/owned/messages", body: `{"message":"hello","idempotencyKey":"conflict"}`, gatewayErr: &openclaw.RPCError{Code: "conflict", Message: "active run"}, want: http.StatusConflict},
		{name: "gateway unavailable", method: http.MethodPost, url: "/cloudhub/v2/openclaw/sessions/owned/messages", body: `{"message":"hello","idempotencyKey":"unavailable"}`, gatewayErr: openclaw.ErrDisconnected, want: http.StatusBadGateway},
	} {
		t.Run(test.name, func(t *testing.T) {
			gateway := &fakeOpenClawGateway{sendErr: test.gatewayErr}
			svc := newOpenClawChatService(store, gateway)
			req := openClawRequest(test.method, test.url, test.body, 42, "org-a")
			req = withOpenClawSessionID(req, "owned")
			rr := httptest.NewRecorder()

			if test.method == http.MethodGet {
				svc.OpenClawSessionMessages(rr, req)
			} else {
				svc.OpenClawSessionMessage(rr, req)
			}
			if rr.Code != test.want {
				t.Fatalf("status = %d, want %d: %s", rr.Code, test.want, rr.Body.String())
			}
			if test.want == http.StatusRequestEntityTooLarge && gateway.sendCalls != 0 {
				t.Fatalf("gateway send calls = %d, want 0", gateway.sendCalls)
			}
		})
	}
}

func TestOpenClawEventsFilterToOwnedSubscribedSession(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned"})
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{ID: "foreign", OrganizationID: "org-b", UserID: "99", SessionKey: "session-foreign"})
	events := make(chan openclaw.GatewayEvent, 3)
	defer close(events)
	gateway := &fakeOpenClawGateway{events: events}
	svc := newOpenClawChatService(store, gateway)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		svc.OpenClawEvents(w, openClawRequestWithContext(r, 42, "org-a"))
	}))
	defer server.Close()
	wsURL, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	wsURL.Scheme = "ws"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL.String(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()

	if err := conn.WriteJSON(map[string]string{"sessionId": "owned"}); err != nil {
		t.Fatal(err)
	}
	events <- openclaw.GatewayEvent{Kind: openclaw.EventChat, SessionKey: "session-owned"}
	events <- openclaw.GatewayEvent{Kind: openclaw.EventChat, SessionKey: "session-foreign", Payload: json.RawMessage(`{"sessionKey":"session-foreign","runId":"run-foreign","opaque":{"keep":false},"__openclaw":{"source":"gateway"}}`)}
	events <- openclaw.GatewayEvent{Kind: openclaw.EventChat, SessionKey: "session-owned", Payload: json.RawMessage(`{"sessionKey":"session-owned","runId":"run-1","opaque":{"keep":true},"__openclaw":{"source":"gateway"}}`)}
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, received, err := conn.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	if equal, err := jsonEqual(string(received), `{"sessionKey":"session-owned","runId":"run-1","opaque":{"keep":true},"__openclaw":{"source":"gateway"}}`); err != nil || !equal {
		t.Fatalf("websocket payload = %s, want raw owned gateway payload", received)
	}
	_ = conn.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
	if _, _, err := conn.ReadMessage(); err == nil {
		t.Fatal("received an event for the foreign session")
	} else if !websocket.IsUnexpectedCloseError(err) {
		if _, ok := err.(net.Error); !ok || !err.(net.Error).Timeout() {
			t.Fatalf("reading after owned event = %v, want timeout", err)
		}
	}
	if gateway.SubscribeCalls() != 1 {
		t.Fatalf("gateway subscribe calls = %d, want 1", gateway.SubscribeCalls())
	}
}

func TestOpenClawEventsRelayActivityForOwnedSession(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned"})
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{ID: "foreign", OrganizationID: "org-b", UserID: "99", SessionKey: "session-foreign"})
	events := make(chan openclaw.GatewayEvent, 2)
	defer close(events)
	svc := newOpenClawChatService(store, &fakeOpenClawGateway{events: events})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		svc.OpenClawEvents(w, openClawRequestWithContext(r, 42, "org-a"))
	}))
	defer server.Close()
	wsURL, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	wsURL.Scheme = "ws"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL.String(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()

	if err := conn.WriteJSON(map[string]string{"sessionId": "owned"}); err != nil {
		t.Fatal(err)
	}
	ownedPayload := json.RawMessage(`{"sessionKey":"session-owned","runId":"run-1","stream":"tool","data":{"phase":"result","opaque":{"keep":true}}}`)
	events <- openclaw.GatewayEvent{Kind: openclaw.EventActivity, SessionKey: "session-owned", Payload: ownedPayload}
	events <- openclaw.GatewayEvent{Kind: openclaw.EventActivity, SessionKey: "session-foreign", Payload: json.RawMessage(`{"sessionKey":"session-foreign","runId":"run-foreign","stream":"tool","data":{"phase":"result","opaque":{"keep":false}}}`)}
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, received, err := conn.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	if equal, err := jsonEqual(string(received), string(ownedPayload)); err != nil || !equal {
		t.Fatalf("agent websocket payload = %s, want %s", received, ownedPayload)
	}
	_ = conn.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
	if _, _, err := conn.ReadMessage(); err == nil {
		t.Fatal("received an event for the foreign session")
	} else if !websocket.IsUnexpectedCloseError(err) {
		if _, ok := err.(net.Error); !ok || !err.(net.Error).Timeout() {
			t.Fatalf("reading after owned event = %v, want timeout", err)
		}
	}
}

func TestOpenClawEventsRegistersSubscriberBeforeWebSocketUpgrade(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned"})
	events := make(chan openclaw.GatewayEvent, 1)
	defer close(events)
	subscribeStarted := make(chan struct{}, 1)
	subscribeRelease := make(chan struct{})
	gateway := &fakeOpenClawGateway{
		events:           events,
		subscribeStarted: subscribeStarted,
		subscribeRelease: subscribeRelease,
	}
	svc := newOpenClawChatService(store, gateway)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		svc.OpenClawEvents(w, openClawRequestWithContext(r, 42, "org-a"))
	}))
	defer server.Close()

	type dialResult struct {
		conn *websocket.Conn
		err  error
	}
	wsURL := webSocketURL(t, server.URL)
	dialed := make(chan dialResult, 1)
	go func() {
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		dialed <- dialResult{conn: conn, err: err}
	}()
	select {
	case <-subscribeStarted:
	case <-time.After(2 * time.Second):
		t.Fatal("gateway subscription did not start")
	}
	var earlyResult dialResult
	upgradedEarly := false
	select {
	case earlyResult = <-dialed:
		upgradedEarly = true
	case <-time.After(100 * time.Millisecond):
	}
	close(subscribeRelease)
	if upgradedEarly {
		if earlyResult.conn != nil {
			_ = earlyResult.conn.Close()
		}
		t.Fatalf("WebSocket upgraded before subscriber registration: %v", earlyResult.err)
	}

	result := <-dialed
	if result.err != nil {
		t.Fatal(result.err)
	}
	defer result.conn.Close()
	if err := result.conn.WriteJSON(map[string]string{"sessionId": "owned"}); err != nil {
		t.Fatal(err)
	}
	events <- openclaw.GatewayEvent{Kind: openclaw.EventChat, SessionKey: "session-owned", Payload: json.RawMessage(`{"sessionId":"owned","deltaText":"first event"}`)}
	got := readOpenClawEvent(t, result.conn)
	if got["sessionId"] != "owned" || got["deltaText"] != "first event" {
		t.Fatalf("event = %#v, want first owned event", got)
	}
}

func TestOpenClawEventFanoutKeepsHealthySubscriberMovingWhenAnotherStalls(t *testing.T) {
	const eventCount = openClawEventSubscriberBuffer + 2
	events := make(chan openclaw.GatewayEvent, eventCount)
	fanout := newOpenClawEventFanout(&fakeOpenClawGateway{events: events})
	_, unsubscribeSlow, err := fanout.Subscribe(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer unsubscribeSlow()
	healthy, unsubscribeHealthy, err := fanout.Subscribe(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer unsubscribeHealthy()

	for i := 0; i < eventCount; i++ {
		events <- openclaw.GatewayEvent{Kind: openclaw.EventChat, DeltaText: fmt.Sprintf("event-%d", i)}
		select {
		case event := <-healthy:
			if event.DeltaText != fmt.Sprintf("event-%d", i) {
				t.Fatalf("event %d = %#v, want event-%d", i, event, i)
			}
		case <-time.After(2 * time.Second):
			t.Fatalf("healthy subscriber received %d events, want %d after slow subscriber stalled", i, eventCount)
		}
	}
}

func TestOpenClawEventsFanOutToSameSessionSubscribers(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	_, _ = store.Create(context.Background(), &cloudhub.OpenClawSession{ID: "owned", OrganizationID: "org-a", UserID: "42", SessionKey: "session-owned"})
	events := make(chan openclaw.GatewayEvent, 1)
	defer close(events)
	gateway := &fakeOpenClawGateway{events: events}
	svc := newOpenClawChatService(store, gateway)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		svc.OpenClawEvents(w, openClawRequestWithContext(r, 42, "org-a"))
	}))
	defer server.Close()

	first := openOpenClawEventsConnection(t, server.URL)
	defer first.Close()
	second := openOpenClawEventsConnection(t, server.URL)
	defer second.Close()
	for _, conn := range []*websocket.Conn{first, second} {
		if err := conn.WriteJSON(map[string]string{"sessionId": "owned"}); err != nil {
			t.Fatal(err)
		}
	}
	waitForOpenClawEventSubscribers(t, svc, 2)

	events <- openclaw.GatewayEvent{Kind: openclaw.EventChat, SessionKey: "session-owned", Payload: json.RawMessage(`{"sessionId":"owned","deltaText":"send to both"}`)}
	for _, conn := range []*websocket.Conn{first, second} {
		got := readOpenClawEvent(t, conn)
		if got["sessionId"] != "owned" || got["deltaText"] != "send to both" {
			t.Fatalf("event = %#v, want owned event for each subscriber", got)
		}
	}
	if gateway.SubscribeCalls() != 1 {
		t.Fatalf("gateway subscribe calls = %d, want 1 shared subscription", gateway.SubscribeCalls())
	}
}

func TestOpenClawEventsDoNotConsumeOtherSessionEvents(t *testing.T) {
	store := newOpenClawSessionStoreContract()
	for _, session := range []*cloudhub.OpenClawSession{
		{ID: "first", OrganizationID: "org-a", UserID: "42", SessionKey: "session-first"},
		{ID: "second", OrganizationID: "org-a", UserID: "42", SessionKey: "session-second"},
	} {
		_, _ = store.Create(context.Background(), session)
	}
	events := make(chan openclaw.GatewayEvent, 1)
	defer close(events)
	gateway := &fakeOpenClawGateway{events: events}
	svc := newOpenClawChatService(store, gateway)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		svc.OpenClawEvents(w, openClawRequestWithContext(r, 42, "org-a"))
	}))
	defer server.Close()

	first := openOpenClawEventsConnection(t, server.URL)
	defer first.Close()
	second := openOpenClawEventsConnection(t, server.URL)
	defer second.Close()
	if err := first.WriteJSON(map[string]string{"sessionId": "first"}); err != nil {
		t.Fatal(err)
	}
	if err := second.WriteJSON(map[string]string{"sessionId": "second"}); err != nil {
		t.Fatal(err)
	}
	waitForOpenClawEventSubscribers(t, svc, 2)

	events <- openclaw.GatewayEvent{Kind: openclaw.EventChat, SessionKey: "session-second", Payload: json.RawMessage(`{"sessionId":"second","deltaText":"only second"}`)}
	got := readOpenClawEvent(t, second)
	if got["sessionId"] != "second" || got["deltaText"] != "only second" {
		t.Fatalf("event = %#v, want second session event", got)
	}
	_ = first.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
	if _, _, err := first.ReadMessage(); err == nil {
		t.Fatal("first session received an event for second session")
	}
}

func TestOpenClawEventsRejectsUpgradeWhenGatewayUnavailable(t *testing.T) {
	svc := newOpenClawChatService(newOpenClawSessionStoreContract(), &fakeOpenClawGateway{
		subscribeErr: openclaw.ErrDisconnected,
	})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		svc.OpenClawEvents(w, openClawRequestWithContext(r, 42, "org-a"))
	}))
	defer server.Close()

	response, err := server.Client().Get(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusBadGateway {
		t.Fatalf("status = %d, want %d", response.StatusCode, http.StatusBadGateway)
	}
}

func newOpenClawChatService(store cloudhub.OpenClawSessionStore, gateway openClawGateway) *Service {
	return &Service{
		Store:           &Store{OpenClawSessionStore: store},
		Logger:          &mocks.TestLogger{},
		OpenClawGateway: gateway,
		OpenClawAgentID: "cloudhub-chat",
	}
}

func openClawRequest(method, target, body string, userID uint64, orgID string) *http.Request {
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	return openClawRequestWithContext(req, userID, orgID)
}

func openClawRequestWithContext(req *http.Request, userID uint64, orgID string) *http.Request {
	ctx := context.WithValue(req.Context(), UserContextKey, &cloudhub.User{ID: userID})
	ctx = context.WithValue(ctx, organizations.ContextKey, orgID)
	return req.WithContext(ctx)
}

func withOpenClawSessionID(req *http.Request, id string) *http.Request {
	return req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{{Key: "id", Value: id}}))
}

func intPointer(v int) *int { return &v }

func openOpenClawEventsConnection(t *testing.T, serverURL string) *websocket.Conn {
	t.Helper()
	conn, _, err := websocket.DefaultDialer.Dial(webSocketURL(t, serverURL), nil)
	if err != nil {
		t.Fatal(err)
	}
	return conn
}

func webSocketURL(t *testing.T, serverURL string) string {
	t.Helper()
	wsURL, err := url.Parse(serverURL)
	if err != nil {
		t.Fatal(err)
	}
	wsURL.Scheme = "ws"
	return wsURL.String()
}

func waitForOpenClawEventSubscribers(t *testing.T, svc *Service, want int) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		openClawFanoutMu.Lock()
		fanout := openClawFanouts[svc.OpenClawGateway]
		openClawFanoutMu.Unlock()
		if fanout != nil {
			fanout.mu.Lock()
			count := len(fanout.subscribers)
			fanout.mu.Unlock()
			if count >= want {
				return
			}
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatalf("event subscribers did not reach %d", want)
}

func readOpenClawEvent(t *testing.T, conn *websocket.Conn) map[string]interface{} {
	t.Helper()
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var event map[string]interface{}
	if err := conn.ReadJSON(&event); err != nil {
		t.Fatal(err)
	}
	return event
}

type fakeOpenClawGateway struct {
	mu               sync.Mutex
	history          openclaw.HistoryPage
	historyErr       error
	historyParams    openclaw.HistoryParams
	historyCalls     int
	send             openclaw.SendMessageResult
	sendErr          error
	sendParams       openclaw.SendMessageParams
	sendCalls        int
	sendHadDeadline  bool
	events           <-chan openclaw.GatewayEvent
	subscribeErr     error
	subscribeCalls   int
	subscribeStarted chan<- struct{}
	subscribeRelease <-chan struct{}
	agents           openclaw.AgentList
	agentsErr        error
	agentsCalls      int
}

func (g *fakeOpenClawGateway) ListAgents(context.Context) (openclaw.AgentList, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.agentsCalls++
	return g.agents, g.agentsErr
}

func (g *fakeOpenClawGateway) ListAgentsCalls() int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.agentsCalls
}

func (g *fakeOpenClawGateway) History(_ context.Context, params openclaw.HistoryParams) (openclaw.HistoryPage, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.historyCalls++
	g.historyParams = params
	return g.history, g.historyErr
}

func (g *fakeOpenClawGateway) SendMessage(ctx context.Context, params openclaw.SendMessageParams) (openclaw.SendMessageResult, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.sendCalls++
	g.sendParams = params
	_, g.sendHadDeadline = ctx.Deadline()
	return g.send, g.sendErr
}

func (g *fakeOpenClawGateway) Subscribe(context.Context) (<-chan openclaw.GatewayEvent, error) {
	g.mu.Lock()
	g.subscribeCalls++
	events := g.events
	err := g.subscribeErr
	started := g.subscribeStarted
	release := g.subscribeRelease
	g.mu.Unlock()
	if started != nil {
		started <- struct{}{}
	}
	if release != nil {
		<-release
	}
	return events, err
}

func (g *fakeOpenClawGateway) SubscribeCalls() int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.subscribeCalls
}
