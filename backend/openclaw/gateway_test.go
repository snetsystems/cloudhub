package openclaw

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestGatewayWaitsForChallengeAndSendsNonceBoundDeviceProof(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	server := newRawFakeGateway(t, func(conn *websocket.Conn, _ int) error {
		type requestResult struct {
			req gatewayTestRequest
			err error
		}
		request := make(chan requestResult, 1)
		go func() {
			req, err := readGatewayRequest(conn)
			request <- requestResult{req: req, err: err}
		}()
		select {
		case result := <-request:
			if result.err != nil {
				return result.err
			}
			return fmt.Errorf("received %q before connect.challenge", result.req.Method)
		case <-time.After(25 * time.Millisecond):
		}
		if err := conn.WriteJSON(map[string]interface{}{
			"type": "event", "event": "connect.challenge", "payload": map[string]interface{}{"nonce": "nonce-1", "ts": 1},
		}); err != nil {
			return err
		}
		result := <-request
		if result.err != nil {
			return result.err
		}
		req := result.req
		if req.Method != "connect" {
			return fmt.Errorf("handshake method = %q, want connect", req.Method)
		}
		var params struct {
			Device struct {
				ID        string `json:"id"`
				PublicKey string `json:"publicKey"`
				Signature string `json:"signature"`
				SignedAt  int64  `json:"signedAt"`
				Nonce     string `json:"nonce"`
			} `json:"device"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			return err
		}
		if params.Device.Nonce != "nonce-1" {
			return fmt.Errorf("device nonce = %q, want nonce-1", params.Device.Nonce)
		}
		if got := params.Device.PublicKey; got != base64.RawURLEncoding.EncodeToString(publicKey) {
			return fmt.Errorf("device public key = %q", got)
		}
		deviceID := fmt.Sprintf("%x", sha256.Sum256(publicKey))
		if params.Device.ID != deviceID {
			return fmt.Errorf("device id = %q, want %q", params.Device.ID, deviceID)
		}
		signature, err := base64.RawURLEncoding.DecodeString(params.Device.Signature)
		if err != nil {
			return err
		}
		payload := fmt.Sprintf("v3|%s|%s|%s|operator|operator.read,operator.write|%d|test-token|nonce-1|%s|", deviceID, gatewayClientID, gatewayClientMode, params.Device.SignedAt, runtime.GOOS)
		if !ed25519.Verify(publicKey, []byte(payload), signature) {
			return errors.New("device proof signature is invalid")
		}
		return writeHelloOK(conn, req.ID, gatewayProtocolVersion)
	})

	client, err := NewGatewayClient(context.Background(), GatewayConfig{
		URL:              server.URL(),
		Token:            "test-token",
		RequestTimeout:   500 * time.Millisecond,
		DevicePrivateKey: privateKey,
	})
	if err != nil {
		t.Fatalf("new gateway client: %v", err)
	}
	t.Cleanup(func() { _ = client.Close() })
}

func TestGatewayClientUsesPairedDeviceCredentials(t *testing.T) {
	_, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	server := newRawFakeGateway(t, func(conn *websocket.Conn, _ int) error {
		if err := conn.WriteJSON(map[string]interface{}{
			"type": "event", "event": "connect.challenge", "payload": map[string]interface{}{"nonce": "nonce-1", "ts": 1},
		}); err != nil {
			return err
		}
		req, err := readGatewayRequest(conn)
		if err != nil {
			return err
		}
		var params struct {
			Auth   map[string]interface{} `json:"auth"`
			Device map[string]interface{} `json:"device"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			return err
		}
		auth := params.Auth
		if auth["token"] != "paired-device-token" {
			return errors.New("auth token was not the paired device token")
		}
		device := params.Device
		if device["id"] == "" || device["publicKey"] == "" || device["signature"] == "" {
			return fmt.Errorf("device identity is incomplete: %#v", device)
		}
		return writeHelloOKWithAuth(conn, req.ID, gatewayProtocolVersion, "operator", []string{"operator.read", "operator.write"}, "paired-device-token")
	})

	client, err := NewGatewayClient(context.Background(), GatewayConfig{
		URL:              server.URL(),
		Token:            "paired-device-token",
		RequestTimeout:   500 * time.Millisecond,
		DevicePrivateKey: privateKey,
		RequiredScopes:   []string{"operator.read", "operator.write"},
	})
	if err != nil {
		t.Fatalf("new gateway client: %v", err)
	}
	t.Cleanup(func() { _ = client.Close() })
}

// The connect frame carries the requested scopes twice — as the "scopes"
// array and inside the v3 device-proof signature payload — and both copies
// must come from the configured RequiredScopes. If either is hardcoded, a
// scope added to RequiredScopes is never granted and validateHello then
// rejects the client's own connection.
func TestGatewayClientRequestsConfiguredScopes(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	configured := []string{"operator.read", "operator.write", "operator.extra"}

	captured := make(chan json.RawMessage, 1)
	server := newRawFakeGateway(t, func(conn *websocket.Conn, _ int) error {
		if err := conn.WriteJSON(map[string]interface{}{
			"type": "event", "event": "connect.challenge", "payload": map[string]interface{}{"nonce": "nonce-1", "ts": 1},
		}); err != nil {
			return err
		}
		req, err := readGatewayRequest(conn)
		if err != nil {
			return err
		}
		captured <- req.Params
		return writeHelloOKWithAuth(conn, req.ID, gatewayProtocolVersion, "operator", configured, "test-token")
	})

	client, err := NewGatewayClient(context.Background(), GatewayConfig{
		URL:              server.URL(),
		Token:            "test-token",
		RequestTimeout:   500 * time.Millisecond,
		DevicePrivateKey: privateKey,
		RequiredScopes:   configured,
	})
	if err != nil {
		t.Fatalf("new gateway client: %v", err)
	}
	t.Cleanup(func() { _ = client.Close() })

	var params struct {
		Scopes []string `json:"scopes"`
		Device struct {
			Signature string `json:"signature"`
			SignedAt  int64  `json:"signedAt"`
		} `json:"device"`
	}
	if err := json.Unmarshal(<-captured, &params); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(params.Scopes, configured) {
		t.Fatalf("connect scopes = %v, want %v", params.Scopes, configured)
	}

	signature, err := base64.RawURLEncoding.DecodeString(params.Device.Signature)
	if err != nil {
		t.Fatal(err)
	}
	deviceID := fmt.Sprintf("%x", sha256.Sum256(publicKey))
	payload := fmt.Sprintf("v3|%s|%s|%s|operator|%s|%d|test-token|nonce-1|%s|",
		deviceID, gatewayClientID, gatewayClientMode, strings.Join(configured, ","), params.Device.SignedAt, strings.ToLower(runtime.GOOS))
	if !ed25519.Verify(publicKey, []byte(payload), signature) {
		t.Fatal("device proof signature does not cover the configured scopes")
	}
}

// The Gateway skips device pairing entirely for the ("gateway-client",
// "backend") client identity, so CloudHub must never connect with that pair or
// it can never obtain a paired-device token.
func TestGatewayClientConnectUsesPairableClientIdentity(t *testing.T) {
	_, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, tt := range []struct {
		name       string
		privateKey ed25519.PrivateKey
	}{
		{name: "provisioning connect", privateKey: privateKey},
		{name: "runtime connect", privateKey: nil},
	} {
		t.Run(tt.name, func(t *testing.T) {
			captured := make(chan json.RawMessage, 1)
			server := newRawFakeGateway(t, func(conn *websocket.Conn, _ int) error {
				if err := conn.WriteJSON(map[string]interface{}{
					"type": "event", "event": "connect.challenge", "payload": map[string]interface{}{"nonce": "nonce-1", "ts": 1},
				}); err != nil {
					return err
				}
				req, err := readGatewayRequest(conn)
				if err != nil {
					return err
				}
				captured <- req.Params
				return writeHelloOK(conn, req.ID, gatewayProtocolVersion)
			})

			client, err := NewGatewayClient(context.Background(), GatewayConfig{
				URL:              server.URL(),
				Token:            "test-token",
				RequestTimeout:   500 * time.Millisecond,
				DevicePrivateKey: tt.privateKey,
			})
			if err != nil {
				t.Fatalf("new gateway client: %v", err)
			}
			t.Cleanup(func() { _ = client.Close() })

			var params struct {
				Client struct {
					ID          string `json:"id"`
					Mode        string `json:"mode"`
					DisplayName string `json:"displayName"`
				} `json:"client"`
			}
			if err := json.Unmarshal(<-captured, &params); err != nil {
				t.Fatal(err)
			}
			if params.Client.ID == "gateway-client" && params.Client.Mode == "backend" {
				t.Fatalf("connect used the gateway-client/backend identity, which the Gateway excludes from device pairing")
			}
			if params.Client.ID != gatewayClientID || params.Client.Mode != gatewayClientMode {
				t.Fatalf("connect client identity = %q/%q, want %q/%q", params.Client.ID, params.Client.Mode, gatewayClientID, gatewayClientMode)
			}
			if params.Client.DisplayName != gatewayClientDisplayName {
				t.Fatalf("connect client displayName = %q, want %q", params.Client.DisplayName, gatewayClientDisplayName)
			}
		})
	}
}

func TestGatewayClientRejectsMissingScope(t *testing.T) {
	server := newRawFakeGateway(t, fakeGatewayHandshakeWithAuth("operator", []string{"operator.read"}, "test-token"))
	_, err := NewGatewayClient(context.Background(), GatewayConfig{
		URL:            server.URL(),
		Token:          "test-token",
		RequestTimeout: 500 * time.Millisecond,
		RequiredScopes: []string{"operator.read", "operator.write"},
	})
	if !errors.Is(err, ErrProtocol) {
		t.Fatalf("new gateway client error = %v, want ErrProtocol", err)
	}
	if !strings.Contains(err.Error(), "operator.write") {
		t.Fatalf("error = %q, want it to name the missing scope operator.write", err.Error())
	}
	if strings.Contains(strings.ToLower(err.Error()), "token") || strings.Contains(strings.ToLower(err.Error()), "signature") {
		t.Fatalf("error = %q, must not contain token or signature", err.Error())
	}
}

func TestGatewayClientRejectsWrongRole(t *testing.T) {
	server := newRawFakeGateway(t, fakeGatewayHandshakeWithAuth("viewer", []string{"operator.read", "operator.write"}, "test-token"))
	_, err := NewGatewayClient(context.Background(), GatewayConfig{
		URL:            server.URL(),
		Token:          "test-token",
		RequestTimeout: 500 * time.Millisecond,
		RequiredScopes: []string{"operator.read", "operator.write"},
	})
	if !errors.Is(err, ErrProtocol) {
		t.Fatalf("new gateway client error = %v, want ErrProtocol", err)
	}
	if strings.Contains(strings.ToLower(err.Error()), "token") || strings.Contains(strings.ToLower(err.Error()), "signature") {
		t.Fatalf("error = %q, must not contain token or signature", err.Error())
	}
}

func TestGatewayRejectsHelloOutsideProtocol4(t *testing.T) {
	server := newFakeGateway(t, func(_ *websocket.Conn, _ int) error { return nil })
	server.helloProtocol = 3
	_, err := NewGatewayClient(context.Background(), GatewayConfig{URL: server.URL(), Token: "test-token", RequestTimeout: 500 * time.Millisecond})
	if !errors.Is(err, ErrProtocol) {
		t.Fatalf("new gateway client error = %v, want ErrProtocol", err)
	}
}

func TestGatewayRejectsNonHelloConnectResponse(t *testing.T) {
	server := newRawFakeGateway(t, func(conn *websocket.Conn, _ int) error {
		if err := conn.WriteJSON(map[string]interface{}{
			"type": "event", "event": "connect.challenge", "payload": map[string]interface{}{"nonce": "nonce-1", "ts": 1},
		}); err != nil {
			return err
		}
		req, err := readGatewayRequest(conn)
		if err != nil {
			return err
		}
		return writeGatewayResponse(conn, req.ID, true, map[string]interface{}{"type": "connected", "protocol": gatewayProtocolVersion}, nil)
	})
	_, err := NewGatewayClient(context.Background(), GatewayConfig{URL: server.URL(), Token: "test-token", RequestTimeout: 500 * time.Millisecond})
	if !errors.Is(err, ErrProtocol) {
		t.Fatalf("new gateway client error = %v, want ErrProtocol", err)
	}
}

func TestGatewayRoutesConcurrentResponsesByRequestID(t *testing.T) {
	server := newFakeGateway(t, func(conn *websocket.Conn, _ int) error {
		first, err := readGatewayRequest(conn)
		if err != nil {
			return err
		}
		second, err := readGatewayRequest(conn)
		if err != nil {
			return err
		}
		if first.ID == second.ID {
			return fmt.Errorf("duplicate request id %q", first.ID)
		}

		requests := map[string]gatewayTestRequest{
			first.Method:  first,
			second.Method: second,
		}
		if err := writeGatewayResponse(conn, requests["chat.history"].ID, true, map[string]interface{}{
			"sessionKey": "session-1",
			"messages": []interface{}{
				map[string]interface{}{"role": "assistant", "content": "history", "timestamp": 22},
			},
			"hasMore": false,
		}, nil); err != nil {
			return err
		}
		return writeGatewayResponse(conn, requests["sessions.list"].ID, true, map[string]interface{}{
			"count":      1,
			"totalCount": 1,
			"hasMore":    false,
			"sessions": []interface{}{
				map[string]interface{}{"key": "session-1", "displayName": "Relay chat", "updatedAt": 11},
			},
		}, nil)
	})

	client := newTestGatewayClient(t, server.URL(), 500*time.Millisecond)

	type sessionsResult struct {
		page SessionPage
		err  error
	}
	type historyResult struct {
		page HistoryPage
		err  error
	}
	sessionsCh := make(chan sessionsResult, 1)
	historyCh := make(chan historyResult, 1)
	go func() {
		page, err := client.ListSessions(context.Background(), ListSessionsParams{Limit: 10})
		sessionsCh <- sessionsResult{page: page, err: err}
	}()
	go func() {
		page, err := client.History(context.Background(), HistoryParams{SessionKey: "session-1"})
		historyCh <- historyResult{page: page, err: err}
	}()

	sessions := <-sessionsCh
	if sessions.err != nil {
		t.Fatalf("list sessions: %v", sessions.err)
	}
	if got := sessions.page.Sessions[0].DisplayName; got != "Relay chat" {
		t.Fatalf("session display name = %q, want Relay chat", got)
	}
	history := <-historyCh
	if history.err != nil {
		t.Fatalf("history: %v", history.err)
	}
	if got := history.page.Messages[0].Content[0].Text; got != "history" {
		t.Fatalf("history text = %q, want history", got)
	}
}

func TestGatewayReturnsTypedRPCError(t *testing.T) {
	server := newFakeGateway(t, func(conn *websocket.Conn, _ int) error {
		req, err := readGatewayRequest(conn)
		if err != nil {
			return err
		}
		return writeGatewayResponse(conn, req.ID, false, nil, map[string]interface{}{
			"code":         "UNAVAILABLE",
			"message":      "gateway warming up",
			"retryable":    true,
			"retryAfterMs": 250,
		})
	})
	client := newTestGatewayClient(t, server.URL(), 500*time.Millisecond)

	_, err := client.ListSessions(context.Background(), ListSessionsParams{})
	var rpcErr *RPCError
	if !errors.As(err, &rpcErr) {
		t.Fatalf("error = %T %v, want *RPCError", err, err)
	}
	if rpcErr.Code != "UNAVAILABLE" || rpcErr.Message != "gateway warming up" || !rpcErr.Retryable || rpcErr.RetryAfter != 250*time.Millisecond {
		t.Fatalf("unexpected RPC error: %#v", rpcErr)
	}
}

func TestGatewayMalformedFrameRejectsPendingCall(t *testing.T) {
	server := newFakeGateway(t, func(conn *websocket.Conn, _ int) error {
		if _, err := readGatewayRequest(conn); err != nil {
			return err
		}
		return conn.WriteMessage(websocket.TextMessage, []byte("not-json"))
	})
	client := newTestGatewayClient(t, server.URL(), 500*time.Millisecond)

	_, err := client.ListSessions(context.Background(), ListSessionsParams{})
	if !errors.Is(err, ErrProtocol) {
		t.Fatalf("error = %v, want ErrProtocol", err)
	}
}

func TestGatewayRequestTimeout(t *testing.T) {
	server := newFakeGateway(t, func(conn *websocket.Conn, _ int) error {
		if _, err := readGatewayRequest(conn); err != nil {
			return err
		}
		time.Sleep(100 * time.Millisecond)
		return nil
	})
	client := newTestGatewayClient(t, server.URL(), 20*time.Millisecond)

	_, err := client.ListSessions(context.Background(), ListSessionsParams{})
	if !errors.Is(err, ErrRequestTimeout) {
		t.Fatalf("error = %v, want ErrRequestTimeout", err)
	}
}

func TestGatewayConnectionCloseRejectsPendingCall(t *testing.T) {
	server := newFakeGateway(t, func(conn *websocket.Conn, _ int) error {
		if _, err := readGatewayRequest(conn); err != nil {
			return err
		}
		return conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "restart"), time.Now().Add(time.Second))
	})
	client := newTestGatewayClient(t, server.URL(), 500*time.Millisecond)

	_, err := client.ListSessions(context.Background(), ListSessionsParams{})
	if !errors.Is(err, ErrDisconnected) {
		t.Fatalf("error = %v, want ErrDisconnected", err)
	}
}

func TestGatewayTypedWrappersAndNormalizedEvents(t *testing.T) {
	server := newFakeGateway(t, func(conn *websocket.Conn, _ int) error {
		list, err := readGatewayRequest(conn)
		if err != nil {
			return err
		}
		if list.Method != "sessions.list" || !jsonObjectContains(list.Params, `"limit":2`) {
			return fmt.Errorf("unexpected sessions.list request: %#v %s", list, list.Params)
		}
		if err := writeGatewayResponse(conn, list.ID, true, map[string]interface{}{
			"count": 1, "totalCount": 3, "nextOffset": 2, "hasMore": true,
			"sessions": []interface{}{map[string]interface{}{
				"key": "session-1", "sessionId": "internal-1", "label": "Ops", "updatedAt": 10, "hasActiveRun": true,
			}},
		}, nil); err != nil {
			return err
		}

		history, err := readGatewayRequest(conn)
		if err != nil {
			return err
		}
		if history.Method != "chat.history" || !jsonObjectContains(history.Params, `"sessionKey":"session-1"`, `"limit":50`, `"maxChars":100000`) {
			return fmt.Errorf("unexpected chat.history request: %#v %s", history, history.Params)
		}
		if err := writeGatewayResponse(conn, history.ID, true, map[string]interface{}{
			"sessionKey": "session-1", "sessionId": "internal-1", "offset": 0, "nextOffset": 50, "hasMore": true, "totalMessages": 75,
			"messages": []interface{}{map[string]interface{}{
				"role": "user", "timestamp": 20,
				"content":    []interface{}{map[string]interface{}{"type": "text", "text": "inspect cpu"}},
				"__openclaw": map[string]interface{}{"id": "message-1"},
			}},
		}, nil); err != nil {
			return err
		}

		send, err := readGatewayRequest(conn)
		if err != nil {
			return err
		}
		if send.Method != "chat.send" || !jsonObjectContains(send.Params, `"sessionKey":"session-1"`, `"agentId":"main"`, `"message":"hello"`, `"idempotencyKey":"send-1"`) {
			return fmt.Errorf("unexpected chat.send request: %#v %s", send, send.Params)
		}
		if err := writeGatewayResponse(conn, send.ID, true, map[string]interface{}{"runId": "run-1", "status": "started"}, nil); err != nil {
			return err
		}

		subscribe, err := readGatewayRequest(conn)
		if err != nil {
			return err
		}
		if subscribe.Method != "sessions.subscribe" {
			return fmt.Errorf("subscribe method = %q, want sessions.subscribe", subscribe.Method)
		}
		if err := writeGatewayResponse(conn, subscribe.ID, true, map[string]interface{}{"subscribed": true}, nil); err != nil {
			return err
		}
		return conn.WriteJSON(map[string]interface{}{
			"type": "event", "event": "chat", "seq": 9,
			"payload": map[string]interface{}{
				"state": "delta", "runId": "run-1", "sessionKey": "session-1", "seq": 3, "deltaText": "working",
				"message": map[string]interface{}{"role": "assistant", "content": []interface{}{map[string]interface{}{"type": "text", "text": "working"}}, "timestamp": 30},
			},
		})
	})
	client := newTestGatewayClient(t, server.URL(), 500*time.Millisecond)

	sessions, err := client.ListSessions(context.Background(), ListSessionsParams{Limit: 2})
	if err != nil || sessions.TotalCount != 3 || sessions.NextOffset == nil || *sessions.NextOffset != 2 || !sessions.Sessions[0].HasActiveRun {
		t.Fatalf("sessions = %#v, error = %v", sessions, err)
	}
	history, err := client.History(context.Background(), HistoryParams{SessionKey: "session-1", Limit: 50, MaxChars: 100000})
	if err != nil || history.TotalMessages != 75 || history.Messages[0].ID != "message-1" {
		t.Fatalf("history = %#v, error = %v", history, err)
	}
	sent, err := client.SendMessage(context.Background(), SendMessageParams{SessionKey: "session-1", AgentID: "main", Message: "hello", IdempotencyKey: "send-1"})
	if err != nil || sent.RunID != "run-1" || sent.Status != "started" {
		t.Fatalf("send = %#v, error = %v", sent, err)
	}
	events, err := client.Subscribe(context.Background())
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	select {
	case event := <-events:
		if event.Kind != EventChat || event.SessionKey != "session-1" || event.RunID != "run-1" || event.State != "delta" || event.DeltaText != "working" || event.Sequence != 3 || event.EnvelopeSequence != 9 {
			t.Fatalf("unexpected event: %#v", event)
		}
		if event.Message == nil || event.Message.Content[0].Text != "working" {
			t.Fatalf("unexpected event message: %#v", event.Message)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for normalized event")
	}
}

func TestGatewayReconnectResubscribes(t *testing.T) {
	server := newFakeGateway(t, func(conn *websocket.Conn, connection int) error {
		subscribe, err := readGatewayRequest(conn)
		if err != nil {
			return err
		}
		if subscribe.Method != "sessions.subscribe" {
			return fmt.Errorf("connection %d first method = %q, want sessions.subscribe", connection, subscribe.Method)
		}
		if err := writeGatewayResponse(conn, subscribe.ID, true, map[string]interface{}{"subscribed": true}, nil); err != nil {
			return err
		}
		if connection == 1 {
			return conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseGoingAway, "restart"), time.Now().Add(time.Second))
		}
		return conn.WriteJSON(map[string]interface{}{
			"type": "event", "event": "sessions.changed", "seq": 10,
			"payload": map[string]interface{}{"sessionKey": "session-1", "reason": "message"},
		})
	})
	client := newTestGatewayClient(t, server.URL(), 500*time.Millisecond)
	events, err := client.Subscribe(context.Background())
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}

	select {
	case <-client.Disconnected():
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for disconnect hook")
	}
	if err := client.Reconnect(context.Background()); err != nil {
		t.Fatalf("reconnect: %v", err)
	}
	select {
	case event := <-events:
		if event.Kind != EventSessionsChanged || event.SessionKey != "session-1" || event.Reason != "message" || event.EnvelopeSequence != 10 {
			t.Fatalf("unexpected event after reconnect: %#v", event)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for event after reconnect")
	}
}

func TestGatewayReconnectRejectsCallsFromDisplacedConnection(t *testing.T) {
	requestStarted := make(chan struct{})
	release := make(chan struct{})
	server := newFakeGateway(t, func(conn *websocket.Conn, connection int) error {
		if connection == 1 {
			if _, err := readGatewayRequest(conn); err != nil {
				return err
			}
			close(requestStarted)
			_, _, _ = conn.ReadMessage()
			return nil
		}
		<-release
		return nil
	})
	client := newTestGatewayClient(t, server.URL(), time.Second)

	callResult := make(chan error, 1)
	go func() {
		_, err := client.ListSessions(context.Background(), ListSessionsParams{})
		callResult <- err
	}()
	select {
	case <-requestStarted:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for first connection request")
	}
	if err := client.Reconnect(context.Background()); err != nil {
		t.Fatalf("reconnect: %v", err)
	}
	select {
	case err := <-callResult:
		if !errors.Is(err, ErrDisconnected) {
			t.Fatalf("displaced call error = %v, want ErrDisconnected", err)
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatal("displaced call was not rejected during reconnect")
	}
	close(release)
}

func TestGatewaySerializesConcurrentReconnects(t *testing.T) {
	release := make(chan struct{})
	server := newFakeGateway(t, func(_ *websocket.Conn, _ int) error {
		<-release
		return nil
	})
	client := newTestGatewayClient(t, server.URL(), 500*time.Millisecond)
	results := make(chan error, 2)
	go func() { results <- client.Reconnect(context.Background()) }()
	go func() { results <- client.Reconnect(context.Background()) }()
	for i := 0; i < 2; i++ {
		select {
		case err := <-results:
			if err != nil {
				t.Fatalf("reconnect %d: %v", i+1, err)
			}
		case <-time.After(time.Second):
			t.Fatal("concurrent reconnect did not complete")
		}
	}
	close(release)
}

func TestGatewaySubscribeRetriesAfterFailedResubscribe(t *testing.T) {
	retrySeen := make(chan struct{})
	server := newFakeGateway(t, func(conn *websocket.Conn, connection int) error {
		if connection == 1 {
			req, err := readGatewayRequest(conn)
			if err != nil {
				return err
			}
			if err := writeGatewayResponse(conn, req.ID, true, map[string]interface{}{"subscribed": true}, nil); err != nil {
				return err
			}
			return conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseGoingAway, "restart"), time.Now().Add(time.Second))
		}
		failed, err := readGatewayRequest(conn)
		if err != nil {
			return err
		}
		if err := writeGatewayResponse(conn, failed.ID, false, nil, map[string]interface{}{"code": "UNAVAILABLE", "message": "retry me"}); err != nil {
			return err
		}
		retry, err := readGatewayRequest(conn)
		if err != nil {
			return err
		}
		if retry.Method != "sessions.subscribe" {
			return fmt.Errorf("retry method = %q, want sessions.subscribe", retry.Method)
		}
		close(retrySeen)
		return writeGatewayResponse(conn, retry.ID, true, map[string]interface{}{"subscribed": true}, nil)
	})
	client := newTestGatewayClient(t, server.URL(), 500*time.Millisecond)
	if _, err := client.Subscribe(context.Background()); err != nil {
		t.Fatalf("initial subscribe: %v", err)
	}
	select {
	case <-client.Disconnected():
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for disconnect")
	}
	if err := client.Reconnect(context.Background()); err == nil {
		t.Fatal("reconnect error = nil, want failed resubscribe error")
	}
	if _, err := client.Subscribe(context.Background()); err != nil {
		t.Fatalf("retry subscribe: %v", err)
	}
	select {
	case <-retrySeen:
	case <-time.After(time.Second):
		t.Fatal("retry Subscribe did not send sessions.subscribe")
	}
}

func TestGatewayPreservesTerminalChatDetails(t *testing.T) {
	server := newFakeGateway(t, func(conn *websocket.Conn, _ int) error {
		req, err := readGatewayRequest(conn)
		if err != nil {
			return err
		}
		if err := writeGatewayResponse(conn, req.ID, true, map[string]interface{}{"subscribed": true}, nil); err != nil {
			return err
		}
		for _, payload := range []map[string]interface{}{
			{"state": "final", "sessionKey": "session-1", "runId": "run-1", "seq": 1, "stopReason": "complete"},
			{"state": "aborted", "sessionKey": "session-1", "runId": "run-2", "seq": 2, "errorMessage": "cancelled", "stopReason": "user"},
			{"state": "error", "sessionKey": "session-1", "runId": "run-3", "seq": 3, "errorMessage": "timed out", "errorKind": "timeout", "stopReason": "deadline"},
		} {
			if err := conn.WriteJSON(map[string]interface{}{"type": "event", "event": "chat", "payload": payload}); err != nil {
				return err
			}
		}
		return nil
	})
	client := newTestGatewayClient(t, server.URL(), 500*time.Millisecond)
	events, err := client.Subscribe(context.Background())
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	wants := []struct {
		state, errorKind, errorMessage, stopReason string
	}{
		{"final", "", "", "complete"},
		{"aborted", "", "cancelled", "user"},
		{"error", "timeout", "timed out", "deadline"},
	}
	for _, want := range wants {
		select {
		case event := <-events:
			if event.State != want.state || event.ErrorKind != want.errorKind || event.ErrorMessage != want.errorMessage || event.StopReason != want.stopReason {
				t.Fatalf("event = %#v, want terminal details %#v", event, want)
			}
		case <-time.After(time.Second):
			t.Fatalf("timed out waiting for %s event", want.state)
		}
	}
}

type gatewayTestRequest struct {
	Type   string          `json:"type"`
	ID     string          `json:"id"`
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
}

type fakeGateway struct {
	t             *testing.T
	server        *httptest.Server
	errs          chan error
	wg            sync.WaitGroup
	helloProtocol int
}

func newFakeGateway(t *testing.T, handler func(*websocket.Conn, int) error) *fakeGateway {
	return newFakeGatewayWithHandshake(t, func(conn *websocket.Conn, fake *fakeGateway) error {
		return fakeGatewayHandshake(conn, fake.helloProtocol)
	}, handler)
}

func newRawFakeGateway(t *testing.T, handler func(*websocket.Conn, int) error) *fakeGateway {
	return newFakeGatewayWithHandshake(t, nil, handler)
}

func newFakeGatewayWithHandshake(t *testing.T, handshake func(*websocket.Conn, *fakeGateway) error, handler func(*websocket.Conn, int) error) *fakeGateway {
	t.Helper()
	fake := &fakeGateway{t: t, errs: make(chan error, 8), helloProtocol: gatewayProtocolVersion}
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	var mu sync.Mutex
	connection := 0
	fake.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			fake.errs <- err
			return
		}
		defer conn.Close()
		mu.Lock()
		connection++
		current := connection
		mu.Unlock()
		fake.wg.Add(1)
		defer fake.wg.Done()

		if handshake != nil {
			if err := handshake(conn, fake); err != nil {
				fake.errs <- fmt.Errorf("handshake connection %d: %w", current, err)
				return
			}
		}
		if err := handler(conn, current); err != nil && !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
			fake.errs <- fmt.Errorf("handler connection %d: %w", current, err)
		}
	}))
	t.Cleanup(fake.close)
	return fake
}

func (f *fakeGateway) URL() string {
	return "ws" + strings.TrimPrefix(f.server.URL, "http")
}

func (f *fakeGateway) close() {
	f.server.Close()
	f.wg.Wait()
	close(f.errs)
	for err := range f.errs {
		f.t.Errorf("fake gateway: %v", err)
	}
}

func fakeGatewayHandshake(conn *websocket.Conn, protocol int) error {
	if err := conn.WriteJSON(map[string]interface{}{
		"type": "event", "event": "connect.challenge", "payload": map[string]interface{}{"nonce": "nonce-1", "ts": 1},
	}); err != nil {
		return err
	}
	req, err := readGatewayRequest(conn)
	if err != nil {
		return err
	}
	if req.Method != "connect" {
		return fmt.Errorf("handshake method = %q, want connect", req.Method)
	}
	if !jsonObjectContains(req.Params, `"minProtocol":4`, `"maxProtocol":4`, `"id":"cli"`, `"mode":"cli"`, `"displayName":"CloudHub"`, `"token":"test-token"`, `"scopes":["operator.read","operator.write"]`) {
		return fmt.Errorf("unexpected connect params: %s", req.Params)
	}
	return writeHelloOK(conn, req.ID, protocol)
}

func writeHelloOK(conn *websocket.Conn, id string, protocol int) error {
	return writeHelloOKWithAuth(conn, id, protocol, "operator", []string{"operator.read", "operator.write"}, "test-token")
}

func writeHelloOKWithAuth(conn *websocket.Conn, id string, protocol int, role string, scopes []string, deviceToken string) error {
	return writeGatewayResponse(conn, id, true, map[string]interface{}{
		"type": "hello-ok", "protocol": protocol,
		"server":   map[string]interface{}{"version": "2026.7.1", "connId": "fake"},
		"features": map[string]interface{}{"methods": []string{}, "events": []string{}},
		"snapshot": map[string]interface{}{"presence": []interface{}{}},
		"policy":   map[string]interface{}{"maxPayload": 1024, "maxBufferedBytes": 1024, "tickIntervalMs": 30000},
		"auth":     map[string]interface{}{"role": role, "scopes": scopes, "deviceToken": deviceToken},
	}, nil)
}

func fakeGatewayHandshakeWithAuth(role string, scopes []string, deviceToken string) func(*websocket.Conn, int) error {
	return func(conn *websocket.Conn, _ int) error {
		if err := conn.WriteJSON(map[string]interface{}{
			"type": "event", "event": "connect.challenge", "payload": map[string]interface{}{"nonce": "nonce-1", "ts": 1},
		}); err != nil {
			return err
		}
		req, err := readGatewayRequest(conn)
		if err != nil {
			return err
		}
		if req.Method != "connect" {
			return fmt.Errorf("handshake method = %q, want connect", req.Method)
		}
		return writeHelloOKWithAuth(conn, req.ID, gatewayProtocolVersion, role, scopes, deviceToken)
	}
}

func readGatewayRequest(conn *websocket.Conn) (gatewayTestRequest, error) {
	var req gatewayTestRequest
	if err := conn.ReadJSON(&req); err != nil {
		return gatewayTestRequest{}, err
	}
	if req.Type != "req" || req.ID == "" || req.Method == "" {
		return gatewayTestRequest{}, fmt.Errorf("invalid request frame: %#v", req)
	}
	return req, nil
}

func writeGatewayResponse(conn *websocket.Conn, id string, ok bool, payload interface{}, rpcError interface{}) error {
	return conn.WriteJSON(map[string]interface{}{
		"type": "res", "id": id, "ok": ok, "payload": payload, "error": rpcError,
	})
}

func jsonObjectContains(raw json.RawMessage, fragments ...string) bool {
	compact := strings.ReplaceAll(strings.ReplaceAll(string(raw), " ", ""), "\n", "")
	for _, fragment := range fragments {
		if !strings.Contains(compact, fragment) {
			return false
		}
	}
	return true
}

func newTestGatewayClient(t *testing.T, url string, timeout time.Duration) *GatewayClient {
	t.Helper()
	client, err := NewGatewayClient(context.Background(), GatewayConfig{
		URL:            url,
		Token:          "test-token",
		RequestTimeout: timeout,
	})
	if err != nil {
		t.Fatalf("new gateway client: %v", err)
	}
	t.Cleanup(func() {
		if err := client.Close(); err != nil && !errors.Is(err, ErrClosed) {
			t.Errorf("close gateway client: %v", err)
		}
	})
	return client
}
