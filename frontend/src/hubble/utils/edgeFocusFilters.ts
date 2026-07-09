import {HubbleFlowFilters} from 'src/hubble/types'

// namespaceFromNodeId extracts the namespace name from a "ns:<name>"
// overview-level node id. Returns null for any other node kind.
export const namespaceFromNodeId = (nodeId: string): string | null => {
  if (!nodeId.startsWith('ns:')) return null
  return nodeId.slice(3) || null
}

const workloadNameFromNodeId = (nodeId: string): string | null => {
  if (!nodeId.startsWith('wl:')) return null
  const rest = nodeId.slice(3)
  const sep = rest.indexOf('/')
  const name = sep < 0 ? rest : rest.slice(sep + 1)
  return name || null
}

const fqdnFromNodeId = (nodeId: string): string | null => {
  const prefix = 'ext:fqdn:'
  if (!nodeId.startsWith(prefix)) return null
  return nodeId.slice(prefix.length) || null
}

// listViewQuery returns the free-text search term used to scope the flow
// table to a single active node when it isn't a namespace (namespaces get
// exact either-side matching via the dedicated snapshot `namespace` param
// instead — see nodeFocusFilters). Returns '' when the node has no
// reliable identifier to search on (ext:unknown, cross-ns "nsgrp:" groups).
const listViewQuery = (nodeId: string): string =>
  workloadNameFromNodeId(nodeId) || fqdnFromNodeId(nodeId) || ''

export interface NodeFocusFilters {
  // Overview-level (ns:) node scoping goes through the snapshot/flow
  // stream's dedicated `namespace` parameter (exact, either-side match),
  // not through `filters`, so callers must apply both.
  namespace: string | null
  filters: HubbleFlowFilters
}

// nodeFocusFilters derives how to scope the bottom flow table to a single
// active node (the "edge list" view — no specific edge picked yet).
export const nodeFocusFilters = (nodeId: string): NodeFocusFilters => {
  const namespace = namespaceFromNodeId(nodeId)
  if (namespace) return {namespace, filters: {}}
  const q = listViewQuery(nodeId)
  return {namespace: null, filters: q ? {q} : {}}
}

const sideFilter = (
  nodeId: string,
  side: 'src' | 'dst'
): HubbleFlowFilters => {
  const namespace = namespaceFromNodeId(nodeId)
  if (namespace) {
    return side === 'src' ? {srcNamespace: namespace} : {dstNamespace: namespace}
  }
  const workload = workloadNameFromNodeId(nodeId)
  if (workload) {
    return side === 'src' ? {srcWorkload: workload} : {dstWorkload: workload}
  }
  return {}
}

// edgeDetailFilters scopes the flow table to one exact src->dst pair. Each
// side is matched by whichever field is reliable for its node kind;
// external/unresolved endpoints contribute no filter for that side rather
// than guessing.
export const edgeDetailFilters = (
  srcId: string,
  dstId: string
): HubbleFlowFilters => ({
  ...sideFilter(srcId, 'src'),
  ...sideFilter(dstId, 'dst'),
})
