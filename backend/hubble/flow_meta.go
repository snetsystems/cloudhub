package hubble

import (
	"fmt"

	"github.com/cilium/cilium/api/v1/flow"
)

const (
	TopNodePortsLimit  = 3
	TopNodeLabelsLimit = 6
)

// NodeMetaCounters holds per-node metadata aggregated from flows.
type NodeMetaCounters struct {
	Ports            map[string]int64
	Labels           map[string]int64
	IngressForwarded int64
	IngressDropped   int64
	EgressForwarded  int64
	EgressDropped    int64
}

func newNodeMetaCounters() *NodeMetaCounters {
	return &NodeMetaCounters{
		Ports:  map[string]int64{},
		Labels: map[string]int64{},
	}
}

func (n *NodeMetaCounters) merge(o *NodeMetaCounters) {
	if o == nil {
		return
	}
	for k, v := range o.Ports {
		n.Ports[k] += v
	}
	for k, v := range o.Labels {
		n.Labels[k] += v
	}
	n.IngressForwarded += o.IngressForwarded
	n.IngressDropped += o.IngressDropped
	n.EgressForwarded += o.EgressForwarded
	n.EgressDropped += o.EgressDropped
}

func recordFlowMeta(b *Bucket, f *flow.Flow, src, dst, verdict string) {
	portKey := formatFlowPort(f)
	dropped := verdict == "DROPPED"

	recordNodeMeta(b, src, func(m *NodeMetaCounters) {
		if portKey != "" {
			m.Ports[portKey]++
		}
		for _, label := range endpointLabels(f.GetSource()) {
			m.Labels[label]++
		}
		if dropped {
			m.EgressDropped++
		} else {
			m.EgressForwarded++
		}
	})

	recordNodeMeta(b, dst, func(m *NodeMetaCounters) {
		if portKey != "" {
			m.Ports[portKey]++
		}
		for _, label := range endpointLabels(f.GetDestination()) {
			m.Labels[label]++
		}
		if dropped {
			m.IngressDropped++
		} else {
			m.IngressForwarded++
		}
	})
}

func recordNodeMeta(b *Bucket, nodeID string, fn func(*NodeMetaCounters)) {
	if nodeID == "" || fn == nil {
		return
	}
	if b.NodeMeta == nil {
		b.NodeMeta = map[string]*NodeMetaCounters{}
	}
	m, ok := b.NodeMeta[nodeID]
	if !ok {
		m = newNodeMetaCounters()
		b.NodeMeta[nodeID] = m
	}
	fn(m)
}

func endpointLabels(ep *flow.Endpoint) []string {
	if ep == nil {
		return nil
	}
	return ep.GetLabels()
}

func formatFlowPort(f *flow.Flow) string {
	l4 := f.GetL4()
	if l4 == nil {
		return ""
	}

	var proto string
	var port uint32

	switch {
	case l4.GetTCP() != nil:
		tcp := l4.GetTCP()
		proto = "TCP"
		port = tcp.GetDestinationPort()
		if port == 0 {
			port = tcp.GetSourcePort()
		}
	case l4.GetUDP() != nil:
		udp := l4.GetUDP()
		proto = "UDP"
		port = udp.GetDestinationPort()
		if port == 0 {
			port = udp.GetSourcePort()
		}
	case l4.GetSCTP() != nil:
		sctp := l4.GetSCTP()
		proto = "SCTP"
		port = sctp.GetDestinationPort()
		if port == 0 {
			port = sctp.GetSourcePort()
		}
	default:
		return ""
	}

	if port == 0 {
		return ""
	}

	suffix := l7Suffix(f.GetL7())
	return fmt.Sprintf("%d %s%s", port, proto, suffix)
}

func l7Suffix(l7 *flow.Layer7) string {
	if l7 == nil {
		return ""
	}
	switch {
	case l7.GetHttp() != nil:
		return " · HTTP"
	case l7.GetDns() != nil:
		return " · DNS"
	case l7.GetKafka() != nil:
		return " · Kafka"
	default:
		return ""
	}
}

// l7Signature returns a single short human-readable label for one flow's L7
// payload, used as a map key for top-N aggregation per edge. Returns empty
// string for flows without an L7 layer or for protocols we don't summarize.
//
// Examples:
//   - HTTP: "HTTP GET /api/users", "HTTP POST /login → 401"
//   - DNS:  "DNS google.com [A]"
//   - Kafka: "Kafka Produce orders"
func l7Signature(l7 *flow.Layer7) string {
	if l7 == nil {
		return ""
	}
	switch {
	case l7.GetHttp() != nil:
		h := l7.GetHttp()
		path := httpPath(h.GetUrl())
		method := h.GetMethod()
		if method == "" {
			method = "?"
		}
		if path == "" {
			path = "/"
		}
		if code := h.GetCode(); code != 0 {
			return fmt.Sprintf("HTTP %s %s → %d", method, path, code)
		}
		return fmt.Sprintf("HTTP %s %s", method, path)
	case l7.GetDns() != nil:
		d := l7.GetDns()
		q := d.GetQuery()
		if q == "" {
			return ""
		}
		if qt := d.GetQtypes(); len(qt) > 0 {
			return fmt.Sprintf("DNS %s [%s]", q, qt[0])
		}
		return fmt.Sprintf("DNS %s", q)
	case l7.GetKafka() != nil:
		k := l7.GetKafka()
		topic := k.GetTopic()
		api := k.GetApiKey()
		if topic == "" && api == "" {
			return ""
		}
		if topic == "" {
			return fmt.Sprintf("Kafka %s", api)
		}
		if api == "" {
			return fmt.Sprintf("Kafka %s", topic)
		}
		return fmt.Sprintf("Kafka %s %s", api, topic)
	}
	return ""
}

// httpPath strips query string and fragment from a URL so different cache-
// busting query params don't blow up the L7 signature cardinality.
func httpPath(url string) string {
	if url == "" {
		return ""
	}
	if i := indexByte(url, '?'); i >= 0 {
		url = url[:i]
	}
	if i := indexByte(url, '#'); i >= 0 {
		url = url[:i]
	}
	return url
}

func indexByte(s string, b byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == b {
			return i
		}
	}
	return -1
}

func applyNodeMeta(n SnapshotNode, meta *NodeMetaCounters) SnapshotNode {
	if meta == nil {
		return n
	}

	topPorts := topN(meta.Ports, TopNodePortsLimit)
	if len(topPorts) > 0 {
		n.TopPorts = make([]NamedPort, len(topPorts))
		for i, p := range topPorts {
			n.TopPorts[i] = NamedPort{Name: p.Name, Count: p.Count}
		}
	}

	topLabels := topN(meta.Labels, TopNodeLabelsLimit)
	if len(topLabels) > 0 {
		n.Labels = make([]string, len(topLabels))
		for i, l := range topLabels {
			n.Labels[i] = l.Name
		}
	}

	n.IngressOpen = meta.IngressForwarded > 0 && meta.IngressDropped == 0
	n.EgressOpen = meta.EgressForwarded > 0 && meta.EgressDropped == 0
	if meta.IngressDropped > 0 {
		n.IngressDenied = true
	}
	if meta.EgressDropped > 0 {
		n.EgressDenied = true
	}

	return n
}
