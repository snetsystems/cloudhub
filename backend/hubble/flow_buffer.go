package hubble

import (
	"container/list"
	"sync"
	"time"

	"github.com/cilium/cilium/api/v1/flow"
)

// FlowRecord is a flat, JSON-friendly extraction of one Hubble flow. We do
// not hold onto the original *flow.Flow proto because it carries a lot of
// nested fields we never read.
type FlowRecord struct {
	Time             time.Time   `json:"time"`
	Verdict          string      `json:"verdict"`
	TrafficDirection string      `json:"trafficDirection,omitempty"`
	ObservationPoint string      `json:"observationPoint,omitempty"`
	SrcID            string      `json:"srcId"`
	DstID            string      `json:"dstId"`
	SrcNamespace     string      `json:"srcNamespace,omitempty"`
	DstNamespace     string      `json:"dstNamespace,omitempty"`
	SrcWorkload      string      `json:"srcWorkload,omitempty"`
	DstWorkload      string      `json:"dstWorkload,omitempty"`
	SrcPod           string      `json:"srcPod,omitempty"`
	DstPod           string      `json:"dstPod,omitempty"`
	SrcIdentity      uint32      `json:"srcIdentity,omitempty"`
	DstIdentity      uint32      `json:"dstIdentity,omitempty"`
	SrcLabels        []string    `json:"srcLabels,omitempty"`
	DstLabels        []string    `json:"dstLabels,omitempty"`
	SrcIP            string      `json:"srcIp,omitempty"`
	DstIP            string      `json:"dstIp,omitempty"`
	Protocol         string      `json:"protocol,omitempty"`
	SrcPort          uint32      `json:"srcPort,omitempty"`
	DstPort          uint32      `json:"dstPort,omitempty"`
	TCPFlags         []string    `json:"tcpFlags,omitempty"`
	L7               string      `json:"l7,omitempty"`
	DropReason       string      `json:"dropReason,omitempty"`
	AllowedBy        []PolicyRef `json:"allowedBy,omitempty"`
	DeniedBy         []PolicyRef `json:"deniedBy,omitempty"`
}

// FlowBuffer keeps recent raw flows for the cluster-wide table and per-edge
// lookup. Edge lookup supports both namespace-level and workload-level keys.
// Memory is bounded by an LRU over edges: when the cap is exceeded, the
// least-recently-touched edge's buffer is evicted.
type FlowBuffer struct {
	mu         sync.RWMutex
	maxEdges   int
	perEdgeCap int
	all        *flowRing
	rings      map[string]*flowRing
	order      *list.List
	elements   map[string]*list.Element
	resolver   *EndpointResolver
}

// NewFlowBuffer returns a FlowBuffer that holds at most perEdgeCap records
// per edge and at most maxEdges distinct edges.
func NewFlowBuffer(maxEdges, perEdgeCap int) *FlowBuffer {
	return NewFlowBufferWithResolver(maxEdges, perEdgeCap, NewEndpointResolver())
}

func NewFlowBufferWithResolver(maxEdges, perEdgeCap int, resolver *EndpointResolver) *FlowBuffer {
	if maxEdges <= 0 {
		maxEdges = 500
	}
	if perEdgeCap <= 0 {
		perEdgeCap = 50
	}
	if resolver == nil {
		resolver = NewEndpointResolver()
	}
	return &FlowBuffer{
		maxEdges:   maxEdges,
		perEdgeCap: perEdgeCap,
		all:        newFlowRing(maxEdges * perEdgeCap),
		rings:      map[string]*flowRing{},
		order:      list.New(),
		elements:   map[string]*list.Element{},
		resolver:   resolver,
	}
}

// Add ingests one flow. Returns false if the flow could not be mapped to a
// usable source/destination pair.
func (b *FlowBuffer) Add(f *flow.Flow) bool {
	rec, keys, ok := extractFlowRecordWithResolver(f, b.resolver)
	if !ok {
		return false
	}

	b.all.push(rec)

	b.mu.Lock()
	defer b.mu.Unlock()

	for _, key := range keys {
		b.addToEdgeLocked(key, rec)
	}
	return true
}

func (b *FlowBuffer) addToEdgeLocked(key string, rec FlowRecord) {
	if el, ok := b.elements[key]; ok {
		b.order.MoveToFront(el)
		b.rings[key].push(rec)
		return
	}

	if len(b.rings) >= b.maxEdges {
		oldest := b.order.Back()
		if oldest != nil {
			oldKey := oldest.Value.(string)
			b.order.Remove(oldest)
			delete(b.elements, oldKey)
			delete(b.rings, oldKey)
		}
	}

	ring := newFlowRing(b.perEdgeCap)
	ring.push(rec)
	b.rings[key] = ring
	b.elements[key] = b.order.PushFront(key)
}

// Get returns up to `limit` most-recent flows for the (src, dst) edge,
// newest first. limit <= 0 returns the full buffered window.
func (b *FlowBuffer) Get(src, dst string, limit int) []FlowRecord {
	key := src + "|" + dst
	b.mu.RLock()
	ring := b.rings[key]
	b.mu.RUnlock()
	if ring == nil {
		return nil
	}
	snap := ring.snapshotNewestFirst()
	if limit > 0 && len(snap) > limit {
		snap = snap[:limit]
	}
	return snap
}

// GetAll merges every per-edge ring buffer into a single list sorted newest
// first and trims to `limit`. Used by the cluster-wide "Flows" table at the
// bottom of the Hubble page.
func (b *FlowBuffer) GetAll(limit int) []FlowRecord {
	all := b.all.snapshotNewestFirst()
	if limit > 0 && len(all) > limit {
		all = all[:limit]
	}
	return all
}

// flowRing is a fixed-capacity circular buffer of FlowRecord. Push is O(1)
// and never allocates after construction.
type flowRing struct {
	mu      sync.Mutex
	records []FlowRecord
	head    int
	size    int
}

func newFlowRing(cap int) *flowRing {
	return &flowRing{records: make([]FlowRecord, cap)}
}

func (r *flowRing) push(rec FlowRecord) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.records[r.head] = rec
	r.head = (r.head + 1) % len(r.records)
	if r.size < len(r.records) {
		r.size++
	}
}

func (r *flowRing) snapshotNewestFirst() []FlowRecord {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]FlowRecord, r.size)
	// records[(head-1+cap)%cap] is the newest; walk backwards.
	cap := len(r.records)
	idx := (r.head - 1 + cap) % cap
	for i := 0; i < r.size; i++ {
		out[i] = r.records[idx]
		idx = (idx - 1 + cap) % cap
	}
	return out
}

func extractFlowRecord(f *flow.Flow) (FlowRecord, []string, bool) {
	return extractFlowRecordWithResolver(f, NewEndpointResolver())
}

func extractFlowRecordWithResolver(f *flow.Flow, resolver *EndpointResolver) (FlowRecord, []string, bool) {
	if resolver == nil {
		resolver = NewEndpointResolver()
	}
	src := resolver.ResolveEndpoint(f.GetSource(), f.GetSourceNames())
	dst := resolver.ResolveEndpoint(f.GetDestination(), f.GetDestinationNames())
	nsSrc, nsDst := src.ID(LevelNamespace), dst.ID(LevelNamespace)
	wlSrc, wlDst := src.ID(LevelWorkload), dst.ID(LevelWorkload)
	if wlSrc == "" || wlDst == "" {
		return FlowRecord{}, nil, false
	}

	rec := FlowRecord{
		Time:             f.GetTime().AsTime(),
		Verdict:          f.GetVerdict().String(),
		TrafficDirection: f.GetTrafficDirection().String(),
		ObservationPoint: f.GetTraceObservationPoint().String(),
		SrcID:            wlSrc,
		DstID:            wlDst,
		L7:               l7Signature(f.GetL7()),
		SrcNamespace:     src.namespace,
		DstNamespace:     dst.namespace,
		SrcWorkload:      src.workload,
		DstWorkload:      dst.workload,
	}

	if ep := f.GetSource(); ep != nil {
		rec.SrcPod = ep.GetPodName()
		rec.SrcIdentity = ep.GetIdentity()
		if labels := ep.GetLabels(); len(labels) > 0 {
			rec.SrcLabels = append([]string(nil), labels...)
		}
	}
	if ep := f.GetDestination(); ep != nil {
		rec.DstPod = ep.GetPodName()
		rec.DstIdentity = ep.GetIdentity()
		if labels := ep.GetLabels(); len(labels) > 0 {
			rec.DstLabels = append([]string(nil), labels...)
		}
	}

	if ip := f.GetIP(); ip != nil {
		rec.SrcIP = ip.GetSource()
		rec.DstIP = ip.GetDestination()
	}

	if l4 := f.GetL4(); l4 != nil {
		switch {
		case l4.GetTCP() != nil:
			t := l4.GetTCP()
			rec.Protocol = "TCP"
			rec.SrcPort = t.GetSourcePort()
			rec.DstPort = t.GetDestinationPort()
			rec.TCPFlags = tcpFlagsList(t.GetFlags())
		case l4.GetUDP() != nil:
			u := l4.GetUDP()
			rec.Protocol = "UDP"
			rec.SrcPort = u.GetSourcePort()
			rec.DstPort = u.GetDestinationPort()
		case l4.GetSCTP() != nil:
			s := l4.GetSCTP()
			rec.Protocol = "SCTP"
			rec.SrcPort = s.GetSourcePort()
			rec.DstPort = s.GetDestinationPort()
		case l4.GetICMPv4() != nil:
			rec.Protocol = "ICMPv4"
		case l4.GetICMPv6() != nil:
			rec.Protocol = "ICMPv6"
		}
	}

	if f.GetVerdict() == flow.Verdict_DROPPED {
		if reason := f.GetDropReasonDesc(); reason != flow.DropReason_DROP_REASON_UNKNOWN {
			rec.DropReason = reason.String()
		}
	}

	rec.AllowedBy = append(
		policyRefsFromFlow(f.GetEgressAllowedBy()),
		policyRefsFromFlow(f.GetIngressAllowedBy())...,
	)
	rec.DeniedBy = append(
		policyRefsFromFlow(f.GetEgressDeniedBy()),
		policyRefsFromFlow(f.GetIngressDeniedBy())...,
	)
	if len(rec.AllowedBy) == 0 {
		rec.AllowedBy = nil
	}
	if len(rec.DeniedBy) == 0 {
		rec.DeniedBy = nil
	}

	return rec, flowRecordKeys(nsSrc, nsDst, wlSrc, wlDst), true
}

func flowRecordKeys(nsSrc, nsDst, wlSrc, wlDst string) []string {
	keys := make([]string, 0, 2)
	seen := map[string]bool{}
	add := func(src, dst string) {
		if src == "" || dst == "" || src == dst {
			return
		}
		key := src + "|" + dst
		if seen[key] {
			return
		}
		seen[key] = true
		keys = append(keys, key)
	}
	add(nsSrc, nsDst)
	add(wlSrc, wlDst)
	return keys
}

// tcpFlagsList extracts the set TCP control flags as a stable-order slice
// (SYN, ACK, FIN, …). Hubble UI shows these inline ("ACK PSH"); we keep them
// as a list so the frontend can render them as chips.
func tcpFlagsList(tf *flow.TCPFlags) []string {
	if tf == nil {
		return nil
	}
	out := make([]string, 0, 4)
	if tf.GetSYN() {
		out = append(out, "SYN")
	}
	if tf.GetACK() {
		out = append(out, "ACK")
	}
	if tf.GetPSH() {
		out = append(out, "PSH")
	}
	if tf.GetFIN() {
		out = append(out, "FIN")
	}
	if tf.GetRST() {
		out = append(out, "RST")
	}
	if tf.GetURG() {
		out = append(out, "URG")
	}
	if tf.GetECE() {
		out = append(out, "ECE")
	}
	if tf.GetCWR() {
		out = append(out, "CWR")
	}
	if tf.GetNS() {
		out = append(out, "NS")
	}
	if len(out) == 0 {
		return nil
	}
	return out
}
