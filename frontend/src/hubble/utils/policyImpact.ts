import {
  HubbleFlowFilters,
  HubbleFlowRecord,
  PolicyImpactBaseline,
  PolicyImpactComparison,
  PolicyImpactContext,
  PolicyImpactEntry,
  PolicyImpactSummary,
} from 'src/hubble/types'

const VERDICT_RANK: Record<string, number> = {
  DROPPED: 4,
  ERROR: 3,
  AUDIT: 2,
  FORWARDED: 1,
}

export const buildPolicyBaseline = (
  flows: HubbleFlowRecord[],
  context: PolicyImpactContext
): PolicyImpactBaseline => ({
  capturedAt: new Date().toISOString(),
  context: normalizeContext(context),
  summaries: summarizeFlows(flows),
  flowCount: flows.length,
})

export const comparePolicyImpact = (
  baseline: PolicyImpactBaseline,
  currentFlows: HubbleFlowRecord[],
  context: PolicyImpactContext
): PolicyImpactComparison => {
  const current = summarizeFlows(currentFlows)
  const currentByKey = mapByKey(current)
  const baselineByKey = mapByKey(baseline.summaries)
  const result: PolicyImpactComparison = {
    contextMatches: contextsEqual(baseline.context, normalizeContext(context)),
    baselineCount: baseline.summaries.length,
    currentCount: current.length,
    newlyDenied: [],
    stillDenied: [],
    recovered: [],
    stillAllowed: [],
    newConnections: [],
    missingConnections: [],
  }

  baseline.summaries.forEach(before => {
    const after = currentByKey.get(before.key)
    if (!after) {
      result.missingConnections.push(toEntry(before, undefined))
      return
    }
    const entry = toEntry(before, after)
    if (!isDenied(before.primaryVerdict) && isDenied(after.primaryVerdict)) {
      result.newlyDenied.push(entry)
      return
    }
    if (isDenied(before.primaryVerdict) && isDenied(after.primaryVerdict)) {
      result.stillDenied.push(entry)
      return
    }
    if (isDenied(before.primaryVerdict) && !isDenied(after.primaryVerdict)) {
      result.recovered.push(entry)
      return
    }
    result.stillAllowed.push(entry)
  })

  current.forEach(after => {
    if (!baselineByKey.has(after.key)) {
      result.newConnections.push(toEntry(undefined, after))
    }
  })

  sortEntries(result.newlyDenied)
  sortEntries(result.stillDenied)
  sortEntries(result.recovered)
  sortEntries(result.stillAllowed)
  sortEntries(result.newConnections)
  sortEntries(result.missingConnections)
  return result
}

const summarizeFlows = (flows: HubbleFlowRecord[]): PolicyImpactSummary[] => {
  const summaries = new Map<string, PolicyImpactSummary>()
  flows.forEach(flow => {
    const key = flowSignature(flow)
    const summary = summaries.get(key) || newSummary(key, flow)
    summary.flowCount += 1
    const verdict = normalizeVerdict(flow.verdict)
    summary.verdicts[verdict] = (summary.verdicts[verdict] || 0) + 1
    summary.primaryVerdict = strongestVerdict(summary.primaryVerdict, verdict)
    if (flow.dropReason) {
      summary.dropReasons[flow.dropReason] =
        (summary.dropReasons[flow.dropReason] || 0) + 1
    }
    summaries.set(key, summary)
  })
  return Array.from(summaries.values())
}

const newSummary = (
  key: string,
  flow: HubbleFlowRecord
): PolicyImpactSummary => ({
  key,
  srcNamespace: flow.srcNamespace || '',
  srcWorkload: flow.srcWorkload || '',
  srcLabel: endpointLabel(flow, 'src'),
  dstNamespace: flow.dstNamespace || '',
  dstWorkload: flow.dstWorkload || '',
  dstLabel: endpointLabel(flow, 'dst'),
  port: flow.dstPort || flow.srcPort,
  protocol: flow.protocol || '',
  l7: flow.l7 || '',
  flowCount: 0,
  primaryVerdict: 'UNKNOWN',
  verdicts: {},
  dropReasons: {},
})

const flowSignature = (flow: HubbleFlowRecord): string =>
  [
    endpointLabel(flow, 'src'),
    endpointLabel(flow, 'dst'),
    flow.protocol || '',
    flow.dstPort || flow.srcPort || '',
    flow.l7 || '',
  ].join('|')

const endpointLabel = (flow: HubbleFlowRecord, side: 'src' | 'dst'): string => {
  if (side === 'src') {
    return (
      flow.srcWorkload ||
      flow.srcPod ||
      flow.srcId ||
      flow.srcIp ||
      'unknown-source'
    )
  }
  return (
    flow.dstWorkload ||
    flow.dstPod ||
    flow.dstId ||
    flow.dstIp ||
    'unknown-destination'
  )
}

const normalizeVerdict = (verdict: string): string =>
  (verdict || 'UNKNOWN').toUpperCase()

const strongestVerdict = (a: string, b: string): string => {
  const ar = VERDICT_RANK[a] || 0
  const br = VERDICT_RANK[b] || 0
  return br > ar ? b : a
}

const isDenied = (verdict: string): boolean => verdict === 'DROPPED'

const mapByKey = (
  summaries: PolicyImpactSummary[]
): Map<string, PolicyImpactSummary> =>
  summaries.reduce((acc, s) => acc.set(s.key, s), new Map())

const toEntry = (
  before?: PolicyImpactSummary,
  after?: PolicyImpactSummary
): PolicyImpactEntry => {
  const base = after || before!
  return {
    key: base.key,
    srcLabel: base.srcLabel,
    dstLabel: base.dstLabel,
    srcWorkload: base.srcWorkload,
    dstWorkload: base.dstWorkload,
    port: base.port,
    protocol: base.protocol,
    l7: base.l7,
    beforeVerdict: before?.primaryVerdict,
    afterVerdict: after?.primaryVerdict,
    beforeCount: before?.flowCount || 0,
    afterCount: after?.flowCount || 0,
    dropReasons: after?.dropReasons || before?.dropReasons || {},
  }
}

const sortEntries = (entries: PolicyImpactEntry[]): void => {
  entries.sort(
    (a, b) => b.afterCount + b.beforeCount - (a.afterCount + a.beforeCount)
  )
}

const normalizeContext = (
  context: PolicyImpactContext
): PolicyImpactContext => ({
  cluster: context.cluster,
  namespace: context.namespace || '',
  filters: normalizeFilters(context.filters),
})

const normalizeFilters = (
  filters?: HubbleFlowFilters
): HubbleFlowFilters | undefined => {
  if (!filters) return undefined
  const out: HubbleFlowFilters = {}
  Object.entries(filters).forEach(([key, value]) => {
    if (typeof value === 'boolean') {
      if (value) out[key] = value
      return
    }
    if (typeof value === 'string' && value.trim()) {
      out[key] = value.trim()
    }
  })
  return Object.keys(out).length ? out : undefined
}

const contextsEqual = (
  a: PolicyImpactContext,
  b: PolicyImpactContext
): boolean => JSON.stringify(a) === JSON.stringify(b)
