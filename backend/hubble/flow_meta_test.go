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

	src := b.NodeMeta["ns:default"]
	if src == nil || src.Ports["80 TCP · HTTP"] != 1 {
		t.Fatalf("expected port on src, got %+v", src)
	}
	if src.Labels["class:xwing"] != 1 || src.EgressForwarded != 1 {
		t.Fatalf("unexpected src meta: %+v", src)
	}

	dst := b.NodeMeta["ns:kube-system"]
	if dst == nil || dst.IngressForwarded != 1 {
		t.Fatalf("unexpected dst meta: %+v", dst)
	}
}