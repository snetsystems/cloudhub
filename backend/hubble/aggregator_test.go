package hubble

import (
	"testing"
	"time"

	"github.com/cilium/cilium/api/v1/flow"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func newFlow(ts time.Time, srcNs, dstNs, verdict string) *flow.Flow {
	v := flow.Verdict_FORWARDED
	switch verdict {
	case "DROPPED":
		v = flow.Verdict_DROPPED
	case "ERROR":
		v = flow.Verdict_ERROR
	}
	return &flow.Flow{
		Time:    timestamppb.New(ts),
		Verdict: v,
		Source: &flow.Endpoint{Namespace: srcNs,
			Workloads: []*flow.Workload{{Name: "src-wl"}}},
		Destination: &flow.Endpoint{Namespace: dstNs,
			Workloads: []*flow.Workload{{Name: "dst-wl"}}},
		L7: nil,
	}
}

func TestAggregator_AddFlowsAccumulate(t *testing.T) {
	now := time.Now()
	a := NewOverviewAggregator(5*time.Minute, 10*time.Second, 1000)
	a.SetClockFunc(func() time.Time { return now })

	for i := 0; i < 3; i++ {
		a.Add(newFlow(now, "default", "kube-system", "FORWARDED"))
	}
	a.Add(newFlow(now, "default", "kube-system", "DROPPED"))

	snap := a.Snapshot("test-cluster")
	// One edge per (src, dst) pair; verdict split lives in VerdictCounts.
	if len(snap.Edges) != 1 {
		t.Fatalf("expected 1 edge for default→kube-system, got %d", len(snap.Edges))
	}
	e := snap.Edges[0]
	if e.FlowCount != 4 {
		t.Fatalf("FlowCount got %d, want 4", e.FlowCount)
	}
	if e.VerdictCounts["FORWARDED"] != 3 || e.VerdictCounts["DROPPED"] != 1 {
		t.Fatalf("VerdictCounts got %v, want FORWARDED:3 DROPPED:1", e.VerdictCounts)
	}
}

func TestAggregator_EdgeLastVerdictUsesNewestFlow(t *testing.T) {
	now := time.Now()
	a := NewOverviewAggregator(5*time.Minute, 10*time.Second, 1000)
	clock := now
	a.SetClockFunc(func() time.Time { return clock })

	a.Add(newFlow(clock, "default", "backend", "DROPPED"))
	clock = clock.Add(time.Second)
	a.Add(newFlow(clock, "default", "backend", "FORWARDED"))

	snap := a.Snapshot("test-cluster")
	if len(snap.Edges) != 1 {
		t.Fatalf("expected 1 edge, got %d", len(snap.Edges))
	}
	if snap.Edges[0].LastVerdict != "FORWARDED" {
		t.Fatalf("LastVerdict got %q, want FORWARDED", snap.Edges[0].LastVerdict)
	}
	if snap.Edges[0].VerdictCounts["DROPPED"] != 1 {
		t.Fatalf("DROPPED count got %d, want 1", snap.Edges[0].VerdictCounts["DROPPED"])
	}
}

func TestAggregator_EdgeRecentVerdictCountsUseShortWindow(t *testing.T) {
	now := time.Now()
	a := NewOverviewAggregator(5*time.Minute, 10*time.Second, 1000)
	clock := now
	a.SetClockFunc(func() time.Time { return clock })

	a.Add(newFlow(clock, "default", "backend", "DROPPED"))
	clock = clock.Add(11 * time.Second)
	a.Add(newFlow(clock, "default", "backend", "FORWARDED"))

	snap := a.Snapshot("test-cluster")
	if len(snap.Edges) != 1 {
		t.Fatalf("expected 1 edge, got %d", len(snap.Edges))
	}
	if snap.Edges[0].VerdictCounts["DROPPED"] != 1 {
		t.Fatalf("window DROPPED count got %d, want 1", snap.Edges[0].VerdictCounts["DROPPED"])
	}
	if snap.Edges[0].RecentVerdictCounts["DROPPED"] != 0 {
		t.Fatalf("recent DROPPED count got %d, want 0", snap.Edges[0].RecentVerdictCounts["DROPPED"])
	}
	if snap.Edges[0].RecentVerdictCounts["FORWARDED"] != 1 {
		t.Fatalf("recent FORWARDED count got %d, want 1", snap.Edges[0].RecentVerdictCounts["FORWARDED"])
	}
}

func TestAggregator_EdgeRecentVerdictCountsKeepRecentDrop(t *testing.T) {
	now := time.Now()
	a := NewOverviewAggregator(5*time.Minute, 10*time.Second, 1000)
	clock := now
	a.SetClockFunc(func() time.Time { return clock })

	a.Add(newFlow(clock, "default", "backend", "DROPPED"))
	clock = clock.Add(time.Second)
	a.Add(newFlow(clock, "default", "backend", "FORWARDED"))

	snap := a.Snapshot("test-cluster")
	if len(snap.Edges) != 1 {
		t.Fatalf("expected 1 edge, got %d", len(snap.Edges))
	}
	if snap.Edges[0].LastVerdict != "FORWARDED" {
		t.Fatalf("LastVerdict got %q, want FORWARDED", snap.Edges[0].LastVerdict)
	}
	if snap.Edges[0].RecentVerdictCounts["DROPPED"] != 1 {
		t.Fatalf("recent DROPPED count got %d, want 1", snap.Edges[0].RecentVerdictCounts["DROPPED"])
	}
	if snap.Edges[0].RecentVerdictCounts["FORWARDED"] != 1 {
		t.Fatalf("recent FORWARDED count got %d, want 1", snap.Edges[0].RecentVerdictCounts["FORWARDED"])
	}
}

func TestAggregator_RotationDropsOldBuckets(t *testing.T) {
	now := time.Now()
	a := NewOverviewAggregator(30*time.Second, 10*time.Second, 1000)

	clock := now
	a.SetClockFunc(func() time.Time { return clock })

	a.Add(newFlow(clock, "a", "b", "FORWARDED"))

	clock = clock.Add(35 * time.Second)
	a.Rotate()

	snap := a.Snapshot("test-cluster")
	if len(snap.Edges) != 0 {
		t.Fatalf("expected 0 edges after window expiry, got %d", len(snap.Edges))
	}
}

func TestAggregator_WindowFilledFraction(t *testing.T) {
	now := time.Now()
	a := NewOverviewAggregator(60*time.Second, 10*time.Second, 1000)
	a.SetClockFunc(func() time.Time { return now })

	a.SetStreamStartTime(now.Add(-15 * time.Second))
	snap := a.Snapshot("test-cluster")

	want := 15.0 / 60.0
	if snap.Window.Filled < want-0.01 || snap.Window.Filled > want+0.01 {
		t.Fatalf("filled got %v, want ~%v", snap.Window.Filled, want)
	}
}

func TestWorkloadAggregator_LRUEvictionAtCap(t *testing.T) {
	now := time.Now()
	a := NewWorkloadAggregator(1*time.Minute, 10*time.Second, 3) // cap=3
	a.SetClockFunc(func() time.Time { return now })

	for _, ns := range []string{"a", "b", "c", "d", "e"} {
		f := newFlow(now, ns, "target", "FORWARDED")
		a.Add(f)
	}

	snap := a.Snapshot("test-cluster")
	if len(snap.Edges) > 3 {
		t.Fatalf("expected at most 3 edges, got %d", len(snap.Edges))
	}
	if !snap.Status.EdgeCapHit {
		t.Fatal("expected EdgeCapHit=true")
	}
}
