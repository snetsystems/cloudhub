package server

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/snetsystems/cloudhub/backend/openclaw"
)

func TestOpenClawGatewayManagerRecreatesSubscriptionAndPublishesResync(t *testing.T) {
	gateway := &lifecycleGateway{
		events:       make(chan openclaw.GatewayEvent, 1),
		disconnected: make(chan struct{}, 1),
		reconnect:    []error{errors.New("temporary dial failure"), nil},
	}
	manager := newOpenClawGatewayManager(context.Background(), gateway)
	manager.reconnectInitialBackoff = time.Millisecond
	manager.reconnectMaxBackoff = time.Millisecond
	defer manager.Close()

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
	if gateway.ReconnectCalls() != 2 {
		t.Fatalf("reconnect calls = %d, want 2", gateway.ReconnectCalls())
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
	manager := newOpenClawGatewayManager(context.Background(), gateway)
	manager.reconnectInitialBackoff = time.Millisecond
	manager.reconnectMaxBackoff = time.Millisecond

	gateway.disconnected <- struct{}{}
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
	manager := newOpenClawGatewayManager(ctx, gateway)
	defer manager.Close()

	cancel()
	waitForLifecycleCalls(t, gateway.CloseCalls, 1)
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
	}).newOpenClawGatewayManager(context.Background())
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
	wantScopes := []string{"operator.read", "operator.write"}
	if len(got.RequiredScopes) != len(wantScopes) {
		t.Fatalf("required scopes = %v, want %v", got.RequiredScopes, wantScopes)
	}
	for i, scope := range wantScopes {
		if got.RequiredScopes[i] != scope {
			t.Fatalf("required scopes = %v, want %v", got.RequiredScopes, wantScopes)
		}
	}
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
	}).newOpenClawGatewayManager(context.Background())
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
	}).newOpenClawGatewayManager(context.Background())
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
	events               chan openclaw.GatewayEvent
	disconnected         chan struct{}
	reconnect            []error
	reconnectWait        chan struct{}
	reconnectContextDone chan struct{}

	mu               sync.Mutex
	subscribeCalls   int
	reconnectCalls   int
	resubscribeCalls int
	closeCalls       int
}

func (g *lifecycleGateway) History(context.Context, openclaw.HistoryParams) (openclaw.HistoryPage, error) {
	return openclaw.HistoryPage{}, nil
}

func (g *lifecycleGateway) SendMessage(context.Context, openclaw.SendMessageParams) (openclaw.SendMessageResult, error) {
	return openclaw.SendMessageResult{}, nil
}

func (g *lifecycleGateway) Subscribe(context.Context) (<-chan openclaw.GatewayEvent, error) {
	g.mu.Lock()
	g.subscribeCalls++
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
	g.mu.Unlock()

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
	g.resubscribeCalls++
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
