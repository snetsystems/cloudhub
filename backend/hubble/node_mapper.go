package hubble

import (
	"github.com/cilium/cilium/api/v1/flow"
)

// Level controls the granularity of node IDs produced by MapFlow.
type Level int

const (
	LevelNamespace Level = iota
	LevelWorkload
)

// Cilium reserved identities. We only care about world here.
const reservedIdentityWorld uint32 = 2

// MapFlow returns (srcID, dstID) for the given flow at the requested level.
func MapFlow(f *flow.Flow, lvl Level) (string, string) {
	return endpointID(f.GetSource(), f.GetSourceNames(), lvl),
		endpointID(f.GetDestination(), f.GetDestinationNames(), lvl)
}

func endpointID(ep *flow.Endpoint, dnsNames []string, lvl Level) string {
	if ep == nil {
		return "ext:unknown"
	}

	// External: world identity → FQDN or unknown
	if ep.GetIdentity() == reservedIdentityWorld || ep.GetNamespace() == "" {
		if len(dnsNames) > 0 && dnsNames[0] != "" {
			return "ext:fqdn:" + dnsNames[0]
		}
		return "ext:unknown"
	}

	if lvl == LevelNamespace {
		return "ns:" + ep.GetNamespace()
	}

	// Workload level
	wlName := "Unknown Workload"
	if wls := ep.GetWorkloads(); len(wls) > 0 && wls[0].GetName() != "" {
		wlName = wls[0].GetName()
	}
	return "wl:" + ep.GetNamespace() + "/" + wlName
}
