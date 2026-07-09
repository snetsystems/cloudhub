package hubble

import (
	"math"
	"sort"
	"time"
)

const (
	TopDenyReasonsLimit = 5
	TopPoliciesLimit    = 5
	TopL7Limit          = 5
	TopTalkersLimit     = 10
	TopExternalIPsLimit = 5
)

// Snapshot is a point-in-time view of aggregated flow data for a cluster.
type Snapshot struct {
	Kind         string         `json:"kind"`
	ClusterName  string         `json:"clusterName"`
	ForNamespace string         `json:"forNamespace,omitempty"`
	SnapshotAt   time.Time      `json:"snapshotAt"`
	Window       SnapshotWindow `json:"window"`
	Status       SnapshotStatus `json:"status"`
	Nodes        []SnapshotNode `json:"nodes"`
	Edges        []SnapshotEdge `json:"edges"`
	TopTalkers   []TopTalker    `json:"topTalkers"`
}

// SnapshotWindow describes the time range covered by the snapshot.
type SnapshotWindow struct {
	Start  time.Time `json:"start"`
	End    time.Time `json:"end"`
	Filled float64   `json:"filled"`
}

// SnapshotStatus holds health and capacity metadata.
type SnapshotStatus struct {
	RelayConnected bool      `json:"relayConnected"`
	LastFlowAt     time.Time `json:"lastFlowAt,omitempty"`
	FlowsReceived  int64     `json:"flowsReceived"`
	EdgesTracked   int       `json:"edgesTracked"`
	EdgeCapHit     bool      `json:"edgeCapHit"`
	Error          string    `json:"error,omitempty"`
}

// SnapshotNode represents a namespace or workload endpoint in the topology.
type SnapshotNode struct {
	ID            string      `json:"id"`
	Kind          string      `json:"kind"`
	Name          string      `json:"name,omitempty"`
	FQDN          string      `json:"fqdn,omitempty"`
	Label         string      `json:"label,omitempty"`
	System        bool        `json:"system,omitempty"`
	Namespace     string      `json:"namespace,omitempty"`
	// TopInPorts are the ports this node serves on (it is the flow
	// destination); TopOutPorts are the peer ports it connects out to.
	TopInPorts    []NamedPort `json:"topInPorts,omitempty"`
	TopOutPorts   []NamedPort `json:"topOutPorts,omitempty"`
	Labels        []string    `json:"labels,omitempty"`
	IngressOpen   bool        `json:"ingressOpen,omitempty"`
	EgressOpen    bool        `json:"egressOpen,omitempty"`
	IngressDenied bool        `json:"ingressDenied,omitempty"`
	EgressDenied  bool        `json:"egressDenied,omitempty"`
	// TopExternalIPs previews the raw peer IPs aggregated into the
	// "ext:unknown" node. Only set on that node.
	TopExternalIPs []NamedCount `json:"topExternalIPs,omitempty"`
}

// NamedPort is a formatted L4/L7 port string with a flow count.
type NamedPort struct {
	Name  string `json:"name"`
	Count int64  `json:"count"`
}

// SnapshotEdge represents aggregated traffic between two nodes across all verdicts.
// VerdictCounts breaks down totals per verdict (e.g. "FORWARDED" vs "DROPPED").
// Hubble does not expose payload byte counts, so only flow-event counts are tracked.
//
// TopL7 covers every verdict combined (useful for "what's flowing here"),
// while TopL7Denied isolates the DROPPED verdict so operators can pinpoint
// which specific L7 requests are being blocked.
//
// TopAllowedPolicies / TopDeniedPolicies expose the CiliumNetworkPolicy /
// NetworkPolicy refs that permitted or blocked traffic on this edge, with
// enough metadata (kind + namespace + name) for the frontend to deep-link to
// the policy YAML.
type SnapshotEdge struct {
	Src                 string           `json:"src"`
	Dst                 string           `json:"dst"`
	FlowCount           int64            `json:"flowCount"`
	VerdictCounts       map[string]int64 `json:"verdictCounts"`
	RecentVerdictCounts map[string]int64 `json:"recentVerdictCounts"`
	LastVerdict         string           `json:"lastVerdict,omitempty"`
	TopDenyReasons      []NamedCount     `json:"topDenyReasons,omitempty"`
	TopAllowedPolicies  []PolicyRefCount `json:"topAllowedPolicies,omitempty"`
	TopDeniedPolicies   []PolicyRefCount `json:"topDeniedPolicies,omitempty"`
	// TopL7Policies are the allow policies that governed proxied (L7) traffic
	// on this edge — i.e. the L7 allowlist. L7 denials carry no DeniedBy in
	// Cilium (nothing matched), so when TopL7Denied is non-empty these are
	// the policies whose allowlist rejected those calls.
	TopL7Policies []PolicyRefCount `json:"topL7Policies,omitempty"`
	TopL7         []NamedCount     `json:"topL7,omitempty"`
	TopL7Denied         []NamedCount     `json:"topL7Denied,omitempty"`
	// ActiveConns approximates distinct connections (5-tuples) observed on
	// this edge within the window. When ActiveConnsCapped is true the value
	// is a lower bound (tracking cap was hit).
	ActiveConns       int64      `json:"activeConns,omitempty"`
	ActiveConnsCapped bool       `json:"activeConnsCapped,omitempty"`
	L7Metrics         []L7Metric `json:"l7Metrics,omitempty"`
	// TopExternalIPs identifies the raw peer IPs behind an "ext:unknown"
	// endpoint on this edge, so Unknown External is not a black box.
	TopExternalIPs []NamedCount `json:"topExternalIPs,omitempty"`
}

// L7Metric summarizes request volume and response latency for one L7 protocol
// family (HTTP/DNS/Kafka) on an edge within the window. Latency fields are 0
// when no response record carried a latency measurement.
type L7Metric struct {
	Type         string  `json:"type"`
	Count        int64   `json:"count"`
	AvgLatencyMs float64 `json:"avgLatencyMs,omitempty"`
	MaxLatencyMs float64 `json:"maxLatencyMs,omitempty"`
}

// NamedCount is a name/count pair used for ranked lists.
type NamedCount struct {
	Name   string `json:"name,omitempty"`
	Reason string `json:"reason,omitempty"`
	Count  int64  `json:"count"`
}

// TopTalker is a simplified edge ranked by flow volume.
type TopTalker struct {
	Src       string `json:"src"`
	Dst       string `json:"dst"`
	FlowCount int64  `json:"flowCount"`
}

// assembleSnapshot is called from baseAggregator.Snapshot under the aggregator lock.
func assembleSnapshot(b *baseAggregator, cluster string) *Snapshot {
	now := b.clockFn()
	merged := map[string]*mergedEdge{}
	nodes := map[string]SnapshotNode{}
	recentCutoff := now.Add(-b.bucketDur)

	systemPredicate := func(string) bool { return false }
	if b.isSystem != nil {
		systemPredicate = b.isSystem
	}

	for _, bucket := range b.buckets {
		for k, c := range bucket.Edges {
			eid := edgePairKey(k.Src, k.Dst)
			e, ok := merged[eid]
			if !ok {
				e = &mergedEdge{
					Src:                 k.Src,
					Dst:                 k.Dst,
					VerdictCounts:       map[string]int64{},
					RecentVerdictCounts: map[string]int64{},
					DenyReasons:         map[string]int64{},
					AllowedPolicies:     map[string]*policyBucket{},
					DeniedPolicies:      map[string]*policyBucket{},
					L7Policies:          map[string]*policyBucket{},
					L7:                  map[string]int64{},
					L7Denied:            map[string]int64{},
					ConnHashes:          map[uint64]struct{}{},
					L7Stats:             map[string]*l7Stat{},
					ExternalIPs:         map[string]int64{},
				}
				merged[eid] = e
			}
			e.FlowCount += c.FlowCount
			e.VerdictCounts[k.Verdict] += c.FlowCount
			if !c.LastSeen.IsZero() && !c.LastSeen.Before(recentCutoff) {
				e.RecentVerdictCounts[k.Verdict] += c.FlowCount
			}
			if c.LastSeen.After(e.LastVerdictAt) {
				e.LastVerdict = k.Verdict
				e.LastVerdictAt = c.LastSeen
			}
			for r, n := range c.DenyReasons {
				e.DenyReasons[r] += n
			}
			mergePolicyBuckets(e.AllowedPolicies, c.AllowedPolicies)
			mergePolicyBuckets(e.DeniedPolicies, c.DeniedPolicies)
			mergePolicyBuckets(e.L7Policies, c.L7Policies)
			for l, n := range c.L7 {
				e.L7[l] += n
				if k.Verdict == "DROPPED" {
					e.L7Denied[l] += n
				}
			}
			for h := range c.ConnHashes {
				if len(e.ConnHashes) >= mergedConnHashesCap {
					e.ConnCapped = true
					break
				}
				e.ConnHashes[h] = struct{}{}
			}
			if c.ConnCapped {
				e.ConnCapped = true
			}
			for typ, s := range c.L7Stats {
				t, ok := e.L7Stats[typ]
				if !ok {
					t = &l7Stat{}
					e.L7Stats[typ] = t
				}
				t.Count += s.Count
				t.LatencyCount += s.LatencyCount
				t.LatencySum += s.LatencySum
				if s.LatencyMax > t.LatencyMax {
					t.LatencyMax = s.LatencyMax
				}
			}
			for ip, n := range c.ExternalIPs {
				e.ExternalIPs[ip] += n
			}
			if _, exists := nodes[k.Src]; !exists {
				nodes[k.Src] = makeNode(k.Src, b.level, systemPredicate)
			}
			if _, exists := nodes[k.Dst]; !exists {
				nodes[k.Dst] = makeNode(k.Dst, b.level, systemPredicate)
			}
		}
	}

	edges := make([]SnapshotEdge, 0, len(merged))
	for _, m := range merged {
		edges = append(edges, SnapshotEdge{
			Src:                 m.Src,
			Dst:                 m.Dst,
			FlowCount:           m.FlowCount,
			VerdictCounts:       m.VerdictCounts,
			RecentVerdictCounts: m.RecentVerdictCounts,
			LastVerdict:         m.LastVerdict,
			TopDenyReasons:      topN(m.DenyReasons, TopDenyReasonsLimit),
			TopAllowedPolicies:  rankPolicies(m.AllowedPolicies, TopPoliciesLimit),
			TopDeniedPolicies:   rankPolicies(m.DeniedPolicies, TopPoliciesLimit),
			TopL7Policies:       rankPolicies(m.L7Policies, TopPoliciesLimit),
			TopL7:               topN(m.L7, TopL7Limit),
			TopL7Denied:         topN(m.L7Denied, TopL7Limit),
			ActiveConns:         int64(len(m.ConnHashes)),
			ActiveConnsCapped:   m.ConnCapped,
			L7Metrics:           buildL7Metrics(m.L7Stats),
			TopExternalIPs:      topN(m.ExternalIPs, TopExternalIPsLimit),
		})
	}

	talkers := make([]TopTalker, 0, len(edges))
	for _, e := range edges {
		talkers = append(talkers, TopTalker{Src: e.Src, Dst: e.Dst, FlowCount: e.FlowCount})
	}
	sort.Slice(talkers, func(i, j int) bool { return talkers[i].FlowCount > talkers[j].FlowCount })
	if len(talkers) > TopTalkersLimit {
		talkers = talkers[:TopTalkersLimit]
	}

	nodeSlice := make([]SnapshotNode, 0, len(nodes))
	nodeMeta := mergeNodeMeta(b.buckets)
	for id, n := range nodes {
		nodeSlice = append(nodeSlice, applyNodeMeta(n, nodeMeta[id]))
	}

	winStart := now.Add(-b.window)
	filled := float64(now.Sub(b.streamStart)) / float64(b.window)
	if filled > 1 {
		filled = 1
	}
	if filled < 0 {
		filled = 0
	}

	kind := "overview"
	if b.level == LevelWorkload {
		kind = "workload"
	}

	return &Snapshot{
		Kind:        kind,
		ClusterName: cluster,
		SnapshotAt:  now,
		Window:      SnapshotWindow{Start: winStart, End: now, Filled: filled},
		Status: SnapshotStatus{
			RelayConnected: true,
			LastFlowAt:     b.lastFlowAt,
			FlowsReceived:  b.flowsReceived,
			EdgesTracked:   len(merged),
			EdgeCapHit:     b.edgeCapHit,
		},
		Nodes:      nodeSlice,
		Edges:      edges,
		TopTalkers: talkers,
	}
}

type mergedEdge struct {
	Src, Dst            string
	FlowCount           int64
	VerdictCounts       map[string]int64
	RecentVerdictCounts map[string]int64
	LastVerdict         string
	LastVerdictAt       time.Time
	DenyReasons         map[string]int64
	AllowedPolicies     map[string]*policyBucket
	DeniedPolicies      map[string]*policyBucket
	L7Policies          map[string]*policyBucket
	L7                  map[string]int64
	L7Denied            map[string]int64
	ConnHashes          map[uint64]struct{}
	ConnCapped          bool
	L7Stats             map[string]*l7Stat
	ExternalIPs         map[string]int64
}

// mergedConnHashesCap bounds the window-wide distinct-connection set per edge
// when merging buckets. Hitting it marks the edge count as a lower bound.
const mergedConnHashesCap = 4096

// buildL7Metrics converts accumulated per-type L7 stats into the snapshot's
// JSON shape, ordered by request count descending.
func buildL7Metrics(stats map[string]*l7Stat) []L7Metric {
	if len(stats) == 0 {
		return nil
	}
	out := make([]L7Metric, 0, len(stats))
	for typ, s := range stats {
		m := L7Metric{Type: typ, Count: s.Count}
		if s.LatencyCount > 0 {
			m.AvgLatencyMs = roundToMs(float64(s.LatencySum) / float64(s.LatencyCount))
			m.MaxLatencyMs = roundToMs(float64(s.LatencyMax))
		}
		out = append(out, m)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Count > out[j].Count })
	return out
}

// roundToMs converts nanoseconds to milliseconds with 0.01ms precision.
func roundToMs(ns float64) float64 {
	return math.Round(ns/1e6*100) / 100
}

func mergePolicyBuckets(dst, src map[string]*policyBucket) {
	for k, v := range src {
		if existing, ok := dst[k]; ok {
			existing.Count += v.Count
			continue
		}
		dst[k] = &policyBucket{Ref: v.Ref, Count: v.Count}
	}
}

func edgePairKey(src, dst string) string { return src + "|" + dst }

func makeNode(id string, lvl Level, isSystem func(string) bool) SnapshotNode {
	switch {
	case len(id) >= 9 && id[:9] == "ext:fqdn:":
		return SnapshotNode{ID: id, Kind: "external", FQDN: id[9:]}
	case id == "ext:reserved:host":
		return SnapshotNode{ID: id, Kind: "external", Label: "Host"}
	case id == "ext:world":
		return SnapshotNode{ID: id, Kind: "external", Label: "World"}
	case id == "ext:reserved:remote-node":
		return SnapshotNode{ID: id, Kind: "external", Label: "Remote Node"}
	case id == "ext:reserved:kube-apiserver":
		return SnapshotNode{ID: id, Kind: "external", Label: "Kubernetes API Server"}
	case id == "ext:unknown":
		return SnapshotNode{ID: id, Kind: "external", Label: "Unknown External"}
	case len(id) >= 3 && id[:3] == "ns:":
		name := id[3:]
		return SnapshotNode{
			ID: id, Kind: "namespace", Name: name, Namespace: name,
			System: isSystem(name),
		}
	case len(id) >= 3 && id[:3] == "wl:":
		name := id[3:]
		ns, _ := splitWorkloadID(name)
		return SnapshotNode{
			ID: id, Kind: "workload", Name: name, Namespace: ns,
			System: isSystem(ns),
		}
	}
	return SnapshotNode{ID: id}
}

func splitWorkloadID(name string) (namespace, workload string) {
	for i := 0; i < len(name); i++ {
		if name[i] == '/' {
			return name[:i], name[i+1:]
		}
	}
	return "", name
}

func mergeNodeMeta(buckets []*Bucket) map[string]*NodeMetaCounters {
	merged := map[string]*NodeMetaCounters{}
	for _, bucket := range buckets {
		for id, meta := range bucket.NodeMeta {
			m, ok := merged[id]
			if !ok {
				m = newNodeMetaCounters()
				merged[id] = m
			}
			m.merge(meta)
		}
	}
	return merged
}

func topN(m map[string]int64, n int) []NamedCount {
	out := make([]NamedCount, 0, len(m))
	for name, count := range m {
		out = append(out, NamedCount{Name: name, Count: count})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Count > out[j].Count })
	if len(out) > n {
		out = out[:n]
	}
	return out
}
