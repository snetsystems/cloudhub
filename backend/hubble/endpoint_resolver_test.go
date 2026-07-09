package hubble

import (
	"testing"

	"github.com/cilium/cilium/api/v1/flow"
)

func resolverFlow(source, destination *flow.Endpoint) *flow.Flow {
	return &flow.Flow{Source: source, Destination: destination}
}

func TestEndpointResolverUsesNamespaceAndApplicationLabels(t *testing.T) {
	r := NewEndpointResolver()
	f := resolverFlow(
		&flow.Endpoint{
			Identity: 12619,
			PodName:  "cloudhub-postgresql-1",
			Labels: []string{
				"k8s:io.kubernetes.pod.namespace=cloudhub",
				"k8s:app.kubernetes.io/name=postgresql",
			},
		},
		&flow.Endpoint{Namespace: "cloudhub", Workloads: []*flow.Workload{{Name: "cloudhub"}}},
	)

	src, _ := r.MapFlow(f, LevelWorkload)
	if src != "wl:cloudhub/postgresql" {
		t.Fatalf("source = %q, want wl:cloudhub/postgresql", src)
	}
}

func TestEndpointResolverWorkloadMetadataPrecedesLabels(t *testing.T) {
	r := NewEndpointResolver()
	f := resolverFlow(
		&flow.Endpoint{
			Identity:  101,
			Namespace: "default",
			Workloads: []*flow.Workload{{Name: "api-deployment"}},
			Labels: []string{
				"k8s:app.kubernetes.io/name=wrong-app",
				"k8s:k8s-app=wrong-k8s-app",
				"k8s:app=wrong-legacy-app",
			},
		},
		&flow.Endpoint{Namespace: "default", Workloads: []*flow.Workload{{Name: "db"}}},
	)

	src, _ := r.MapFlow(f, LevelWorkload)
	if src != "wl:default/api-deployment" {
		t.Fatalf("source = %q, want workload metadata to win", src)
	}
}

func TestEndpointResolverApplicationLabelPrecedence(t *testing.T) {
	r := NewEndpointResolver()
	f := resolverFlow(
		&flow.Endpoint{
			Identity:  102,
			Namespace: "default",
			Labels: []string{
				"k8s:app=legacy-app",
				"k8s:k8s-app=k8s-app",
				"k8s:app.kubernetes.io/name=canonical-app",
			},
		},
		&flow.Endpoint{Namespace: "default", Workloads: []*flow.Workload{{Name: "db"}}},
	)

	src, _ := r.MapFlow(f, LevelWorkload)
	if src != "wl:default/canonical-app" {
		t.Fatalf("source = %q, want canonical application label", src)
	}
}

func TestEndpointResolverCachesStrongMetadataWithoutDowngrade(t *testing.T) {
	r := NewEndpointResolver()
	strong := resolverFlow(
		&flow.Endpoint{
			Identity:  103,
			Namespace: "cloudhub",
			Workloads: []*flow.Workload{{Name: "postgresql"}},
		},
		&flow.Endpoint{Namespace: "cloudhub", Workloads: []*flow.Workload{{Name: "cloudhub"}}},
	)
	weak := resolverFlow(
		&flow.Endpoint{Identity: 103, PodName: "cloudhub-postgresql-1"},
		&flow.Endpoint{Namespace: "cloudhub", Workloads: []*flow.Workload{{Name: "cloudhub"}}},
	)

	r.MapFlow(strong, LevelWorkload)
	src, _ := r.MapFlow(weak, LevelWorkload)
	if src != "wl:cloudhub/postgresql" {
		t.Fatalf("source = %q, want cached canonical workload", src)
	}
}

func TestEndpointResolverWorkloadMetadataUpgradesCachedLabel(t *testing.T) {
	r := NewEndpointResolver()
	labelOnly := resolverFlow(
		&flow.Endpoint{
			Identity:  104,
			Namespace: "default",
			Labels:    []string{"k8s:app=api-label"},
		},
		&flow.Endpoint{Namespace: "default", Workloads: []*flow.Workload{{Name: "db"}}},
	)
	workload := resolverFlow(
		&flow.Endpoint{
			Identity:  104,
			Namespace: "default",
			Workloads: []*flow.Workload{{Name: "api"}},
		},
		&flow.Endpoint{Namespace: "default", Workloads: []*flow.Workload{{Name: "db"}}},
	)

	r.MapFlow(labelOnly, LevelWorkload)
	src, _ := r.MapFlow(workload, LevelWorkload)
	if src != "wl:default/api" {
		t.Fatalf("source = %q, want workload metadata to upgrade cached label", src)
	}
}

func TestEndpointResolverDoesNotCacheIdentityZero(t *testing.T) {
	r := NewEndpointResolver()
	first := resolverFlow(
		&flow.Endpoint{Namespace: "one", Workloads: []*flow.Workload{{Name: "api"}}},
		&flow.Endpoint{Namespace: "one", Workloads: []*flow.Workload{{Name: "db"}}},
	)
	second := resolverFlow(
		&flow.Endpoint{Namespace: "two", PodName: "loose-pod"},
		&flow.Endpoint{Namespace: "two", Workloads: []*flow.Workload{{Name: "db"}}},
	)

	r.MapFlow(first, LevelWorkload)
	src, _ := r.MapFlow(second, LevelWorkload)
	if src != "wl:two/loose-pod" {
		t.Fatalf("source = %q, want identity zero endpoint's own metadata", src)
	}
}

func TestEndpointResolverUsesIdentityQualifiedUnknown(t *testing.T) {
	r := NewEndpointResolver()
	f := resolverFlow(
		&flow.Endpoint{Identity: 105, Namespace: "default"},
		&flow.Endpoint{Namespace: "default", Workloads: []*flow.Workload{{Name: "db"}}},
	)

	src, _ := r.MapFlow(f, LevelWorkload)
	if src != "wl:default/Unknown Workload (105)" {
		t.Fatalf("source = %q, want identity-qualified unknown", src)
	}
}

func TestEndpointResolverReservedIdentities(t *testing.T) {
	tests := []struct {
		name     string
		identity uint32
		dnsNames []string
		want     string
	}{
		{name: "host", identity: 1, want: "ext:reserved:host"},
		{name: "world", identity: 2, want: "ext:unknown"},
		{name: "world fqdn", identity: 2, dnsNames: []string{"api.example.com"}, want: "ext:fqdn:api.example.com"},
		{name: "remote node", identity: 6, want: "ext:reserved:remote-node"},
		{name: "kube apiserver", identity: 7, want: "ext:reserved:kube-apiserver"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := NewEndpointResolver()
			f := resolverFlow(
				&flow.Endpoint{Namespace: "default", Workloads: []*flow.Workload{{Name: "api"}}},
				&flow.Endpoint{Identity: tt.identity},
			)
			f.DestinationNames = tt.dnsNames
			_, dst := r.MapFlow(f, LevelWorkload)
			if dst != tt.want {
				t.Fatalf("destination = %q, want %q", dst, tt.want)
			}
		})
	}
}

func TestEndpointResolverMapsClusterServiceFQDNToKubernetesEndpoint(t *testing.T) {
	tests := []struct {
		name string
		lvl  Level
		fqdn string
		want string
	}{
		{
			name: "namespace level",
			lvl:  LevelNamespace,
			fqdn: "customer.beyla-trace-demo.svc.cluster.local",
			want: "ns:beyla-trace-demo",
		},
		{
			name: "workload level with trailing dot",
			lvl:  LevelWorkload,
			fqdn: "customer.beyla-trace-demo.svc.corp.internal.",
			want: "wl:beyla-trace-demo/customer",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := NewEndpointResolver()
			f := resolverFlow(
				&flow.Endpoint{Namespace: "default", Workloads: []*flow.Workload{{Name: "api"}}},
				&flow.Endpoint{Identity: reservedIdentityWorld},
			)
			f.DestinationNames = []string{tt.fqdn}

			_, dst := r.MapFlow(f, tt.lvl)
			if dst != tt.want {
				t.Fatalf("destination = %q, want %q", dst, tt.want)
			}
		})
	}
}
