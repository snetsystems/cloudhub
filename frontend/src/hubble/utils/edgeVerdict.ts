import {HubbleEdge} from 'src/hubble/types'
import {recentDropSplit, windowDropSplit} from 'src/hubble/utils/dropReasons'

// 'recovered' = recent short interval (bucketDur) has only successful traffic,
// but the wider window (window) still contains DROPPED flows. Visually this
// stays the same color as 'forwarded' so the line reflects current reality,
// but the UI attaches a ⚠ badge / tooltip so the operator can tell apart
// "always healthy" from "broken in the last 5 minutes but currently fine".
export type EdgeVerdictCategory =
  | 'forwarded'
  | 'denied'
  | 'mixed'
  | 'errored'
  | 'recovered'

export const edgeVerdict = (edge: HubbleEdge): EdgeVerdictCategory => {
  const recent = edge.recentVerdictCounts || {}
  // Only policy denials colour an edge red. Infrastructure drops travel on
  // their own badge so a stray NDP packet cannot masquerade as a violation.
  const recentDropped = recentDropSplit(edge).policy
  const recentErrored = recent.ERROR || 0
  const recentForwarded = recent.FORWARDED || 0
  if (recentDropped > 0) return 'denied'
  if (recentErrored > 0) return 'errored'
  if (recentForwarded > 0) {
    return hasWindowDeny(edge) ? 'recovered' : 'forwarded'
  }

  const latest = (edge.lastVerdict || '').toUpperCase()
  // lastVerdict is a bare string with no reason attached, so it cannot be
  // split on its own. Fall back to the window: an edge whose only drops were
  // infrastructure-level is not a policy problem, whatever its last flow was.
  if (latest === 'DROPPED') return hasWindowDeny(edge) ? 'denied' : 'forwarded'
  if (latest === 'ERROR') return 'errored'
  if (latest === 'FORWARDED') {
    return hasWindowDeny(edge) ? 'recovered' : 'forwarded'
  }

  const v = edge.verdictCounts || {}
  const forwarded = v.FORWARDED || 0
  const denied = windowDropSplit(edge).policy
  const errored = v.ERROR || 0
  if (denied > 0 && forwarded > 0) return 'mixed'
  if (denied > 0) return 'denied'
  if (errored > 0) return 'errored'
  return 'forwarded'
}

const hasWindowDeny = (edge: HubbleEdge): boolean =>
  windowDropSplit(edge).policy > 0

export const edgeVerdictColor = (verdict: EdgeVerdictCategory): string => {
  switch (verdict) {
    case 'denied':
    case 'mixed':
      return '#ff6f6f'
    case 'errored':
      return '#ffb94a'
    // 'recovered' keeps the healthy color — the warning is signaled by a
    // separate badge so the line still reflects current traffic state.
    default:
      return '#4ed8a0'
  }
}
