import {HubbleFlowRecord} from 'src/hubble/types'

export type PodConnectionDirection = 'inbound' | 'outbound'

export interface PodOption {
  key: string
  namespace: string
  pod: string
  workload: string
  flowCount: number
  deniedFlows: number
  lastSeen: string
}

export interface PodConnectionSummary {
  key: string
  direction: PodConnectionDirection
  peerNamespace: string
  peerPod: string
  peerWorkload: string
  peerIp: string
  peerId: string
  port?: number
  protocol: string
  flowCount: number
  lastSeen: string
  verdictCounts: Record<string, number>
  dropReasons: Record<string, number>
}

export const podKey = (namespace?: string, pod?: string): string =>
  namespace && pod ? `${namespace}/${pod}` : ''

export const summarizePods = (
  flows: HubbleFlowRecord[],
  namespace?: string | null
): PodOption[] => {
  const pods = new Map<string, PodOption>()
  flows.forEach(flow => {
    const denied = flow.verdict === 'DROPPED'
    addPod(pods, {
      namespace: flow.srcNamespace || '',
      pod: flow.srcPod || '',
      workload: flow.srcWorkload || '',
      time: flow.time,
      denied,
      filterNamespace: namespace,
    })
    addPod(pods, {
      namespace: flow.dstNamespace || '',
      pod: flow.dstPod || '',
      workload: flow.dstWorkload || '',
      time: flow.time,
      denied,
      filterNamespace: namespace,
    })
  })
  return Array.from(pods.values()).sort(comparePods)
}

// comparePods surfaces pods with denied flows first — a pod under active
// policy drops is what an operator needs to see regardless of how little
// traffic it otherwise carries (a failing pod often has few flows, not many).
export const comparePods = (a: PodOption, b: PodOption): number => {
  const deniedDelta = Number(b.deniedFlows > 0) - Number(a.deniedFlows > 0)
  if (deniedDelta !== 0) return deniedDelta
  if (b.flowCount !== a.flowCount) return b.flowCount - a.flowCount
  return b.lastSeen.localeCompare(a.lastSeen)
}

// reconcilePodOrder keeps already-listed pods pinned at their current
// position across live updates instead of re-sorting on every flow push —
// the underlying flow window is a noisy rolling sample, so raw flowCount
// order changes constantly even though nothing meaningful happened. A full
// re-sort only happens when there is nothing to preserve yet, or when the
// set of pods with active denies changes (a real, worth-surfacing event).
// Pods that are otherwise new just get appended in sorted order.
export const reconcilePodOrder = (
  prevOrder: string[],
  prevDeniedKeys: Set<string>,
  pods: PodOption[]
): string[] => {
  const byKey = new Map(pods.map(p => [p.key, p]))
  const deniedKeys = new Set(
    pods.filter(p => p.deniedFlows > 0).map(p => p.key)
  )
  const deniedSetChanged =
    deniedKeys.size !== prevDeniedKeys.size ||
    Array.from(deniedKeys).some(key => !prevDeniedKeys.has(key))

  if (prevOrder.length === 0 || deniedSetChanged) {
    return pods.slice().sort(comparePods).map(p => p.key)
  }

  const kept = prevOrder.filter(key => byKey.has(key))
  const known = new Set(kept)
  const fresh = pods
    .filter(p => !known.has(p.key))
    .sort(comparePods)
    .map(p => p.key)
  return [...kept, ...fresh]
}

export const summarizePodConnections = (
  flows: HubbleFlowRecord[],
  selectedPodKey: string
): PodConnectionSummary[] => {
  if (!selectedPodKey) return []

  const connections = new Map<string, PodConnectionSummary>()
  flows.forEach(flow => {
    const srcKey = podKey(flow.srcNamespace, flow.srcPod)
    const dstKey = podKey(flow.dstNamespace, flow.dstPod)
    if (srcKey !== selectedPodKey && dstKey !== selectedPodKey) return

    const direction: PodConnectionDirection =
      srcKey === selectedPodKey ? 'outbound' : 'inbound'
    const peer =
      direction === 'outbound' ? endpoint(flow, 'dst') : endpoint(flow, 'src')
    const port = flow.dstPort || flow.srcPort
    const protocol = flow.protocol || ''
    const key = [
      direction,
      peer.key || peer.ip || peer.id || 'unknown',
      port || '',
      protocol,
      flow.verdict || '',
    ].join('|')

    const summary = connections.get(key) || {
      key,
      direction,
      peerNamespace: peer.namespace,
      peerPod: peer.pod,
      peerWorkload: peer.workload,
      peerIp: peer.ip,
      peerId: peer.id,
      port,
      protocol,
      flowCount: 0,
      lastSeen: '',
      verdictCounts: {},
      dropReasons: {},
    }

    summary.flowCount += 1
    summary.lastSeen = newerTime(summary.lastSeen, flow.time)
    const verdict = flow.verdict || 'UNKNOWN'
    summary.verdictCounts[verdict] = (summary.verdictCounts[verdict] || 0) + 1
    if (flow.dropReason) {
      summary.dropReasons[flow.dropReason] =
        (summary.dropReasons[flow.dropReason] || 0) + 1
    }
    connections.set(key, summary)
  })

  return Array.from(connections.values()).sort((a, b) => {
    if (b.flowCount !== a.flowCount) return b.flowCount - a.flowCount
    return b.lastSeen.localeCompare(a.lastSeen)
  })
}

const addPod = (
  pods: Map<string, PodOption>,
  input: {
    namespace: string
    pod: string
    workload: string
    time: string
    denied: boolean
    filterNamespace?: string | null
  }
) => {
  if (!input.namespace || !input.pod) return
  if (input.filterNamespace && input.namespace !== input.filterNamespace) return
  const key = podKey(input.namespace, input.pod)
  const pod = pods.get(key) || {
    key,
    namespace: input.namespace,
    pod: input.pod,
    workload: input.workload,
    flowCount: 0,
    deniedFlows: 0,
    lastSeen: '',
  }
  pod.flowCount += 1
  if (input.denied) pod.deniedFlows += 1
  pod.lastSeen = newerTime(pod.lastSeen, input.time)
  if (!pod.workload && input.workload) pod.workload = input.workload
  pods.set(key, pod)
}

const endpoint = (flow: HubbleFlowRecord, side: 'src' | 'dst') => {
  const namespace =
    side === 'src' ? flow.srcNamespace || '' : flow.dstNamespace || ''
  const pod = side === 'src' ? flow.srcPod || '' : flow.dstPod || ''
  return {
    namespace,
    pod,
    key: podKey(namespace, pod),
    workload: side === 'src' ? flow.srcWorkload || '' : flow.dstWorkload || '',
    ip: side === 'src' ? flow.srcIp || '' : flow.dstIp || '',
    id: side === 'src' ? flow.srcId || '' : flow.dstId || '',
  }
}

const newerTime = (a: string, b: string): string => {
  if (!a) return b
  if (!b) return a
  return new Date(b).getTime() > new Date(a).getTime() ? b : a
}
