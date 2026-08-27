import {HubbleNamedCount, HubbleSnapshot} from 'src/hubble/types'
import {edgeVerdict} from 'src/hubble/utils/edgeVerdict'
import {
  mergeReasons,
  recentDropSplit,
  windowDropSplit,
} from 'src/hubble/utils/dropReasons'

// Hubble flow proto does not carry payload byte counts, so only flow-event
// counts are tracked. Byte-level metrics would have to come from a separate
// data source (Prometheus / conntrack).
export interface NodeTrafficStats {
  inFlows: number
  outFlows: number
  internalFlows: number
  deniedFlows: number
  ingressDeniedFlows: number
  egressDeniedFlows: number
  ingressDenied: boolean
  egressDenied: boolean
  // hadRecentDeny is true when at least one incident-or-recovered edge touches
  // the node. Lets the UI show a soft warning on nodes whose edges were
  // blocked within the window but are currently flowing again.
  hadRecentDeny: boolean
  // Drops the datapath made before any policy was consulted — wrong L3
  // protocol, MTU, no route. Counted apart from deniedFlows so infrastructure
  // noise cannot read as a policy violation.
  infraDroppedFlows: number
  infraDropReasons: HubbleNamedCount[]
}

const emptyStats = (): NodeTrafficStats => ({
  inFlows: 0,
  outFlows: 0,
  internalFlows: 0,
  deniedFlows: 0,
  ingressDeniedFlows: 0,
  egressDeniedFlows: 0,
  ingressDenied: false,
  egressDenied: false,
  hadRecentDeny: false,
  infraDroppedFlows: 0,
  infraDropReasons: [],
})

export const buildNodeStats = (
  snapshot: HubbleSnapshot
): Map<string, NodeTrafficStats> => {
  const stats = new Map<string, NodeTrafficStats>()

  const get = (id: string): NodeTrafficStats => {
    let s = stats.get(id)
    if (!s) {
      s = emptyStats()
      stats.set(id, s)
    }
    return s
  }

  for (const edge of snapshot.edges || []) {
    const verdict = edgeVerdict(edge)
    const recentPolicy = recentDropSplit(edge).policy
    const denied =
      verdict === 'denied'
        ? recentPolicy || windowDropSplit(edge).policy || 1
        : 0
    const hadDeny = verdict === 'denied' || verdict === 'recovered'
    const {infra, infraReasons} = windowDropSplit(edge)

    const addInfra = (id: string) => {
      if (infra <= 0) return
      const s = get(id)
      s.infraDroppedFlows += infra
      s.infraDropReasons = mergeReasons(s.infraDropReasons, infraReasons)
    }

    if (edge.src === edge.dst) {
      const s = get(edge.src)
      s.internalFlows += edge.flowCount
      s.deniedFlows += denied
      if (denied > 0) {
        s.ingressDeniedFlows += denied
        s.egressDeniedFlows += denied
        s.ingressDenied = true
        s.egressDenied = true
      }
      if (hadDeny) s.hadRecentDeny = true
      addInfra(edge.src)
      continue
    }

    const src = get(edge.src)
    src.outFlows += edge.flowCount
    src.deniedFlows += denied
    src.egressDeniedFlows += denied
    if (denied > 0) src.egressDenied = true
    if (hadDeny) src.hadRecentDeny = true

    const dst = get(edge.dst)
    dst.inFlows += edge.flowCount
    dst.deniedFlows += denied
    dst.ingressDeniedFlows += denied
    if (denied > 0) dst.ingressDenied = true
    if (hadDeny) dst.hadRecentDeny = true

    addInfra(edge.src)
    addInfra(edge.dst)
  }

  return stats
}
