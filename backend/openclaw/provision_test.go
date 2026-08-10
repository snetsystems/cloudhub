package openclaw

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
)

func TestProvisionDeviceFirstRun(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("file mode assertions are POSIX-specific")
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
		if params.Auth["token"] != "bootstrap-token" {
			return fmt.Errorf("connect auth token = %v, want bootstrap-token", params.Auth["token"])
		}
		if params.Device["publicKey"] == "" || params.Device["signature"] == "" {
			return fmt.Errorf("device identity is incomplete: %#v", params.Device)
		}
		return writeHelloOKWithAuth(conn, req.ID, gatewayProtocolVersion, "operator", []string{"operator.read", "operator.write"}, "issued-device-token")
	})

	dir := t.TempDir()
	keyPath := filepath.Join(dir, "device.key")
	tokenPath := filepath.Join(dir, "device.token")

	result, err := ProvisionDevice(context.Background(), ProvisionConfig{
		GatewayURL:      server.URL(),
		BootstrapToken:  "bootstrap-token",
		PrivateKeyPath:  keyPath,
		DeviceTokenPath: tokenPath,
		RequiredScopes:  []string{"operator.read", "operator.write"},
	})
	if err != nil {
		t.Fatalf("provision device: %v", err)
	}
	if result.DeviceID == "" {
		t.Fatal("result.DeviceID is empty")
	}
	if !result.CreatedKey {
		t.Fatal("result.CreatedKey = false, want true")
	}
	if !result.CreatedToken {
		t.Fatal("result.CreatedToken = false, want true")
	}
	if result.PendingApproval {
		t.Fatal("result.PendingApproval = true, want false")
	}

	assertFileMode(t, keyPath, 0o600)
	assertFileMode(t, tokenPath, 0o600)

	privateKey, token, err := LoadDeviceCredentials(keyPath, tokenPath)
	if err != nil {
		t.Fatalf("load device credentials back: %v", err)
	}
	if token != "issued-device-token" {
		t.Fatalf("token = %q, want issued-device-token", token)
	}
	if len(privateKey) == 0 {
		t.Fatal("loaded private key is empty")
	}
}

func TestProvisionDeviceIdempotent(t *testing.T) {
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
		return writeHelloOKWithAuth(conn, req.ID, gatewayProtocolVersion, "operator", []string{"operator.read", "operator.write"}, "issued-device-token")
	})

	dir := t.TempDir()
	keyPath := filepath.Join(dir, "device.key")
	tokenPath := filepath.Join(dir, "device.token")
	config := ProvisionConfig{
		GatewayURL:      server.URL(),
		BootstrapToken:  "bootstrap-token",
		PrivateKeyPath:  keyPath,
		DeviceTokenPath: tokenPath,
		RequiredScopes:  []string{"operator.read", "operator.write"},
	}

	first, err := ProvisionDevice(context.Background(), config)
	if err != nil {
		t.Fatalf("first provision: %v", err)
	}

	keyBefore, err := os.ReadFile(keyPath)
	if err != nil {
		t.Fatalf("read key after first run: %v", err)
	}
	tokenBefore, err := os.ReadFile(tokenPath)
	if err != nil {
		t.Fatalf("read token after first run: %v", err)
	}
	keyInfoBefore, err := os.Stat(keyPath)
	if err != nil {
		t.Fatalf("stat key after first run: %v", err)
	}
	tokenInfoBefore, err := os.Stat(tokenPath)
	if err != nil {
		t.Fatalf("stat token after first run: %v", err)
	}

	// The fake gateway only tolerates a single connection (its handler runs
	// once per accepted connection and the server closes at test cleanup).
	// A second provisioning run that reuses on-disk credentials must not
	// dial the gateway again, so close the server now: any attempt to
	// connect will fail the test.
	server.server.Close()

	second, err := ProvisionDevice(context.Background(), config)
	if err != nil {
		t.Fatalf("second provision: %v", err)
	}
	if second.DeviceID != first.DeviceID {
		t.Fatalf("second DeviceID = %q, want %q", second.DeviceID, first.DeviceID)
	}
	if second.CreatedKey {
		t.Fatal("second run: CreatedKey = true, want false")
	}
	if second.CreatedToken {
		t.Fatal("second run: CreatedToken = true, want false")
	}
	if second.PendingApproval {
		t.Fatal("second run: PendingApproval = true, want false")
	}

	keyAfter, err := os.ReadFile(keyPath)
	if err != nil {
		t.Fatalf("read key after second run: %v", err)
	}
	tokenAfter, err := os.ReadFile(tokenPath)
	if err != nil {
		t.Fatalf("read token after second run: %v", err)
	}
	if string(keyAfter) != string(keyBefore) {
		t.Fatal("device key file contents changed on second run")
	}
	if string(tokenAfter) != string(tokenBefore) {
		t.Fatal("device token file contents changed on second run")
	}
	keyInfoAfter, err := os.Stat(keyPath)
	if err != nil {
		t.Fatalf("stat key after second run: %v", err)
	}
	tokenInfoAfter, err := os.Stat(tokenPath)
	if err != nil {
		t.Fatalf("stat token after second run: %v", err)
	}
	if !keyInfoAfter.ModTime().Equal(keyInfoBefore.ModTime()) {
		t.Fatal("device key file was rewritten on second run")
	}
	if !tokenInfoAfter.ModTime().Equal(tokenInfoBefore.ModTime()) {
		t.Fatal("device token file was rewritten on second run")
	}
}

func TestProvisionDevicePendingApproval(t *testing.T) {
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
		return writeGatewayResponse(conn, req.ID, false, nil, map[string]interface{}{
			"code":    "PAIRING_REQUIRED",
			"message": "device registered; awaiting operator approval",
		})
	})

	dir := t.TempDir()
	keyPath := filepath.Join(dir, "device.key")
	tokenPath := filepath.Join(dir, "device.token")

	result, err := ProvisionDevice(context.Background(), ProvisionConfig{
		GatewayURL:      server.URL(),
		BootstrapToken:  "super-secret-bootstrap-token",
		PrivateKeyPath:  keyPath,
		DeviceTokenPath: tokenPath,
		RequiredScopes:  []string{"operator.read", "operator.write"},
	})
	if err != nil {
		t.Fatalf("provision device: %v", err)
	}
	if !result.PendingApproval {
		t.Fatal("result.PendingApproval = false, want true")
	}
	if result.CreatedToken {
		t.Fatal("result.CreatedToken = true, want false")
	}
	if _, statErr := os.Stat(tokenPath); !os.IsNotExist(statErr) {
		t.Fatalf("device token file exists after pending approval: err = %v", statErr)
	}
	formatted := fmt.Sprintf("%+v", result)
	if strings.Contains(formatted, "super-secret-bootstrap-token") {
		t.Fatalf("provisioning result leaked bootstrap token: %s", formatted)
	}
}

func assertFileMode(t *testing.T, path string, want os.FileMode) {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat %s: %v", path, err)
	}
	if got := info.Mode().Perm(); got != want {
		t.Fatalf("%s mode = %v, want %v", path, got, want)
	}
}
