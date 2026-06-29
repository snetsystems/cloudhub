package hubble

import (
	"context"
	"sync"
	"time"

	"github.com/cilium/cilium/api/v1/flow"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// RuntimeConfig holds configuration for a single cluster's runtime.
type RuntimeConfig struct {
	ClusterName      string
	Window           time.Duration
	Bucket           time.Duration
	SnapshotInterval time.Duration
	MaxEdges         int
	ExcludedPatterns *ExcludedNamespacePatterns
	Client           ClientConfig
}

// ClusterRuntime wires a FanOut, OverviewAggregator, and WorkloadAggregator
// together for a single Kubernetes cluster. Start connects to Hubble Relay;
// startWithFlowChan bypasses the real client for tests.
type ClusterRuntime struct {
	cfg     RuntimeConfig
	logger  cloudhub.Logger
	fanout  *FanOut
	overall *OverviewAggregator
	wload   *WorkloadAggregator
	flowBuf *FlowBuffer

	mu               sync.RWMutex
	lastOverviewSnap *Snapshot
	status           SnapshotStatus
}

const (
	defaultFlowBufferMaxEdges   = 500
	defaultFlowBufferPerEdgeCap = 50
)

// NewClusterRuntime creates a ClusterRuntime. Call Start or startWithFlowChan
// to begin processing.
func NewClusterRuntime(cfg RuntimeConfig, logger cloudhub.Logger) *ClusterRuntime {
	rt := &ClusterRuntime{
		cfg:     cfg,
		logger:  logger,
		fanout:  NewFanOut(4096),
		overall: NewOverviewAggregator(cfg.Window, cfg.Bucket, cfg.MaxEdges),
		wload:   NewWorkloadAggregator(cfg.Window, cfg.Bucket, cfg.MaxEdges),
		flowBuf: NewFlowBuffer(defaultFlowBufferMaxEdges, defaultFlowBufferPerEdgeCap),
	}
	if cfg.ExcludedPatterns != nil {
		rt.overall.SetSystemFunc(cfg.ExcludedPatterns.IsSystem)
		rt.wload.SetSystemFunc(cfg.ExcludedPatterns.IsSystem)
	}
	return rt
}

// FlowBuffer exposes the raw flow ring buffer for HTTP handlers.
func (r *ClusterRuntime) FlowBuffer() *FlowBuffer { return r.flowBuf }

// Start launches the RelayClient and all aggregation goroutines.
func (r *ClusterRuntime) Start(ctx context.Context) error {
	if err := r.cfg.Client.Validate(); err != nil {
		return err
	}

	// Subscribe BEFORE Run so no flows are dispatched without a subscriber.
	sub := r.fanout.Subscribe(2048)
	go r.fanout.Run(ctx)

	client := NewRelayClient(r.cfg.Client, r.logger, r.fanout.In())
	client.OnConnected(func(t time.Time) {
		r.mu.Lock()
		r.status.RelayConnected = true
		r.status.Error = ""
		r.mu.Unlock()
		r.overall.SetStreamStartTime(t)
		r.wload.SetStreamStartTime(t)
		if r.logger != nil {
			r.logger.WithField("cluster", r.cfg.ClusterName).
				WithField("relay", r.cfg.Client.RelayURL).
				Info("hubble: relay connected")
		}
	})
	client.OnDisconnected(func(err error) {
		r.mu.Lock()
		r.status.RelayConnected = false
		if err != nil {
			r.status.Error = err.Error()
		}
		r.mu.Unlock()
		if r.logger != nil && err != nil {
			r.logger.WithField("cluster", r.cfg.ClusterName).
				WithField("relay", r.cfg.Client.RelayURL).
				Error("hubble: relay disconnected: ", err)
		}
	})

	go client.Run(ctx)
	go r.consume(ctx, sub)
	go r.rotateLoop(ctx)
	go r.publishLoop(ctx)
	return nil
}

// startWithFlowChan bypasses RelayClient and feeds flows from src (test-only).
func (r *ClusterRuntime) startWithFlowChan(ctx context.Context, src <-chan *flow.Flow) {
	sub := r.fanout.Subscribe(2048)
	go r.fanout.Run(ctx)
	go func() {
		for fl := range src {
			r.fanout.In() <- fl
		}
	}()
	go r.consume(ctx, sub)
	go r.rotateLoop(ctx)
	go r.publishLoop(ctx)
}

func (r *ClusterRuntime) consume(ctx context.Context, sub <-chan *flow.Flow) {
	defer r.fanout.Unsubscribe(sub)
	for {
		select {
		case <-ctx.Done():
			return
		case fl, ok := <-sub:
			if !ok {
				return
			}
			r.overall.Add(fl)
			r.wload.Add(fl)
			r.flowBuf.Add(fl)
		}
	}
}

func (r *ClusterRuntime) rotateLoop(ctx context.Context) {
	t := time.NewTicker(r.cfg.Bucket)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			r.overall.Rotate()
			r.wload.Rotate()
		}
	}
}

func (r *ClusterRuntime) publishLoop(ctx context.Context) {
	t := time.NewTicker(r.cfg.SnapshotInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			snap := r.overall.Snapshot(r.cfg.ClusterName)
			r.applyStatus(&snap.Status)
			r.mu.Lock()
			r.lastOverviewSnap = snap
			r.mu.Unlock()
		}
	}
}

func (r *ClusterRuntime) applyStatus(s *SnapshotStatus) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s.RelayConnected = r.status.RelayConnected
	if r.status.Error != "" {
		s.Error = r.status.Error
	}
}

// OverviewSnapshot returns the most recently published overview snapshot (nil
// if none has been published yet).
func (r *ClusterRuntime) OverviewSnapshot() *Snapshot {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.lastOverviewSnap
}

// WorkloadSnapshot computes an on-demand workload snapshot filtered to edges
// that touch the given namespace.
func (r *ClusterRuntime) WorkloadSnapshot(namespace string) *Snapshot {
	snap := r.wload.Snapshot(r.cfg.ClusterName)
	snap.Kind = "workload"
	snap.ForNamespace = namespace

	prefix := "wl:" + namespace + "/"
	keep := map[string]bool{}
	filtered := snap.Edges[:0]
	for _, e := range snap.Edges {
		if hasPrefix(e.Src, prefix) || hasPrefix(e.Dst, prefix) {
			filtered = append(filtered, e)
			keep[e.Src] = true
			keep[e.Dst] = true
		}
	}
	snap.Edges = filtered

	nodes := snap.Nodes[:0]
	for _, n := range snap.Nodes {
		if keep[n.ID] {
			nodes = append(nodes, n)
		}
	}
	snap.Nodes = nodes

	r.applyStatus(&snap.Status)
	return snap
}

func hasPrefix(s, p string) bool {
	return len(s) >= len(p) && s[:len(p)] == p
}
