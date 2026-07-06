package hubble

import (
	"testing"

	"github.com/cilium/cilium/api/v1/flow"
)

func TestFlowBuffer_GetSupportsNamespaceEdges(t *testing.T) {
	buf := NewFlowBuffer(10, 5)

	if !buf.Add(testFlow("default", "api", "kube-system", "coredns")) {
		t.Fatal("Add returned false")
	}

	got := buf.Get("ns:default", "ns:kube-system", 0)
	if len(got) != 1 {
		t.Fatalf("len(Get namespace edge) = %d, want 1", len(got))
	}
}

func TestFlowBuffer_GetSupportsWorkloadEdges(t *testing.T) {
	buf := NewFlowBuffer(10, 5)

	if !buf.Add(testFlow("default", "api", "default", "db")) {
		t.Fatal("Add returned false")
	}

	got := buf.Get("wl:default/api", "wl:default/db", 0)
	if len(got) != 1 {
		t.Fatalf("len(Get workload edge) = %d, want 1", len(got))
	}
}

func TestFlowBuffer_GetAllIncludesSameNamespaceTraffic(t *testing.T) {
	buf := NewFlowBuffer(10, 5)

	if !buf.Add(testFlow("default", "api", "default", "db")) {
		t.Fatal("Add returned false")
	}

	got := buf.GetAll(0)
	if len(got) != 1 {
		t.Fatalf("len(GetAll) = %d, want 1", len(got))
	}
}

func TestFlowBuffer_UsesCanonicalEndpointMetadataFromSharedResolver(t *testing.T) {
	resolver := NewEndpointResolver()
	buf := NewFlowBufferWithResolver(10, 5, resolver)

	canonical := testFlow("cloudhub", "postgresql", "cloudhub", "cloudhub")
	canonical.Source.Identity = 12619
	canonical.Destination.Identity = 200
	resolver.MapFlow(canonical, LevelWorkload)

	sparse := testFlow("", "", "cloudhub", "cloudhub")
	sparse.Source = &flow.Endpoint{Identity: 12619, PodName: "cloudhub-postgresql-1"}
	sparse.Destination.Identity = 200
	if !buf.Add(sparse) {
		t.Fatal("Add returned false")
	}

	got := buf.Get("wl:cloudhub/postgresql", "wl:cloudhub/cloudhub", 0)
	if len(got) != 1 {
		t.Fatalf("canonical edge records = %d, want 1", len(got))
	}
	record := got[0]
	if record.SrcID != "wl:cloudhub/postgresql" || record.SrcNamespace != "cloudhub" || record.SrcWorkload != "postgresql" {
		t.Fatalf("canonical source metadata = ID %q namespace %q workload %q", record.SrcID, record.SrcNamespace, record.SrcWorkload)
	}
}

func TestFlowBuffer_PreservesWorldIdentityInGenericExternalRecord(t *testing.T) {
	buf := NewFlowBuffer(10, 5)
	f := testFlow("default", "api", "", "")
	f.Destination = &flow.Endpoint{Identity: 2, Labels: []string{"reserved:world"}}

	if !buf.Add(f) {
		t.Fatal("Add returned false")
	}
	records := buf.Get("wl:default/api", "ext:unknown", 0)
	if len(records) != 1 {
		t.Fatalf("generic external records = %d, want 1", len(records))
	}
	if records[0].DstIdentity != 2 {
		t.Fatalf("destination identity = %d, want 2", records[0].DstIdentity)
	}
	foundWorldLabel := false
	for _, label := range records[0].DstLabels {
		if label == "reserved:world" {
			foundWorldLabel = true
			break
		}
	}
	if !foundWorldLabel {
		t.Fatalf("destination labels = %v, want reserved:world", records[0].DstLabels)
	}
}

func testFlow(srcNS, srcWL, dstNS, dstWL string) *flow.Flow {
	return &flow.Flow{
		Verdict: flow.Verdict_FORWARDED,
		Source: &flow.Endpoint{
			Namespace: srcNS,
			Workloads: []*flow.Workload{
				{Name: srcWL},
			},
		},
		Destination: &flow.Endpoint{
			Namespace: dstNS,
			Workloads: []*flow.Workload{
				{Name: dstWL},
			},
		},
	}
}
