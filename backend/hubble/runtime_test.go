package hubble

import (
	"context"
	"io"
	"testing"
	"time"

	"github.com/cilium/cilium/api/v1/flow"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// NoopLogger satisfies cloudhub.Logger with empty methods (used by tests).
type NoopLogger struct{}

func (NoopLogger) Debug(...interface{}) {}
func (NoopLogger) Info(...interface{})  {}
func (NoopLogger) Error(...interface{}) {}
func (NoopLogger) WithField(string, interface{}) cloudhub.Logger { return NoopLogger{} }
func (NoopLogger) Writer() *io.PipeWriter                        { return nil }

func TestClusterRuntime_FlowsReachSnapshot(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cfg := RuntimeConfig{
		ClusterName:      "test",
		Window:           5 * time.Second,
		Bucket:           1 * time.Second,
		SnapshotInterval: 100 * time.Millisecond,
		MaxEdges:         100,
	}
	rt := NewClusterRuntime(cfg, NoopLogger{})
	rt.startWithFlowChan(ctx, makeFakeFlowStream(10))

	time.Sleep(300 * time.Millisecond)

	snap := rt.OverviewSnapshot()
	if snap == nil || len(snap.Edges) == 0 {
		t.Fatalf("expected non-empty overview snapshot, got %+v", snap)
	}
}

func makeFakeFlowStream(n int) <-chan *flow.Flow {
	ch := make(chan *flow.Flow, n)
	for i := 0; i < n; i++ {
		ch <- &flow.Flow{
			Verdict:     flow.Verdict_FORWARDED,
			Source:      &flow.Endpoint{Namespace: "default", Workloads: []*flow.Workload{{Name: "api"}}},
			Destination: &flow.Endpoint{Namespace: "kube-system", Workloads: []*flow.Workload{{Name: "coredns"}}},
		}
	}
	close(ch)
	return ch
}
