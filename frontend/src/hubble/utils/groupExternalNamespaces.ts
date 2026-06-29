import {
  HubbleEdge,
  HubbleNamedCount,
  HubbleNode,
  HubblePolicyRefCount,
  HubbleSnapshot,
} from 'src/hubble/types'

// CrossNsMode controls how the ServiceMap presents workloads that live in
// namespaces other than the current drilldown focus.
//   - 'show'  → no special treatment, every workload rendered as a full card
//   - 'dim'   → cards rendered at reduced opacity (Hubble UI style)
//   - 'group' → workloads from each foreign ns are collapsed into one ns-group
//               card (CloudHub addition for high-density clusters)
export type CrossNsMode = 'show' | 'dim' | 'group'

// isCrossNsNodeId returns true when the node id represents a workload outside
// the given drilldown namespace. Used by both the grouping transform and the
// dim treatment so they agree on what "cross-ns" means.
export const isCrossNsNodeId = (
  nodeId: string,
  drilldownNamespace: string | null
): boolean => {
  if (!drilldownNamespace) return false
  if (!nodeId.startsWith('wl:')) return false
  const slash = nodeId.indexOf('/', 3)
  if (slash <= 3) return false
  return nodeId.slice(3, slash) !== drilldownNamespace
}

// groupExternalNamespaces collapses cross-namespace workload nodes during
// drilldown into one synthetic "namespace group" node per foreign namespace.
//
// Hubble's workload-level snapshot, when filtered to a single namespace,
// surfaces every other-namespace workload that talks to the drilldown ns as
// its own card. On busy clusters this turns the map into a wall of cards
// dominated by peripheral peers. Collapsing them keeps the focus on the
// drilldown namespace's own workloads while still showing that "namespace X
// talks to us".
//
// Pure function — backend snapshot is never mutated. Returns the input
// unchanged in cases where grouping is not applicable (no drilldown, overview
// snapshot, or no foreign workloads).
export const groupExternalNamespaces = (
  snapshot: HubbleSnapshot | null,
  drilldownNamespace: string | null
): HubbleSnapshot | null => {
  if (!snapshot) return snapshot
  if (!drilldownNamespace) return snapshot
  if (snapshot.kind !== 'workload') return snapshot

  const ownPrefix = `wl:${drilldownNamespace}/`

  const remap = new Map<string, string>()
  const memberCounts = new Map<string, number>()

  for (const node of snapshot.nodes) {
    if (node.kind !== 'workload') continue
    if (node.id.startsWith(ownPrefix)) continue
    const ns = workloadNamespace(node)
    if (!ns) continue
    const newId = groupNodeId(ns)
    remap.set(node.id, newId)
    memberCounts.set(newId, (memberCounts.get(newId) || 0) + 1)
  }

  if (remap.size === 0) return snapshot

  const replacements = new Map<string, HubbleNode>()
  for (const [newId, count] of memberCounts) {
    const ns = newId.slice(GROUP_PREFIX.length)
    replacements.set(newId, {
      id: newId,
      kind: 'namespace',
      name: ns,
      label: ns,
      namespace: ns,
      groupedKind: 'namespace-group',
      groupedMemberCount: count,
    })
  }

  const newNodes: HubbleNode[] = []
  for (const node of snapshot.nodes) {
    if (remap.has(node.id)) continue
    newNodes.push(node)
  }
  for (const replacement of replacements.values()) {
    newNodes.push(replacement)
  }

  const edgeMap = new Map<string, HubbleEdge>()
  for (const edge of snapshot.edges) {
    const newSrc = remap.get(edge.src) || edge.src
    const newDst = remap.get(edge.dst) || edge.dst
    const key = `${newSrc}|${newDst}`
    const existing = edgeMap.get(key)
    if (!existing) {
      edgeMap.set(key, cloneEdgeWithEndpoints(edge, newSrc, newDst))
    } else {
      mergeEdge(existing, edge)
    }
  }

  return {
    ...snapshot,
    nodes: newNodes,
    edges: Array.from(edgeMap.values()),
  }
}

const GROUP_PREFIX = 'nsgrp:'
const groupNodeId = (ns: string): string => `${GROUP_PREFIX}${ns}`

const workloadNamespace = (node: HubbleNode): string | null => {
  if (node.namespace) return node.namespace
  if (node.id.startsWith('wl:')) {
    const slash = node.id.indexOf('/', 3)
    if (slash > 3) return node.id.slice(3, slash)
  }
  return null
}

const cloneEdgeWithEndpoints = (
  edge: HubbleEdge,
  src: string,
  dst: string
): HubbleEdge => ({
  ...edge,
  src,
  dst,
  verdictCounts: {...edge.verdictCounts},
  recentVerdictCounts: edge.recentVerdictCounts
    ? {...edge.recentVerdictCounts}
    : undefined,
  topDenyReasons: edge.topDenyReasons ? edge.topDenyReasons.map(x => ({...x})) : undefined,
  topAllowedPolicies: edge.topAllowedPolicies
    ? edge.topAllowedPolicies.map(x => ({...x}))
    : undefined,
  topDeniedPolicies: edge.topDeniedPolicies
    ? edge.topDeniedPolicies.map(x => ({...x}))
    : undefined,
  topL7: edge.topL7 ? edge.topL7.map(x => ({...x})) : undefined,
  topL7Denied: edge.topL7Denied ? edge.topL7Denied.map(x => ({...x})) : undefined,
})

const mergeEdge = (target: HubbleEdge, source: HubbleEdge) => {
  target.flowCount += source.flowCount
  addCounts(target.verdictCounts, source.verdictCounts)
  if (source.recentVerdictCounts) {
    if (!target.recentVerdictCounts) target.recentVerdictCounts = {}
    addCounts(target.recentVerdictCounts, source.recentVerdictCounts)
  }
  target.topDenyReasons = mergeTopNamed(target.topDenyReasons, source.topDenyReasons)
  target.topL7 = mergeTopNamed(target.topL7, source.topL7)
  target.topL7Denied = mergeTopNamed(target.topL7Denied, source.topL7Denied)
  target.topAllowedPolicies = mergeTopPolicies(
    target.topAllowedPolicies,
    source.topAllowedPolicies
  )
  target.topDeniedPolicies = mergeTopPolicies(
    target.topDeniedPolicies,
    source.topDeniedPolicies
  )
  // lastVerdict: keep whichever target already has. Without per-flow
  // timestamps we cannot meaningfully arbitrate between two merged edges.
}

const addCounts = (
  target: Record<string, number>,
  source: Record<string, number>
) => {
  for (const k of Object.keys(source)) {
    target[k] = (target[k] || 0) + source[k]
  }
}

const TOP_LIMIT = 5

const mergeTopNamed = (
  a?: HubbleNamedCount[],
  b?: HubbleNamedCount[]
): HubbleNamedCount[] | undefined => {
  if (!a && !b) return undefined
  const accum = new Map<string, HubbleNamedCount>()
  const ingest = (items?: HubbleNamedCount[]) => {
    if (!items) return
    for (const item of items) {
      const key = item.name || item.reason || ''
      const existing = accum.get(key)
      if (existing) existing.count += item.count
      else accum.set(key, {...item})
    }
  }
  ingest(a)
  ingest(b)
  return Array.from(accum.values())
    .sort((x, y) => y.count - x.count)
    .slice(0, TOP_LIMIT)
}

const mergeTopPolicies = (
  a?: HubblePolicyRefCount[],
  b?: HubblePolicyRefCount[]
): HubblePolicyRefCount[] | undefined => {
  if (!a && !b) return undefined
  const accum = new Map<string, HubblePolicyRefCount>()
  const ingest = (items?: HubblePolicyRefCount[]) => {
    if (!items) return
    for (const item of items) {
      const key = `${item.kind || ''}|${item.namespace || ''}|${item.name}`
      const existing = accum.get(key)
      if (existing) existing.count += item.count
      else accum.set(key, {...item})
    }
  }
  ingest(a)
  ingest(b)
  return Array.from(accum.values())
    .sort((x, y) => y.count - x.count)
    .slice(0, TOP_LIMIT)
}
