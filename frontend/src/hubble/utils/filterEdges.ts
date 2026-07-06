import {HubbleEdge, HubbleNode} from 'src/hubble/types'

export const TOP_EDGES_LIMIT = 20

// VerdictFilter narrows which edges are shown by their policy outcome.
// 'denied' surfaces edges with any DROPPED flows; 'allowed' shows clean edges
// only (no DROPPED). 'all' applies no verdict filter.
export type VerdictFilter = 'all' | 'denied' | 'allowed'

export interface TopologyNoiseFilters {
  hideDNS: boolean
  hideHostNode: boolean
  hideMonitoring: boolean
}

export const DEFAULT_TOPOLOGY_NOISE_FILTERS: TopologyNoiseFilters = {
  hideDNS: false,
  hideHostNode: false,
  hideMonitoring: false,
}

const searchableNodeText = (node: HubbleNode): string =>
  [node.id, node.name, node.label, ...(node.labels || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

const hasToken = (text: string, tokens: string[]): boolean =>
  new RegExp(`(^|[^a-z0-9])(?:${tokens.join('|')})($|[^a-z0-9])`).test(text)

export const isDnsInfrastructureNode = (node: HubbleNode): boolean =>
  node.namespace === 'kube-system' &&
  hasToken(searchableNodeText(node), ['coredns', 'kube-dns', 'node-local-dns'])

export const isHostNodeInfrastructure = (node: HubbleNode): boolean =>
  node.id === 'ext:reserved:host' || node.id === 'ext:reserved:remote-node'

export const isMonitoringInfrastructureNode = (node: HubbleNode): boolean =>
  hasToken(searchableNodeText(node), [
    'prometheus',
    'kube-prometheus',
    'prometheus-server',
  ])

const isHiddenByNoiseFilter = (
  node: HubbleNode,
  filters: TopologyNoiseFilters
): boolean =>
  (filters.hideDNS && isDnsInfrastructureNode(node)) ||
  (filters.hideHostNode && isHostNodeInfrastructure(node)) ||
  (filters.hideMonitoring && isMonitoringInfrastructureNode(node))

export const isSelfLoop = (edge: HubbleEdge): boolean => edge.src === edge.dst

const hasDenied = (edge: HubbleEdge): boolean =>
  (edge.verdictCounts?.DROPPED ?? 0) > 0

export const visibleNodes = (
  nodes: HubbleNode[],
  hideSystemNodes: boolean,
  noiseFilters: TopologyNoiseFilters = DEFAULT_TOPOLOGY_NOISE_FILTERS
): HubbleNode[] =>
  nodes.filter(
    node =>
      (!hideSystemNodes || !node.system) &&
      !isHiddenByNoiseFilter(node, noiseFilters)
  )

export const filterDisplayEdges = (
  edges: HubbleEdge[],
  opts: {
    topN: number
    hideSelfLoops: boolean
    visibleNodeIds: Set<string>
    simplifiedView: boolean
    verdictFilter: VerdictFilter
  }
): HubbleEdge[] => {
  let filtered = edges.filter(
    e => opts.visibleNodeIds.has(e.src) && opts.visibleNodeIds.has(e.dst)
  )

  if (opts.hideSelfLoops) {
    filtered = filtered.filter(e => !isSelfLoop(e))
  }

  if (opts.verdictFilter === 'denied') {
    filtered = filtered.filter(hasDenied)
  } else if (opts.verdictFilter === 'allowed') {
    filtered = filtered.filter(e => !hasDenied(e))
  }

  if (!opts.simplifiedView) {
    return filtered
  }

  return [...filtered]
    .sort((a, b) => b.flowCount - a.flowCount)
    .slice(0, opts.topN)
}
