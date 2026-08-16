package main

import (
	"io"
	"log"
	"net/http/httptest"
	"testing"
)

func TestProxyHTTPClientAllowsSelfSignedTLSOnlyWhenExplicit(t *testing.T) {
	server := httptest.NewUnstartedServer(nil)
	server.Config.ErrorLog = log.New(io.Discard, "", 0)
	server.StartTLS()
	defer server.Close()

	if _, err := newProxyHTTPClient(false).Get(server.URL); err == nil {
		t.Fatal("default proxy client trusted a self-signed certificate")
	}
	response, err := newProxyHTTPClient(true).Get(server.URL)
	if err != nil {
		t.Fatalf("explicit local TLS bypass failed: %v", err)
	}
	response.Body.Close()
}

func TestHealthcheckURLUsesLoopbackAndConfiguredPort(t *testing.T) {
	tests := []struct {
		listenAddr string
		want       string
	}{
		{listenAddr: ":8080", want: "http://127.0.0.1:8080/healthz"},
		{listenAddr: "0.0.0.0:9090", want: "http://127.0.0.1:9090/healthz"},
		{listenAddr: "127.0.0.1:7070", want: "http://127.0.0.1:7070/healthz"},
	}

	for _, test := range tests {
		got, err := healthcheckURL(test.listenAddr)
		if err != nil {
			t.Errorf("healthcheckURL(%q): %v", test.listenAddr, err)
			continue
		}
		if got != test.want {
			t.Errorf("healthcheckURL(%q) = %q, want %q", test.listenAddr, got, test.want)
		}
	}
}

func TestHealthcheckURLRejectsAddressWithoutPort(t *testing.T) {
	if _, err := healthcheckURL("localhost"); err == nil {
		t.Fatal("healthcheckURL accepted an address without a port")
	}
}
