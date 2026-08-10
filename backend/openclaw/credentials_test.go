package openclaw

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadDeviceCredentials(t *testing.T) {
	dir := t.TempDir()
	_, wantPrivateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	keyPath := filepath.Join(dir, "device.key")
	tokenPath := filepath.Join(dir, "device.token")
	writeFile(t, keyPath, base64.RawStdEncoding.EncodeToString(wantPrivateKey))
	writeFile(t, tokenPath, "device-token")

	key, token, err := LoadDeviceCredentials(keyPath, tokenPath)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(key, wantPrivateKey) {
		t.Fatal("private key mismatch")
	}
	if token != "device-token" {
		t.Fatalf("token = %q", token)
	}
}

func TestLoadDeviceCredentialsMissingKeyFile(t *testing.T) {
	dir := t.TempDir()
	tokenPath := filepath.Join(dir, "device.token")
	writeFile(t, tokenPath, "device-token")

	_, _, err := LoadDeviceCredentials(filepath.Join(dir, "missing.key"), tokenPath)
	assertSanitizedError(t, err, "device.token", "device-token")
}

func TestLoadDeviceCredentialsMissingTokenFile(t *testing.T) {
	dir := t.TempDir()
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	keyPath := filepath.Join(dir, "device.key")
	writeFile(t, keyPath, base64.RawStdEncoding.EncodeToString(privateKey))

	_, _, err = LoadDeviceCredentials(keyPath, filepath.Join(dir, "missing.token"))
	assertSanitizedError(t, err, base64.RawStdEncoding.EncodeToString(privateKey))
}

func TestLoadDeviceCredentialsMalformedBase64(t *testing.T) {
	dir := t.TempDir()
	keyPath := filepath.Join(dir, "device.key")
	tokenPath := filepath.Join(dir, "device.token")
	writeFile(t, keyPath, "not-valid-base64!!")
	writeFile(t, tokenPath, "device-token")

	_, _, err := LoadDeviceCredentials(keyPath, tokenPath)
	assertSanitizedError(t, err, "not-valid-base64", "device-token")
}

func TestLoadDeviceCredentialsWrongKeyLength(t *testing.T) {
	dir := t.TempDir()
	keyPath := filepath.Join(dir, "device.key")
	tokenPath := filepath.Join(dir, "device.token")
	shortKey := make([]byte, 16)
	writeFile(t, keyPath, base64.RawStdEncoding.EncodeToString(shortKey))
	writeFile(t, tokenPath, "device-token")

	_, _, err := LoadDeviceCredentials(keyPath, tokenPath)
	assertSanitizedError(t, err, base64.RawStdEncoding.EncodeToString(shortKey), "device-token")
}

func TestLoadDeviceCredentialsWhitespaceOnlyToken(t *testing.T) {
	dir := t.TempDir()
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	keyPath := filepath.Join(dir, "device.key")
	tokenPath := filepath.Join(dir, "device.token")
	writeFile(t, keyPath, base64.RawStdEncoding.EncodeToString(privateKey))
	writeFile(t, tokenPath, "   \n\t  ")

	_, _, err = LoadDeviceCredentials(keyPath, tokenPath)
	assertSanitizedError(t, err, base64.RawStdEncoding.EncodeToString(privateKey))
}

func writeFile(t *testing.T, path, contents string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

// assertSanitizedError fails the test unless err is non-nil and its message
// does not contain any of the given secret/content substrings.
func assertSanitizedError(t *testing.T, err error, forbidden ...string) {
	t.Helper()
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	msg := err.Error()
	for _, s := range forbidden {
		if s == "" {
			continue
		}
		if strings.Contains(msg, s) {
			t.Fatalf("error message %q leaks sensitive content %q", msg, s)
		}
	}
}
