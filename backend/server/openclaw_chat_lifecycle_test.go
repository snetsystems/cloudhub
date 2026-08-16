package server

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/openclaw"
)

func TestOpenClawGatewayManagerRetriesInitialConnection(t *testing.T) {
	gateway := &lifecycleGateway{
		events:       make(chan openclaw.GatewayEvent),
		disconnected: make(chan struct{}, 1),
		reconnect:    []error{errors.New("temporary dial failure"), nil},
	}
	manager := newOpenClawGatewayManager(context.Background(), gateway, nil)
	defer manager.Close()

	waitForLifecycleCalls(t, gateway.ReconnectCalls, 2)
}

func TestOpenClawGatewayManagerLogsInitialRetryAndConnection(t *testing.T) {
	gateway := &lifecycleGateway{
		events:       make(chan openclaw.GatewayEvent),
		disconnected: make(chan struct{}, 1),
		reconnect:    []error{errors.New("temporary dial failure secret-device-token"), nil},
	}
	logger := &lifecycleLogger{}
	manager := newOpenClawGatewayManager(context.Background(), gateway, logger)
	defer manager.Close()

	waitForLifecycleLog(t, logger, "error", "OpenClaw gateway connection failed; retrying")
	waitForLifecycleLog(t, logger, "info", "OpenClaw gateway connection established")
	if logger.hasFieldContaining("secret-device-token") {
		t.Fatal("retry log exposed the gateway error message")
	}
	if !logger.hasField("error_kind", "connection") {
		t.Fatal("retry log has no safe connection error classification")
	}
}

func TestOpenClawGatewayManagerDropsDisconnectFromFailedReconnect(t *testing.T) {
	unexpectedReconnect := make(chan struct{})
	gateway := &lifecycleGateway{
		events:                    make(chan openclaw.GatewayEvent),
		disconnected:              make(chan struct{}, 1),
		reconnect:                 []error{nil, errors.New("resubscribe failed"), nil},
		disconnectOnReconnectCall: 2,
		unexpectedReconnectCall:   4,
		unexpectedReconnect:       unexpectedReconnect,
	}
	manager := newOpenClawGatewayManager(context.Background(), gateway, nil)
	defer manager.Close()
	waitForLifecycleCalls(t, gateway.ReconnectCalls, 1)
	if _, err := manager.Subscribe(context.Background()); err != nil {
		t.Fatal(err)
	}

	gateway.disconnected <- struct{}{}
	waitForLifecycleCalls(t, gateway.ReconnectCalls, 3)
	select {
	case <-unexpectedReconnect:
		t.Fatal("stale disconnect triggered another reconnect")
	case <-time.After(100 * time.Millisecond):
	}
}

func TestOpenClawGatewayManagerRecreatesSubscriptionAndPublishesResync(t *testing.T) {
	gateway := &lifecycleGateway{
		events:       make(chan openclaw.GatewayEvent, 1),
		disconnected: make(chan struct{}, 1),
		reconnect:    []error{errors.New("temporary dial failure"), nil},
	}
	manager := newOpenClawGatewayManager(context.Background(), gateway, nil)
	defer manager.Close()
	waitForLifecycleCalls(t, gateway.ReconnectCalls, 2)

	events, err := manager.Subscribe(context.Background())
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	if gateway.SubscribeCalls() != 1 {
		t.Fatalf("initial subscriptions = %d, want 1", gateway.SubscribeCalls())
	}

	gateway.disconnected <- struct{}{}

	select {
	case event := <-events:
		if event.Kind != openclaw.EventSessionsChanged || event.Reason != "resync" {
			t.Fatalf("reconnect event = %#v, want sessions.changed resync", event)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for reconnect resync event")
	}
	if gateway.ReconnectCalls() != 3 {
		t.Fatalf("reconnect calls = %d, want 3", gateway.ReconnectCalls())
	}
	if gateway.ResubscribeCalls() != 1 {
		t.Fatalf("reconnect resubscriptions = %d, want 1", gateway.ResubscribeCalls())
	}
}

func TestOpenClawGatewayManagerCloseCancelsReconnectAndClosesGateway(t *testing.T) {
	gateway := &lifecycleGateway{
		events:        make(chan openclaw.GatewayEvent),
		disconnected:  make(chan struct{}, 1),
		reconnect:     []error{context.Canceled},
		reconnectWait: make(chan struct{}),
	}
	manager := newOpenClawGatewayManager(context.Background(), gateway, nil)

	waitForLifecycleCalls(t, gateway.ReconnectCalls, 1)
	if err := manager.Close(); err != nil {
		t.Fatalf("close manager: %v", err)
	}

	select {
	case <-gateway.reconnectContextDone:
	case <-time.After(time.Second):
		t.Fatal("reconnect context was not cancelled")
	}
	if gateway.CloseCalls() != 1 {
		t.Fatalf("gateway close calls = %d, want 1", gateway.CloseCalls())
	}
}

func TestOpenClawGatewayManagerClosesGatewayWhenServerContextIsCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	gateway := &lifecycleGateway{
		events:       make(chan openclaw.GatewayEvent),
		disconnected: make(chan struct{}),
	}
	manager := newOpenClawGatewayManager(ctx, gateway, nil)
	defer manager.Close()

	cancel()
	waitForLifecycleCalls(t, gateway.CloseCalls, 1)
}

func TestOpenClawGatewayManagerClosesGatewayWhenContextIsCancelledDuringInitialReconnect(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	gateway := &lifecycleGateway{
		events:        make(chan openclaw.GatewayEvent),
		disconnected:  make(chan struct{}),
		reconnectWait: make(chan struct{}),
	}
	newOpenClawGatewayManager(ctx, gateway, nil)
	waitForLifecycleCalls(t, gateway.ReconnectCalls, 1)

	cancel()
	waitForLifecycleCalls(t, gateway.CloseCalls, 1)
}

func TestOpenClawGatewayManagerDelegatesPluginApprovals(t *testing.T) {
	gateway := &lifecycleGateway{
		events:       make(chan openclaw.GatewayEvent),
		disconnected: make(chan struct{}),
		approvals: []openclaw.PluginApproval{
			{ID: "plugin:full-id", SessionKey: "session-owned"},
		},
	}
	manager := newOpenClawGatewayManager(context.Background(), gateway, nil)
	defer manager.Close()

	approvals, err := manager.ListPluginApprovals(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(approvals) != 1 || approvals[0].ID != "plugin:full-id" {
		t.Fatalf("approvals = %#v", approvals)
	}
	params := openclaw.ResolvePluginApprovalParams{
		ID: "plugin:full-id", Decision: openclaw.DecisionDeny,
	}
	if err := manager.ResolvePluginApproval(context.Background(), params); err != nil {
		t.Fatal(err)
	}
	if gateway.resolved != params {
		t.Fatalf("resolved params = %#v, want %#v", gateway.resolved, params)
	}
}

func TestServerOpenClawGatewayManagerUsesConfiguredCredentialsWithoutLoggingToken(t *testing.T) {
	originalFactory := newOpenClawGatewayClient
	defer func() { newOpenClawGatewayClient = originalFactory }()

	gateway := &lifecycleGateway{
		events:       make(chan openclaw.GatewayEvent),
		disconnected: make(chan struct{}),
	}
	var got openclaw.GatewayConfig
	newOpenClawGatewayClient = func(_ context.Context, config openclaw.GatewayConfig) (openClawGatewayLifecycle, error) {
		got = config
		return gateway, nil
	}

	keyPath, tokenPath, wantKey := writePairedDeviceCredentials(t)

	manager, deviceID, err := (&Server{
		OpenClawGatewayURL:           "ws://gateway.internal:18789",
		OpenClawDevicePrivateKeyFile: keyPath,
		OpenClawDeviceTokenFile:      tokenPath,
	}).newOpenClawGatewayManager(context.Background(), nil)
	if err != nil {
		t.Fatalf("new gateway manager: %v", err)
	}
	defer manager.Close()
	if want := openclaw.DeviceID(wantKey); deviceID != want {
		t.Fatalf("device id = %q, want %q", deviceID, want)
	}
	if got.URL != "ws://gateway.internal:18789" {
		t.Fatalf("gateway URL = %q", got.URL)
	}
	if got.Token != "device-token" {
		t.Fatalf("gateway token was not loaded from device token file")
	}
	if string(got.DevicePrivateKey) != string(wantKey) {
		t.Fatal("device private key was not loaded from device private key file")
	}
	wantScopes := []string{"operator.read", "operator.write", "operator.approvals"}
	if len(got.RequiredScopes) != len(wantScopes) {
		t.Fatalf("required scopes = %v, want %v", got.RequiredScopes, wantScopes)
	}
	for i, scope := range wantScopes {
		if got.RequiredScopes[i] != scope {
			t.Fatalf("required scopes = %v, want %v", got.RequiredScopes, wantScopes)
		}
	}
}

func TestServerOpenClawGatewayManagerStartsWhenGatewayIsUnavailable(t *testing.T) {
	keyPath, tokenPath, _ := writePairedDeviceCredentials(t)

	manager, _, err := (&Server{
		OpenClawGatewayURL:           "ws://127.0.0.1:1",
		OpenClawDevicePrivateKeyFile: keyPath,
		OpenClawDeviceTokenFile:      tokenPath,
	}).newOpenClawGatewayManager(context.Background(), nil)
	if err != nil {
		t.Fatalf("new gateway manager: %v", err)
	}
	if manager == nil {
		t.Fatal("gateway manager is nil")
	}
	defer manager.Close()
}

func TestServerOpenClawGatewayManagerMissingCredentialFileDisablesManagerWithSanitizedError(t *testing.T) {
	originalFactory := newOpenClawGatewayClient
	defer func() { newOpenClawGatewayClient = originalFactory }()
	newOpenClawGatewayClient = func(context.Context, openclaw.GatewayConfig) (openClawGatewayLifecycle, error) {
		t.Fatal("gateway client factory should not be called when credentials are missing")
		return nil, nil
	}

	dir := t.TempDir()
	_, tokenPath, _ := writePairedDeviceCredentials(t)

	manager, _, err := (&Server{
		OpenClawGatewayURL:           "ws://gateway.internal:18789",
		OpenClawDevicePrivateKeyFile: filepath.Join(dir, "missing.key"),
		OpenClawDeviceTokenFile:      tokenPath,
	}).newOpenClawGatewayManager(context.Background(), nil)
	if err == nil {
		t.Fatal("expected error when device private key file is missing")
	}
	if manager != nil {
		t.Fatal("expected nil manager when credentials fail to load")
	}
	if strings.Contains(err.Error(), "device-token") {
		t.Fatalf("error leaked device token: %v", err)
	}
}

func TestServerOpenClawGatewayManagerNeverUsesGatewayAdministratorTokenAtRuntime(t *testing.T) {
	originalFactory := newOpenClawGatewayClient
	defer func() { newOpenClawGatewayClient = originalFactory }()

	gateway := &lifecycleGateway{
		events:       make(chan openclaw.GatewayEvent),
		disconnected: make(chan struct{}),
	}
	var got openclaw.GatewayConfig
	newOpenClawGatewayClient = func(_ context.Context, config openclaw.GatewayConfig) (openClawGatewayLifecycle, error) {
		got = config
		return gateway, nil
	}

	keyPath, tokenPath, _ := writePairedDeviceCredentials(t)

	// Server no longer has a Gateway administrator token field: runtime
	// reconnects must rely solely on the paired device token loaded from
	// OpenClawDeviceTokenFile.
	manager, _, err := (&Server{
		OpenClawGatewayURL:           "ws://gateway.internal:18789",
		OpenClawDevicePrivateKeyFile: keyPath,
		OpenClawDeviceTokenFile:      tokenPath,
	}).newOpenClawGatewayManager(context.Background(), nil)
	if err != nil {
		t.Fatalf("new gateway manager: %v", err)
	}
	defer manager.Close()
	if got.Token != "device-token" {
		t.Fatalf("gateway config token = %q, want paired device token", got.Token)
	}
}

func writePairedDeviceCredentials(t *testing.T) (keyPath, tokenPath string, privateKey ed25519.PrivateKey) {
	t.Helper()
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	dir := t.TempDir()
	keyPath = filepath.Join(dir, "device.key")
	tokenPath = filepath.Join(dir, "device.token")
	if err := os.WriteFile(keyPath, []byte(base64.RawStdEncoding.EncodeToString(privateKey)), 0o600); err != nil {
		t.Fatalf("write device key: %v", err)
	}
	if err := os.WriteFile(tokenPath, []byte("device-token"), 0o600); err != nil {
		t.Fatalf("write device token: %v", err)
	}
	return keyPath, tokenPath, privateKey
}

func TestOpenClawResyncEventIsForwardedToConnectedClients(t *testing.T) {
	event := openClawEventResponse("", openclaw.GatewayEvent{
		Kind:   openclaw.EventSessionsChanged,
		Reason: "resync",
	})
	if event.Type != openclaw.EventSessionsChanged || event.Reason != "resync" {
		t.Fatalf("resync event = %#v", event)
	}
}

type lifecycleGateway struct {
	events                    chan openclaw.GatewayEvent
	disconnected              chan struct{}
	reconnect                 []error
	reconnectWait             chan struct{}
	reconnectContextDone      chan struct{}
	disconnectOnReconnectCall int
	unexpectedReconnectCall   int
	unexpectedReconnect       chan struct{}

	mu               sync.Mutex
	subscribeCalls   int
	reconnectCalls   int
	resubscribeCalls int
	closeCalls       int
	subscribed       bool
	approvals        []openclaw.PluginApproval
	resolved         openclaw.ResolvePluginApprovalParams
}

func (g *lifecycleGateway) History(context.Context, openclaw.HistoryParams) (openclaw.HistoryPage, error) {
	return openclaw.HistoryPage{}, nil
}

func (g *lifecycleGateway) ListAgents(context.Context) (openclaw.AgentList, error) {
	return openclaw.AgentList{}, nil
}

func (g *lifecycleGateway) ListPluginApprovals(context.Context) ([]openclaw.PluginApproval, error) {
	return append([]openclaw.PluginApproval(nil), g.approvals...), nil
}

func (g *lifecycleGateway) ResolvePluginApproval(_ context.Context, params openclaw.ResolvePluginApprovalParams) error {
	g.resolved = params
	return nil
}

func (g *lifecycleGateway) SendMessage(context.Context, openclaw.SendMessageParams) (openclaw.SendMessageResult, error) {
	return openclaw.SendMessageResult{}, nil
}

func (g *lifecycleGateway) Subscribe(context.Context) (<-chan openclaw.GatewayEvent, error) {
	g.mu.Lock()
	g.subscribeCalls++
	g.subscribed = true
	g.mu.Unlock()
	return g.events, nil
}

func (g *lifecycleGateway) Reconnect(ctx context.Context) error {
	g.mu.Lock()
	g.reconnectCalls++
	call := g.reconnectCalls
	if g.reconnectWait != nil && g.reconnectContextDone == nil {
		g.reconnectContextDone = make(chan struct{})
	}
	contextDone := g.reconnectContextDone
	disconnectOnReconnectCall := g.disconnectOnReconnectCall
	unexpectedReconnectCall := g.unexpectedReconnectCall
	unexpectedReconnect := g.unexpectedReconnect
	g.mu.Unlock()
	if call == disconnectOnReconnectCall {
		select {
		case g.disconnected <- struct{}{}:
		default:
		}
	}
	if call == unexpectedReconnectCall && unexpectedReconnect != nil {
		close(unexpectedReconnect)
	}

	if g.reconnectWait != nil {
		select {
		case <-g.reconnectWait:
		case <-ctx.Done():
			close(contextDone)
			return ctx.Err()
		}
	}

	g.mu.Lock()
	defer g.mu.Unlock()
	if call <= len(g.reconnect) {
		if err := g.reconnect[call-1]; err != nil {
			return err
		}
	}
	if g.subscribed {
		g.resubscribeCalls++
	}
	return nil
}

func (g *lifecycleGateway) Disconnected() <-chan struct{} { return g.disconnected }

func (g *lifecycleGateway) Close() error {
	g.mu.Lock()
	g.closeCalls++
	g.mu.Unlock()
	return nil
}

func (g *lifecycleGateway) SubscribeCalls() int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.subscribeCalls
}

func (g *lifecycleGateway) ReconnectCalls() int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.reconnectCalls
}

func (g *lifecycleGateway) ResubscribeCalls() int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.resubscribeCalls
}

func (g *lifecycleGateway) CloseCalls() int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.closeCalls
}

func waitForLifecycleCalls(t *testing.T, calls func() int, want int) {
	t.Helper()
	deadline := time.After(time.Second)
	for calls() < want {
		select {
		case <-deadline:
			t.Fatalf("calls = %d, want at least %d", calls(), want)
		case <-time.After(time.Millisecond):
		}
	}
}

type lifecycleLogMessage struct {
	level string
	body  string
}

type lifecycleLogField struct {
	key   string
	value string
}

type lifecycleLogger struct {
	mu       sync.Mutex
	messages []lifecycleLogMessage
	fields   []lifecycleLogField
}

func (l *lifecycleLogger) Debug(args ...interface{}) { l.append("debug", args...) }
func (l *lifecycleLogger) Info(args ...interface{})  { l.append("info", args...) }
func (l *lifecycleLogger) Error(args ...interface{}) { l.append("error", args...) }

func (l *lifecycleLogger) WithField(key string, value interface{}) cloudhub.Logger {
	l.mu.Lock()
	l.fields = append(l.fields, lifecycleLogField{key: key, value: fmt.Sprint(value)})
	l.mu.Unlock()
	return l
}

func (l *lifecycleLogger) Writer() *io.PipeWriter {
	_, writer := io.Pipe()
	return writer
}

func (l *lifecycleLogger) append(level string, args ...interface{}) {
	l.mu.Lock()
	l.messages = append(l.messages, lifecycleLogMessage{level: level, body: fmt.Sprint(args...)})
	l.mu.Unlock()
}

func (l *lifecycleLogger) has(level, body string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	for _, message := range l.messages {
		if message.level == level && message.body == body {
			return true
		}
	}
	return false
}

func (l *lifecycleLogger) hasField(key, value string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	for _, field := range l.fields {
		if field.key == key && field.value == value {
			return true
		}
	}
	return false
}

func (l *lifecycleLogger) hasFieldContaining(value string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	for _, field := range l.fields {
		if strings.Contains(field.value, value) {
			return true
		}
	}
	return false
}

func waitForLifecycleLog(t *testing.T, logger *lifecycleLogger, level, body string) {
	t.Helper()
	deadline := time.After(time.Second)
	ticker := time.NewTicker(time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-deadline:
			t.Fatalf("missing %s lifecycle log %q", level, body)
		case <-ticker.C:
			if logger.has(level, body) {
				return
			}
		}
	}
}
