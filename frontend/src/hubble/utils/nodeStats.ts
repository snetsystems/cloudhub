import {HubbleSnapshot} from 'src/hubble/types'
import {edgeVerdict} from 'src/hubble/utils/edgeVerdict'

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
    const denied =
      verdict === 'denied'
        ? edge.recentVerdictCounts?.DROPPED || edge.verdictCounts?.DROPPED || 1
        : 0
    const hadDeny = verdict === 'denied' || verdict === 'recovered'

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
  }

  return stats
}
