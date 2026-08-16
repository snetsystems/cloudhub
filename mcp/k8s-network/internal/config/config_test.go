package config

import (
	"reflect"
	"testing"
	"time"
)

func setValidEnvironment(t *testing.T) {
	t.Helper()
	t.Setenv("CLOUDHUB_KUBERNETES_PROXY_URL", "http://cloudhub.example/cloudhub/v1/kubernetes/proxy/")
	t.Setenv("MCP_ALLOWED_NAMESPACE", "network-repair-demo")
	t.Setenv("MCP_SERVICE_TOKEN", "mcp-service-secret")
	t.Setenv("MCP_LISTEN_ADDR", "")
	t.Setenv("MCP_PLAN_TTL", "")
	t.Setenv("CLOUDHUB_PROXY_INSECURE_SKIP_VERIFY", "")
}

func TestLoadRequiresCloudHubProxyNamespaceAndServiceToken(t *testing.T) {
	tests := []struct {
		name string
		env  string
	}{
		{name: "proxy URL", env: "CLOUDHUB_KUBERNETES_PROXY_URL"},
		{name: "allowed namespace", env: "MCP_ALLOWED_NAMESPACE"},
		{name: "service token", env: "MCP_SERVICE_TOKEN"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setValidEnvironment(t)
			t.Setenv(test.env, "")

			if _, err := Load(); err == nil {
				t.Fatalf("Load() accepted an empty %s", test.name)
			}
		})
	}
}

func TestLoadAppliesDefaultsAndNormalizesProxyURL(t *testing.T) {
	setValidEnvironment(t)

	got, err := Load()
	if err != nil {
		t.Fatal(err)
	}

	if got.ProxyURL != "http://cloudhub.example/cloudhub/v1/kubernetes/proxy" {
		t.Errorf("ProxyURL = %q", got.ProxyURL)
	}
	if got.AllowedNamespace != "network-repair-demo" {
		t.Errorf("AllowedNamespace = %q", got.AllowedNamespace)
	}
	if got.ServiceToken != "mcp-service-secret" {
		t.Error("ServiceToken mismatch")
	}
	if got.ListenAddr != ":8080" {
		t.Errorf("ListenAddr = %q, want :8080", got.ListenAddr)
	}
	if got.PlanTTL != 2*time.Minute {
		t.Errorf("PlanTTL = %s, want 2m", got.PlanTTL)
	}
	if got.ProxyInsecureSkipVerify {
		t.Error("ProxyInsecureSkipVerify = true, want false by default")
	}
}

func TestLoadAcceptsCustomListenAddressAndPlanTTL(t *testing.T) {
	setValidEnvironment(t)
	t.Setenv("MCP_LISTEN_ADDR", "127.0.0.1:9090")
	t.Setenv("MCP_PLAN_TTL", "45s")

	got, err := Load()
	if err != nil {
		t.Fatal(err)
	}

	if got.ListenAddr != "127.0.0.1:9090" {
		t.Errorf("ListenAddr = %q", got.ListenAddr)
	}
	if got.PlanTTL != 45*time.Second {
		t.Errorf("PlanTTL = %s, want 45s", got.PlanTTL)
	}
}

func TestLoadAcceptsExplicitCloudHubProxyTLSBypass(t *testing.T) {
	setValidEnvironment(t)
	t.Setenv("CLOUDHUB_PROXY_INSECURE_SKIP_VERIFY", "true")

	got, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if !got.ProxyInsecureSkipVerify {
		t.Error("ProxyInsecureSkipVerify = false, want true")
	}
}

func TestLoadRejectsInvalidProxyURLAndPlanTTL(t *testing.T) {
	tests := []struct {
		name  string
		env   string
		value string
	}{
		{name: "relative proxy URL", env: "CLOUDHUB_KUBERNETES_PROXY_URL", value: "/cloudhub/v1/kubernetes/proxy"},
		{name: "unsupported proxy scheme", env: "CLOUDHUB_KUBERNETES_PROXY_URL", value: "ftp://cloudhub.example/proxy"},
		{name: "invalid plan TTL", env: "MCP_PLAN_TTL", value: "soon"},
		{name: "zero plan TTL", env: "MCP_PLAN_TTL", value: "0s"},
		{name: "invalid proxy TLS bypass", env: "CLOUDHUB_PROXY_INSECURE_SKIP_VERIFY", value: "sometimes"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setValidEnvironment(t)
			t.Setenv(test.env, test.value)

			if _, err := Load(); err == nil {
				t.Fatalf("Load() accepted %s", test.name)
			}
		})
	}
}

func TestConfigDoesNotContainKubernetesCredentials(t *testing.T) {
	typeOfConfig := reflect.TypeOf(Config{})
	for _, forbidden := range []string{"KubernetesURL", "KubernetesToken", "Token"} {
		if _, ok := typeOfConfig.FieldByName(forbidden); ok {
			t.Fatalf("Config exposes forbidden field %q", forbidden)
		}
	}
}
