package hubble

import (
	"testing"

	"github.com/cilium/cilium/api/v1/flow"
)

func TestMapFlow_NamespaceLevel(t *testing.T) {
	f := &flow.Flow{
		Source: &flow.Endpoint{
			Namespace: "default",
			PodName:   "api-7b5dcc-abcde",
			Workloads: []*flow.Workload{{Kind: "Deployment", Name: "api"}},
		},
		Destination: &flow.Endpoint{
			Namespace: "kube-system",
			PodName:   "coredns-1234",
			Workloads: []*flow.Workload{{Kind: "Deployment", Name: "coredns"}},
		},
		Verdict: flow.Verdict_FORWARDED,
	}

	src, dst := MapFlow(f, LevelNamespace)
	if src != "ns:default" {
		t.Errorf("src got %q, want ns:default", src)
	}
	if dst != "ns:kube-system" {
		t.Errorf("dst got %q, want ns:kube-system", dst)
	}
}

func TestMapFlow_WorkloadLevel(t *testing.T) {
	f := &flow.Flow{
		Source: &flow.Endpoint{
			Namespace: "default",
			Workloads: []*flow.Workload{{Kind: "Deployment", Name: "api"}},
		},
		Destination: &flow.Endpoint{
			Namespace: "default",
			Workloads: []*flow.Workload{{Kind: "Deployment", Name: "db"}},
		},
	}
	src, dst := MapFlow(f, LevelWorkload)
	if src != "wl:default/api" {
		t.Errorf("src got %q, want wl:default/api", src)
	}
	if dst != "wl:default/db" {
		t.Errorf("dst got %q, want wl:default/db", dst)
	}
}

func TestMapFlow_ExternalFQDN(t *testing.T) {
	f := &flow.Flow{
		Source: &flow.Endpoint{Namespace: "default", Workloads: []*flow.Workload{{Name: "api"}}},
		Destination: &flow.Endpoint{
			Identity: 2, // "world" identity
		},
		DestinationNames: []string{"api.openai.com"},
	}
	_, dst := MapFlow(f, LevelNamespace)
	if dst != "ext:fqdn:api.openai.com" {
		t.Errorf("dst got %q, want ext:fqdn:api.openai.com", dst)
	}
}

func TestMapFlow_WorldWithoutDNSIsGenericExternal(t *testing.T) {
	f := &flow.Flow{
		Source:      &flow.Endpoint{Namespace: "default", Workloads: []*flow.Workload{{Name: "api"}}},
		Destination: &flow.Endpoint{Identity: 2}, // world, no DNS name
	}
	_, dst := MapFlow(f, LevelNamespace)
	if dst != "ext:unknown" {
		t.Errorf("dst got %q, want ext:unknown", dst)
	}
}

func TestMapFlow_WorkloadFallbackToPod(t *testing.T) {
	f := &flow.Flow{
		Source: &flow.Endpoint{Namespace: "default", PodName: "loose-pod-xyz"},
		Destination: &flow.Endpoint{
			Namespace: "default",
			Workloads: []*flow.Workload{{Name: "db"}},
		},
	}
	src, _ := MapFlow(f, LevelWorkload)
	if src != "wl:default/loose-pod-xyz" {
		t.Errorf("src got %q, want wl:default/loose-pod-xyz", src)
	}
}
