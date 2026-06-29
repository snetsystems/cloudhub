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
