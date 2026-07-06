package hubble

import "github.com/cilium/cilium/api/v1/flow"

// Level controls the granularity of node IDs produced by MapFlow.
type Level int

const (
	LevelNamespace Level = iota
	LevelWorkload
)

// MapFlow returns (srcID, dstID) for the given flow at the requested level.
func MapFlow(f *flow.Flow, lvl Level) (string, string) {
	return NewEndpointResolver().MapFlow(f, lvl)
}

func endpointID(ep *flow.Endpoint, dnsNames []string, lvl Level) string {
	return NewEndpointResolver().ResolveEndpoint(ep, dnsNames).ID(lvl)
}
