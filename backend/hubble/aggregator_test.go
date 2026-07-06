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

// newHTTPFlow builds a FORWARDED flow with a full 5-tuple and an HTTP L7
// record carrying a response latency, for connection/latency aggregation tests.
func newHTTPFlow(ts time.Time, srcPort uint32, latencyMs uint64) *flow.Flow {
	f := newFlow(ts, "default", "backend", "FORWARDED")
	f.IP = &flow.IP{Source: "10.0.0.1", Destination: "10.0.0.2"}
	f.L4 = &flow.Layer4{Protocol: &flow.Layer4_TCP{
		TCP: &flow.TCP{SourcePort: srcPort, DestinationPort: 8080},
	}}
	f.L7 = &flow.Layer7{
		Record:    &flow.Layer7_Http{Http: &flow.HTTP{Method: "GET", Url: "/api"}},
		LatencyNs: latencyMs * 1_000_000,
	}
	return f
}

func TestAggregator_EdgeActiveConnsAndL7Metrics(t *testing.T) {
	now := time.Now()
	a := NewOverviewAggregator(5*time.Minute, 10*time.Second, 1000)
	a.SetClockFunc(func() time.Time { return now })

	a.Add(newHTTPFlow(now, 51000, 4))
	a.Add(newHTTPFlow(now, 51000, 8)) // same connection
	a.Add(newHTTPFlow(now, 51002, 6)) // second connection

	snap := a.Snapshot("test-cluster")
	if len(snap.Edges) != 1 {
		t.Fatalf("expected 1 edge, got %d", len(snap.Edges))
	}
	e := snap.Edges[0]
	if e.ActiveConns != 2 {
		t.Fatalf("ActiveConns got %d, want 2", e.ActiveConns)
	}
	if len(e.L7Metrics) != 1 {
		t.Fatalf("L7Metrics got %+v, want one HTTP entry", e.L7Metrics)
	}
	m := e.L7Metrics[0]
	if m.Type != "HTTP" || m.Count != 3 {
		t.Fatalf("L7Metrics[0] got %+v, want Type=HTTP Count=3", m)
	}
	if m.AvgLatencyMs != 6 || m.MaxLatencyMs != 8 {
		t.Fatalf("latency got avg=%v max=%v, want avg=6 max=8", m.AvgLatencyMs, m.MaxLatencyMs)
	}
}

// newExternalFlow builds a flow from an in-cluster namespace to an external
// destination that Hubble cannot resolve (no endpoint → ext:unknown).
func newExternalFlow(ts time.Time, dstIP string) *flow.Flow {
	f := newFlow(ts, "default", "ignored", "FORWARDED")
	f.Destination = nil
	f.IP = &flow.IP{Source: "10.0.0.1", Destination: dstIP}
	return f
}

func TestAggregator_EdgeTopExternalIPs(t *testing.T) {
	now := time.Now()
	a := NewOverviewAggregator(5*time.Minute, 10*time.Second, 1000)
	a.SetClockFunc(func() time.Time { return now })

	a.Add(newExternalFlow(now, "203.0.113.9"))
	a.Add(newExternalFlow(now, "203.0.113.9"))
	a.Add(newExternalFlow(now, "198.51.100.7"))

	snap := a.Snapshot("test-cluster")
	if len(snap.Edges) != 1 {
		t.Fatalf("expected 1 edge, got %d", len(snap.Edges))
	}
	e := snap.Edges[0]
	if e.Dst != "ext:unknown" {
		t.Fatalf("Dst got %q, want ext:unknown", e.Dst)
	}
	if len(e.TopExternalIPs) != 2 {
		t.Fatalf("TopExternalIPs got %+v, want 2 entries", e.TopExternalIPs)
	}
	if e.TopExternalIPs[0].Name != "203.0.113.9" || e.TopExternalIPs[0].Count != 2 {
		t.Fatalf("TopExternalIPs[0] got %+v, want 203.0.113.9:2", e.TopExternalIPs[0])
	}
}

func TestAggregator_ExternalNodeTopIPs(t *testing.T) {
	now := time.Now()
	a := NewOverviewAggregator(5*time.Minute, 10*time.Second, 1000)
	a.SetClockFunc(func() time.Time { return now })

	a.Add(newExternalFlow(now, "203.0.113.9"))
	a.Add(newExternalFlow(now, "203.0.113.9"))
	a.Add(newExternalFlow(now, "198.51.100.7"))

	snap := a.Snapshot("test-cluster")
	var extNode *SnapshotNode
	for i := range snap.Nodes {
		if snap.Nodes[i].ID == "ext:unknown" {
			extNode = &snap.Nodes[i]
		}
	}
	if extNode == nil {
		t.Fatal("ext:unknown node not found")
	}
	if len(extNode.TopExternalIPs) != 2 {
		t.Fatalf("node TopExternalIPs got %+v, want 2 entries", extNode.TopExternalIPs)
	}
	if extNode.TopExternalIPs[0].Name != "203.0.113.9" || extNode.TopExternalIPs[0].Count != 2 {
		t.Fatalf("node TopExternalIPs[0] got %+v, want 203.0.113.9:2", extNode.TopExternalIPs[0])
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

func TestWorkloadAggregator_ReusesCanonicalEndpointAfterCacheWarmup(t *testing.T) {
	now := time.Now()
	resolver := NewEndpointResolver()
	a := NewWorkloadAggregatorWithResolver(5*time.Minute, 10*time.Second, 1000, resolver)
	a.SetClockFunc(func() time.Time { return now })

	canonical := newFlow(now, "cloudhub", "cloudhub", "FORWARDED")
	canonical.Source = &flow.Endpoint{
		Identity:  12619,
		Namespace: "cloudhub",
		Labels:    []string{"k8s:app.kubernetes.io/name=postgresql"},
	}
	canonical.Destination.Identity = 200
	sparse := newFlow(now, "cloudhub", "cloudhub", "FORWARDED")
	sparse.Source = &flow.Endpoint{Identity: 12619, Namespace: "cloudhub"}
	sparse.Destination.Identity = 200

	a.Add(canonical)
	a.Add(sparse)

	snap := a.Snapshot("test-cluster")
	if len(snap.Edges) != 1 {
		t.Fatalf("edges = %+v, want one canonical edge after cache warm-up", snap.Edges)
	}
	if snap.Edges[0].Src != "wl:cloudhub/postgresql" {
		t.Fatalf("source = %q, want wl:cloudhub/postgresql", snap.Edges[0].Src)
	}
	if snap.Edges[0].FlowCount != 2 {
		t.Fatalf("flow count = %d, want 2", snap.Edges[0].FlowCount)
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
