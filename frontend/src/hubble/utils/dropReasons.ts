import {HubbleEdge, HubbleNamedCount} from 'src/hubble/types'

// Cilium reports a drop reason per flow. Only some of them mean "a
// NetworkPolicy rejected this"; the rest are infrastructure-level drops the
// datapath makes before any policy is consulted — an IPv6 Router Solicitation
// on an IPv4-only cluster, an MTU problem, a missing route. Both arrive as
// DROPPED, so counting them together makes a single stray NDP packet look
// like a policy violation.
const isPolicyReason = (name: string): boolean => name.includes('POLICY')

const reasonName = (item: HubbleNamedCount): string =>
  (item.name || item.reason || '').toUpperCase()

export interface EdgeDropSplit {
  policy: number
  infra: number
  // Infrastructure reasons with their counts, highest first.
  infraReasons: HubbleNamedCount[]
}

// splitDrops divides a DROPPED total into policy denials and infrastructure
// drops using the edge's reason breakdown.
//
// `total` is passed in because the caller decides which window it cares about
// (recent bucket vs full window) while topDenyReasons only ever covers the
// full window. The split is therefore proportional in spirit: when reasons are
// missing or do not add up, the remainder counts as policy. Attributing the
// unknown to policy is the safe direction — a real denial must never be
// silently downgraded to noise.
export const splitDrops = (edge: HubbleEdge, total: number): EdgeDropSplit => {
  if (total <= 0) return {policy: 0, infra: 0, infraReasons: []}

  const reasons = edge.topDenyReasons || []
  if (reasons.length === 0) return {policy: total, infra: 0, infraReasons: []}

  const infraReasons = reasons
    .filter(r => !isPolicyReason(reasonName(r)))
    .slice()
    .sort((a, b) => b.count - a.count)

  const infraTotal = infraReasons.reduce((sum, r) => sum + r.count, 0)
  const infra = Math.min(infraTotal, total)
  return {policy: total - infra, infra, infraReasons}
}

// Drops in the window, split by cause. Used for node badges.
export const windowDropSplit = (edge: HubbleEdge): EdgeDropSplit =>
  splitDrops(edge, edge.verdictCounts?.DROPPED || 0)

// Drops in the recent short interval, split by cause. Used for edge verdicts,
// which must reflect current reality rather than the whole window.
export const recentDropSplit = (edge: HubbleEdge): EdgeDropSplit =>
  splitDrops(edge, edge.recentVerdictCounts?.DROPPED || 0)

export const mergeReasons = (
  a: HubbleNamedCount[],
  b: HubbleNamedCount[]
): HubbleNamedCount[] => {
  const accum = new Map<string, number>()
  for (const item of [...a, ...b]) {
    const key = reasonName(item)
    if (!key) continue
    accum.set(key, (accum.get(key) || 0) + item.count)
  }
  return Array.from(accum, ([name, count]) => ({name, count})).sort(
    (x, y) => y.count - x.count
  )
}

// Short labels for the reasons a demo or drill actually runs into. Anything
// unmapped falls back to the raw Cilium name, which the badge truncates and
// the tooltip spells out in full.
const SHORT_LABELS: Record<string, string> = {
  UNSUPPORTED_L3_PROTOCOL: 'L3 미지원',
  INVALID_SOURCE_IP: '출발지 IP 오류',
  UNROUTABLE: '라우팅 불가',
  FRAG_NEEDED: 'MTU 초과',
  NO_MAPPING: '매핑 없음',
  HOST_UNREACHABLE: '호스트 불가',
  UNKNOWN_CONNECTION_TRACKING_STATE: 'CT 상태 불명',
}

export const shortReasonLabel = (item: HubbleNamedCount): string => {
  const name = reasonName(item)
  return SHORT_LABELS[name] || name
}
