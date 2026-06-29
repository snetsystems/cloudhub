package hubble

import (
	"container/list"
	"sync"
	"time"

	"github.com/cilium/cilium/api/v1/flow"
)

// SystemNamespaceFunc returns true when the given namespace is a system namespace.
type SystemNamespaceFunc func(string) bool

type baseAggregator struct {
	window        time.Duration
	bucketDur     time.Duration
	maxEdges      int
	level         Level
	clockFn       func() time.Time
	mu            sync.Mutex
	buckets       []*Bucket // newest last
	streamStart   time.Time
	lastFlowAt    time.Time
	flowsReceived int64
	edgeOrder     *list.List // LRU: front = newest, back = oldest
	edgeElement   map[EdgeKey]*list.Element
	edgeCapHit    bool
	isSystem      SystemNamespaceFunc
}

func newBase(window, bucketDur time.Duration, maxEdges int, lvl Level) *baseAggregator {
	if bucketDur <= 0 {
		bucketDur = 10 * time.Second
	}
	bucketCount := int(window / bucketDur)
	if bucketCount < 1 {
		bucketCount = 1
	}
	return &baseAggregator{
		window:      window,
		bucketDur:   bucketDur,
		maxEdges:    maxEdges,
		level:       lvl,
		clockFn:     time.Now,
		buckets:     make([]*Bucket, 0, bucketCount),
		edgeOrder:   list.New(),
		edgeElement: map[EdgeKey]*list.Element{},
		streamStart: time.Now(),
	}
}

func (b *baseAggregator) SetClockFunc(fn func() time.Time)     { b.clockFn = fn }
func (b *baseAggregator) SetStreamStartTime(t time.Time)       { b.streamStart = t }
func (b *baseAggregator) SetSystemFunc(fn SystemNamespaceFunc) { b.isSystem = fn }
func (b *baseAggregator) FlowsReceived() int64                 { return b.flowsReceived }

// Add ingests a single flow.
func (b *baseAggregator) Add(f *flow.Flow) {
	b.mu.Lock()
	defer b.mu.Unlock()

	now := b.clockFn()
	b.ensureCurrentBucket(now)
	bucket := b.buckets[len(b.buckets)-1]

	src, dst := MapFlow(f, b.level)
	if src == "" || dst == "" {
		return
	}
	verdict := f.GetVerdict().String()
	key := EdgeKey{Src: src, Dst: dst, Verdict: verdict}

	// LRU + cap
	if b.maxEdges > 0 {
		if el, ok := b.edgeElement[key]; ok {
			b.edgeOrder.MoveToFront(el)
		} else {
			if b.edgeOrder.Len() >= b.maxEdges {
				b.evictOldest()
			}
			el := b.edgeOrder.PushFront(key)
			b.edgeElement[key] = el
		}
	}

	denyReason := ""
	if f.GetDropReasonDesc() != flow.DropReason_DROP_REASON_UNKNOWN {
		denyReason = f.GetDropReasonDesc().String()
	}

	allowed := append(
		policyRefsFromFlow(f.GetEgressAllowedBy()),
		policyRefsFromFlow(f.GetIngressAllowedBy())...,
	)
	denied := append(
		policyRefsFromFlow(f.GetEgressDeniedBy()),
		policyRefsFromFlow(f.GetIngressDeniedBy())...,
	)

	// Hubble flow proto is event-based and does not carry payload byte
	// counts. We only track flow counts here; byte-level aggregation is
	// out of scope for this data source (use conntrack/Prometheus instead).
	l7Sig := l7Signature(f.GetL7())
	bucket.Add(key, now, denyReason, allowed, denied, l7Sig)
	recordFlowMeta(bucket, f, src, dst, verdict)
	b.flowsReceived++
	b.lastFlowAt = now
}

func (b *baseAggregator) evictOldest() {
	el := b.edgeOrder.Back()
	if el == nil {
		return
	}
	k := el.Value.(EdgeKey)
	b.edgeOrder.Remove(el)
	delete(b.edgeElement, k)
	for _, bk := range b.buckets {
		delete(bk.Edges, k)
	}
	b.edgeCapHit = true
}

func (b *baseAggregator) ensureCurrentBucket(now time.Time) {
	if len(b.buckets) == 0 {
		b.buckets = append(b.buckets, NewBucket(now.Truncate(b.bucketDur)))
		return
	}
	last := b.buckets[len(b.buckets)-1]
	if now.Sub(last.StartedAt) >= b.bucketDur {
		b.rotateLocked(now)
	}
}

// Rotate is exposed for tests; production code calls it from a ticker.
func (b *baseAggregator) Rotate() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.rotateLocked(b.clockFn())
}

func (b *baseAggregator) rotateLocked(now time.Time) {
	b.buckets = append(b.buckets, NewBucket(now.Truncate(b.bucketDur)))
	cutoff := now.Add(-b.window)
	idx := 0
	for ; idx < len(b.buckets); idx++ {
		if !b.buckets[idx].StartedAt.Before(cutoff) {
			break
		}
	}
	if idx > 0 {
		b.buckets = b.buckets[idx:]
	}
}

// Snapshot assembles and returns a point-in-time snapshot under the aggregator lock.
func (b *baseAggregator) Snapshot(cluster string) *Snapshot {
	b.mu.Lock()
	defer b.mu.Unlock()
	return assembleSnapshot(b, cluster)
}

// OverviewAggregator buckets at namespace level.
type OverviewAggregator struct{ *baseAggregator }

func NewOverviewAggregator(window, bucketDur time.Duration, maxEdges int) *OverviewAggregator {
	return &OverviewAggregator{newBase(window, bucketDur, maxEdges, LevelNamespace)}
}

// WorkloadAggregator buckets at workload level.
type WorkloadAggregator struct{ *baseAggregator }

func NewWorkloadAggregator(window, bucketDur time.Duration, maxEdges int) *WorkloadAggregator {
	return &WorkloadAggregator{newBase(window, bucketDur, maxEdges, LevelWorkload)}
}
