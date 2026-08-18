package openclaw

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// RequiredOperatorScopes are the exact operator scopes CloudHub requests
// when pairing as an OpenClaw operator device. Provisioning and runtime
// connections must request identical scopes.
var RequiredOperatorScopes = []string{"operator.read", "operator.write", "operator.approvals"}

// pairingRequiredCodes are the Gateway RPC error codes returned from the
// "connect" method when a device has been registered but is still waiting
// on operator approval (e.g. local auto-approval is disabled). A Gateway
// reached over a tunnel answers NOT_PAIRED rather than PAIRING_REQUIRED.
var pairingRequiredCodes = map[string]bool{
	"PAIRING_REQUIRED": true,
	"NOT_PAIRED":       true,
}

// ProvisionConfig configures provisioning of this CloudHub process as a
// paired OpenClaw operator device.
type ProvisionConfig struct {
	GatewayURL      string
	BootstrapToken  string
	PrivateKeyPath  string
	DeviceTokenPath string
	RequiredScopes  []string
}

// ProvisionResult reports the outcome of provisioning. It never contains
// secret values (private keys, tokens, signatures).
type ProvisionResult struct {
	DeviceID        string
	CreatedKey      bool
	CreatedToken    bool
	PendingApproval bool
}

// ProvisionDevice idempotently provisions this device as a paired OpenClaw
// operator device.
//
// If a device private key does not already exist at PrivateKeyPath, one is
// generated and persisted. If a device token does not already exist at
// DeviceTokenPath, ProvisionDevice pairs with the Gateway at GatewayURL
// using BootstrapToken (a provisioning-only credential; it is never used
// for runtime reconnects) and persists the token the Gateway issues.
//
// If both the key and token already exist, ProvisionDevice is a no-op and
// neither file is rewritten. If the Gateway reports that the device is
// registered but still awaiting operator approval, ProvisionDevice returns
// a result with PendingApproval set and does not create a token file; a
// later call with the same configuration retries pairing using the
// already-persisted key.
func ProvisionDevice(ctx context.Context, config ProvisionConfig) (ProvisionResult, error) {
	if strings.TrimSpace(config.GatewayURL) == "" {
		return ProvisionResult{}, errors.New("openclaw: provisioning requires a gateway URL")
	}
	if config.BootstrapToken == "" {
		return ProvisionResult{}, errors.New("openclaw: provisioning requires a bootstrap token")
	}
	if config.PrivateKeyPath == "" || config.DeviceTokenPath == "" {
		return ProvisionResult{}, errors.New("openclaw: provisioning requires a private key path and a device token path")
	}

	privateKey, createdKey, err := loadOrCreateDeviceKey(config.PrivateKeyPath)
	if err != nil {
		return ProvisionResult{}, err
	}
	deviceID := deviceIDForPublicKey(privateKey.Public().(ed25519.PublicKey))

	if _, _, err := LoadDeviceCredentials(config.PrivateKeyPath, config.DeviceTokenPath); err == nil {
		return ProvisionResult{DeviceID: deviceID, CreatedKey: createdKey}, nil
	}

	client, err := NewGatewayClient(ctx, GatewayConfig{
		URL:              config.GatewayURL,
		Token:            config.BootstrapToken,
		DevicePrivateKey: privateKey,
		RequiredScopes:   config.RequiredScopes,
	})
	if err != nil {
		var rpcErr *RPCError
		if errors.As(err, &rpcErr) && pairingRequiredCodes[rpcErr.Code] {
			return ProvisionResult{DeviceID: deviceID, CreatedKey: createdKey, PendingApproval: true}, nil
		}
		return ProvisionResult{}, fmt.Errorf("openclaw: pair with gateway: %w", err)
	}
	defer client.Close()

	deviceToken := client.DeviceToken()
	if deviceToken == "" {
		return ProvisionResult{}, fmt.Errorf("%w: hello-ok did not include a device token during provisioning", ErrProtocol)
	}

	if err := writeSecretFile(config.DeviceTokenPath, []byte(deviceToken)); err != nil {
		return ProvisionResult{}, err
	}

	return ProvisionResult{DeviceID: deviceID, CreatedKey: createdKey, CreatedToken: true}, nil
}

// DeviceID returns the Gateway device ID for a paired device private key:
// the hex SHA-256 of its Ed25519 public key. It derives no secret material
// and is safe to log.
func DeviceID(privateKey ed25519.PrivateKey) string {
	return deviceIDForPublicKey(privateKey.Public().(ed25519.PublicKey))
}

func deviceIDForPublicKey(publicKey ed25519.PublicKey) string {
	return fmt.Sprintf("%x", sha256.Sum256(publicKey))
}

// loadOrCreateDeviceKey loads the device private key from path if it
// exists, or generates and persists a new one, consistently with the
// encoding LoadDeviceCredentials expects.
func loadOrCreateDeviceKey(path string) (ed25519.PrivateKey, bool, error) {
	data, err := os.ReadFile(path)
	if err == nil {
		keyBytes, decodeErr := base64.RawStdEncoding.DecodeString(strings.TrimSpace(string(data)))
		if decodeErr != nil || len(keyBytes) != ed25519.PrivateKeySize {
			return nil, false, fmt.Errorf("openclaw: existing device private key file %q is invalid", path)
		}
		return ed25519.PrivateKey(keyBytes), false, nil
	}
	if !os.IsNotExist(err) {
		return nil, false, fmt.Errorf("openclaw: read device private key file %q: %w", path, err)
	}

	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, false, fmt.Errorf("openclaw: generate device private key: %w", err)
	}
	encoded := base64.RawStdEncoding.EncodeToString(privateKey)
	if err := writeSecretFile(path, []byte(encoded)); err != nil {
		return nil, false, err
	}
	return privateKey, true, nil
}

// writeSecretFile atomically persists secret contents at path with
// owner-only permissions: it creates the parent directory as 0700, writes
// to a temporary file in the same directory, then renames it into place.
func writeSecretFile(path string, contents []byte) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("openclaw: create directory %q: %w", dir, err)
	}
	tmp, err := os.CreateTemp(dir, ".openclaw-provision-*")
	if err != nil {
		return fmt.Errorf("openclaw: create temp file in %q: %w", dir, err)
	}
	tmpPath := tmp.Name()
	succeeded := false
	defer func() {
		if !succeeded {
			os.Remove(tmpPath)
		}
	}()

	if _, err := tmp.Write(contents); err != nil {
		tmp.Close()
		return fmt.Errorf("openclaw: write temp file %q: %w", tmpPath, err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("openclaw: close temp file %q: %w", tmpPath, err)
	}
	if err := os.Chmod(tmpPath, 0o600); err != nil {
		return fmt.Errorf("openclaw: chmod temp file %q: %w", tmpPath, err)
	}
	if err := os.Rename(tmpPath, path); err != nil {
		return fmt.Errorf("openclaw: rename temp file to %q: %w", path, err)
	}
	succeeded = true
	return nil
}
