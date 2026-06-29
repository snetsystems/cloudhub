import {HubbleEdge, HubbleNode} from 'src/hubble/types'

export const TOP_EDGES_LIMIT = 20

// VerdictFilter narrows which edges are shown by their policy outcome.
// 'denied' surfaces edges with any DROPPED flows; 'allowed' shows clean edges
// only (no DROPPED). 'all' applies no verdict filter.
export type VerdictFilter = 'all' | 'denied' | 'allowed'

export const isSelfLoop = (edge: HubbleEdge): boolean => edge.src === edge.dst

const hasDenied = (edge: HubbleEdge): boolean =>
  (edge.verdictCounts?.DROPPED ?? 0) > 0

export const visibleNodes = (
  nodes: HubbleNode[],
  hideSystemNodes: boolean
): HubbleNode[] =>
  hideSystemNodes ? nodes.filter(n => !n.system) : nodes

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
