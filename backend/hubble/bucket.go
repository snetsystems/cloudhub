package hubble

import "time"

// EdgeKey uniquely identifies an aggregation slot.
type EdgeKey struct {
	Src     string // node ID, e.g. "ns:default" or "wl:default/api"
	Dst     string
	Verdict string // FORWARDED | DROPPED | ERROR | AUDIT
}

// policyBucket tracks one PolicyRef and how many flows referenced it within
// a bucket. Stored by composite key (kind|namespace|name) so multiple flows
// from the same policy aggregate cleanly.
type policyBucket struct {
	Ref   PolicyRef
	Count int64
}

// connHashesPerBucketCap bounds per-edge connection tracking memory. When the
// cap is reached the distinct-connection count becomes a lower bound and
// ConnCapped is set so the snapshot can surface the approximation.
const connHashesPerBucketCap = 512

// externalIPsPerBucketCap bounds per-edge external-IP tracking. Past the cap
// new IPs are dropped (existing ones still count) — top-N stays meaningful
// even against high-cardinality sources like internet scanners.
const externalIPsPerBucketCap = 64

// FlowExtras carries optional per-flow measurements extracted once in the
// aggregator and recorded alongside the basic counters.
type FlowExtras struct {
	ConnHash   uint64 // hash of the flow 5-tuple; 0 = unknown connection
	L7Type     string // "HTTP" | "DNS" | "Kafka"; "" = no L7 layer
	LatencyNs  int64  // L7 response latency; 0 = not reported
	ExternalIP string // IP of an unresolved external peer; "" = none
}

// l7Stat accumulates request count and response latency for one L7 protocol
// family. LatencyCount can be lower than Count because only response records
// carry latency.
type l7Stat struct {
	Count        int64
	LatencySum   int64
	LatencyMax   int64
	LatencyCount int64
}

// EdgeCounters holds counters for a single edge within a single bucket.
// Policies are split into Allowed vs Denied based on whether they came from
// EgressAllowedBy/IngressAllowedBy or EgressDeniedBy/IngressDeniedBy.
type EdgeCounters struct {
	FlowCount       int64
	LastSeen        time.Time
	DenyReasons     map[string]int64
	L7              map[string]int64
	AllowedPolicies map[string]*policyBucket
	DeniedPolicies  map[string]*policyBucket
	ConnHashes      map[uint64]struct{}
	ConnCapped      bool
	L7Stats         map[string]*l7Stat
	ExternalIPs     map[string]int64
}

// Bucket holds aggregated counters for flows received within a time slice.
type Bucket struct {
	StartedAt time.Time
	Edges     map[EdgeKey]*EdgeCounters
	NodeMeta  map[string]*NodeMetaCounters
}

func NewBucket(t time.Time) *Bucket {
	return &Bucket{
		StartedAt: t,
		Edges:     make(map[EdgeKey]*EdgeCounters),
		NodeMeta:  make(map[string]*NodeMetaCounters),
	}
}

// Add increments counters for an edge. Empty/nil arguments skip the
// corresponding map entry (e.g. flows with no L7 don't touch the L7 map).
func (b *Bucket) Add(k EdgeKey, seenAt time.Time, denyReason string, allowed, denied []PolicyRef, l7Sig string, extras FlowExtras) {
	c, ok := b.Edges[k]
	if !ok {
		c = &EdgeCounters{
			DenyReasons:     make(map[string]int64),
			L7:              make(map[string]int64),
			AllowedPolicies: make(map[string]*policyBucket),
			DeniedPolicies:  make(map[string]*policyBucket),
			ConnHashes:      make(map[uint64]struct{}),
			L7Stats:         make(map[string]*l7Stat),
			ExternalIPs:     make(map[string]int64),
		}
		b.Edges[k] = c
	}
	c.FlowCount++
	if c.LastSeen.IsZero() || seenAt.After(c.LastSeen) {
		c.LastSeen = seenAt
	}
	if denyReason != "" {
		c.DenyReasons[denyReason]++
	}
	if l7Sig != "" {
		c.L7[l7Sig]++
	}
	for _, p := range allowed {
		addPolicyBucket(c.AllowedPolicies, p)
	}
	for _, p := range denied {
		addPolicyBucket(c.DeniedPolicies, p)
	}
	if extras.ConnHash != 0 {
		if _, seen := c.ConnHashes[extras.ConnHash]; !seen {
			if len(c.ConnHashes) < connHashesPerBucketCap {
				c.ConnHashes[extras.ConnHash] = struct{}{}
			} else {
				c.ConnCapped = true
			}
		}
	}
	if extras.L7Type != "" {
		s, ok := c.L7Stats[extras.L7Type]
		if !ok {
			s = &l7Stat{}
			c.L7Stats[extras.L7Type] = s
		}
		s.Count++
		if extras.LatencyNs > 0 {
			s.LatencyCount++
			s.LatencySum += extras.LatencyNs
			if extras.LatencyNs > s.LatencyMax {
				s.LatencyMax = extras.LatencyNs
			}
		}
	}
	if extras.ExternalIP != "" {
		if _, seen := c.ExternalIPs[extras.ExternalIP]; seen ||
			len(c.ExternalIPs) < externalIPsPerBucketCap {
			c.ExternalIPs[extras.ExternalIP]++
		}
	}
}

func addPolicyBucket(m map[string]*policyBucket, p PolicyRef) {
	if p.Name == "" {
		return
	}
	key := policyKey(p)
	if pb, ok := m[key]; ok {
		pb.Count++
		return
	}
	m[key] = &policyBucket{Ref: p, Count: 1}
}
