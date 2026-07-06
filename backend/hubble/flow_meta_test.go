package hubble

import (
	"testing"
	"time"

	"github.com/cilium/cilium/api/v1/flow"
)

func TestFormatFlowPort_TCPWithHTTP(t *testing.T) {
	f := &flow.Flow{
		L4: &flow.Layer4{
			Protocol: &flow.Layer4_TCP{
				TCP: &flow.TCP{DestinationPort: 80},
			},
		},
		L7: &flow.Layer7{
			Record: &flow.Layer7_Http{
				Http: &flow.HTTP{},
			},
		},
	}
	got := formatFlowPort(f)
	if got != "80 TCP · HTTP" {
		t.Fatalf("got %q, want %q", got, "80 TCP · HTTP")
	}
}

func TestRecordFlowMeta_AggregatesPortsAndLabels(t *testing.T) {
	b := NewBucket(time.Now())
	f := &flow.Flow{
		Source: &flow.Endpoint{
			Namespace: "default",
			Labels:    []string{"class:xwing", "org:alliance"},
			Workloads: []*flow.Workload{{Name: "src"}},
		},
		Destination: &flow.Endpoint{
			Namespace: "default",
			Labels:    []string{"class:deathstar", "org:empire"},
			Workloads: []*flow.Workload{{Name: "deathstar"}},
		},
		L4: &flow.Layer4{
			Protocol: &flow.Layer4_TCP{
				TCP: &flow.TCP{DestinationPort: 80},
			},
		},
		L7: &flow.Layer7{
			Record: &flow.Layer7_Http{
				Http: &flow.HTTP{},
			},
		},
	}
	recordFlowMeta(b, f, "ns:default", "ns:kube-system", "FORWARDED")

	// The destination port belongs to the receiving side: the source node
	// talks *to* it (egress), the destination node listens *on* it (ingress).
	src := b.NodeMeta["ns:default"]
	if src == nil || src.EgressPorts["80 TCP · HTTP"] != 1 {
		t.Fatalf("expected egress port on src, got %+v", src)
	}
	if len(src.IngressPorts) != 0 {
		t.Fatalf("src must not gain an ingress port, got %+v", src.IngressPorts)
	}
	if src.Labels["class:xwing"] != 1 || src.EgressForwarded != 1 {
		t.Fatalf("unexpected src meta: %+v", src)
	}

	dst := b.NodeMeta["ns:kube-system"]
	if dst == nil || dst.IngressPorts["80 TCP · HTTP"] != 1 {
		t.Fatalf("expected ingress port on dst, got %+v", dst)
	}
	if len(dst.EgressPorts) != 0 {
		t.Fatalf("dst must not gain an egress port, got %+v", dst.EgressPorts)
	}
	if dst.IngressForwarded != 1 {
		t.Fatalf("unexpected dst meta: %+v", dst)
	}
}

func TestApplyNodeMeta_SplitsPortsByDirection(t *testing.T) {
	meta := newNodeMetaCounters()
	meta.IngressPorts["8086 TCP"] = 10
	meta.EgressPorts["5432 TCP"] = 4
	meta.IngressForwarded = 10
	meta.EgressForwarded = 4

	n := applyNodeMeta(SnapshotNode{ID: "ns:cloudhub"}, meta)

	if len(n.TopInPorts) != 1 || n.TopInPorts[0].Name != "8086 TCP" ||
		n.TopInPorts[0].Count != 10 {
		t.Fatalf("unexpected TopInPorts: %+v", n.TopInPorts)
	}
	if len(n.TopOutPorts) != 1 || n.TopOutPorts[0].Name != "5432 TCP" ||
		n.TopOutPorts[0].Count != 4 {
		t.Fatalf("unexpected TopOutPorts: %+v", n.TopOutPorts)
	}
}