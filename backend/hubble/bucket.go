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
func (b *Bucket) Add(k EdgeKey, seenAt time.Time, denyReason string, allowed, denied []PolicyRef, l7Sig string) {
	c, ok := b.Edges[k]
	if !ok {
		c = &EdgeCounters{
			DenyReasons:     make(map[string]int64),
			L7:              make(map[string]int64),
			AllowedPolicies: make(map[string]*policyBucket),
			DeniedPolicies:  make(map[string]*policyBucket),
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
