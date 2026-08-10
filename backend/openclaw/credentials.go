package openclaw

import (
	"crypto/ed25519"
	"encoding/base64"
	"fmt"
	"os"
	"strings"
)

// LoadDeviceCredentials loads the paired OpenClaw device private key and
// device token from disk. The private key file must contain the 64-byte
// Ed25519 private key encoded with base64.RawStdEncoding. The token file
// must contain the device token, optionally surrounded by whitespace.
//
// Errors reference file paths only; file contents are never included so
// that secret material cannot leak into logs.
func LoadDeviceCredentials(privateKeyPath, tokenPath string) (ed25519.PrivateKey, string, error) {
	encodedKey, err := os.ReadFile(privateKeyPath)
	if err != nil {
		return nil, "", fmt.Errorf("openclaw: read device private key file %q: %w", privateKeyPath, err)
	}
	keyBytes, err := base64.RawStdEncoding.DecodeString(strings.TrimSpace(string(encodedKey)))
	if err != nil {
		return nil, "", fmt.Errorf("openclaw: decode device private key file %q: not valid base64", privateKeyPath)
	}
	if len(keyBytes) != ed25519.PrivateKeySize {
		return nil, "", fmt.Errorf("openclaw: device private key file %q: want %d bytes, got %d", privateKeyPath, ed25519.PrivateKeySize, len(keyBytes))
	}

	tokenBytes, err := os.ReadFile(tokenPath)
	if err != nil {
		return nil, "", fmt.Errorf("openclaw: read device token file %q: %w", tokenPath, err)
	}
	token := strings.TrimSpace(string(tokenBytes))
	if token == "" {
		return nil, "", fmt.Errorf("openclaw: device token file %q is empty", tokenPath)
	}

	return ed25519.PrivateKey(keyBytes), token, nil
}
