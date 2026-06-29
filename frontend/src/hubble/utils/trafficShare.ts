import {HubbleEdge} from 'src/hubble/types'
import {NodeTrafficStats} from 'src/hubble/utils/nodeStats'

export interface TrafficTotals {
  totalIn: number
  totalOut: number
}

export type ShareMode = 'global' | 'edge' | 'reference' | 'none'

export interface NodeShareDisplay {
  mode: ShareMode
  inShare: string | null
  outShare: string | null
  inValue?: number | null
  outValue?: number | null
}

export const nodeInValue = (stats: NodeTrafficStats | undefined): number => {
  if (!stats) return 0
  return stats.inFlows + stats.internalFlows
}

export const nodeOutValue = (stats: NodeTrafficStats | undefined): number => {
  if (!stats) return 0
  return stats.outFlows
}

export const computeTrafficTotals = (
  nodeIds: Iterable<string>,
  nodeStats: Map<string, NodeTrafficStats>
): TrafficTotals => {
  let totalIn = 0
  let totalOut = 0
  for (const id of nodeIds) {
    const stats = nodeStats.get(id)
    totalIn += nodeInValue(stats)
    totalOut += nodeOutValue(stats)
  }
  return {totalIn, totalOut}
}

export const formatTrafficShare = (
  value: number,
  total: number
): string | null => {
  if (total <= 0 || value <= 0) return null
  const pct = (value / total) * 100
  if (pct < 0.05) return '<0.1%'
  if (pct >= 10) return `${pct.toFixed(0)}%`
  return `${pct.toFixed(1)}%`
}

const referenceDisplay = (): NodeShareDisplay => ({
  mode: 'reference',
  inShare: '기준',
  outShare: '기준',
})

const noneDisplay = (): NodeShareDisplay => ({
  mode: 'none',
  inShare: null,
  outShare: null,
})

export const buildNodeShareMap = (
  nodeIds: string[],
  selectedNodeId: string | null,
  neighborIds: Set<string>,
  edges: HubbleEdge[],
  nodeStats: Map<string, NodeTrafficStats>
): Map<string, NodeShareDisplay> => {
  const map = new Map<string, NodeShareDisplay>()

  if (!selectedNodeId) {
    for (const id of nodeIds) {
      const stats = nodeStats.get(id)
      map.set(id, {
        mode: 'global',
        inShare: null,
        outShare: null,
        inValue: nodeInValue(stats),
        outValue: nodeOutValue(stats),
      })
    }
    return map
  }

  const selectedStats = nodeStats.get(selectedNodeId)
  const selectedIn = nodeInValue(selectedStats)
  const selectedOut = nodeOutValue(selectedStats)

  // Index edges touching the selected node so per-neighbor lookup is O(1)
  // instead of O(E). Total work: O(E) to index + O(N) to consume.
  const edgesFromSelected = new Map<string, HubbleEdge>()
  const edgesToSelected = new Map<string, HubbleEdge>()
  for (const e of edges) {
    if (e.src === selectedNodeId) edgesFromSelected.set(e.dst, e)
    if (e.dst === selectedNodeId) edgesToSelected.set(e.src, e)
  }

  for (const id of nodeIds) {
    if (id === selectedNodeId) {
      map.set(id, {
        ...referenceDisplay(),
        inValue: selectedIn,
        outValue: selectedOut,
      })
      continue
    }

    if (!neighborIds.has(id)) {
      map.set(id, noneDisplay())
      continue
    }

    const edgeToSelected = edgesToSelected.get(id)
    const edgeFromSelected = edgesFromSelected.get(id)

    map.set(id, {
      mode: 'edge',
      inShare: edgeFromSelected
        ? formatTrafficShare(edgeFromSelected.flowCount, selectedOut)
        : null,
      outShare: edgeToSelected
        ? formatTrafficShare(edgeToSelected.flowCount, selectedIn)
        : null,
      inValue: edgeFromSelected ? edgeFromSelected.flowCount : 0,
      outValue: edgeToSelected ? edgeToSelected.flowCount : 0,
    })
  }

  return map
}

export const shareTooltipSuffix = (
  share: string | null,
  display: NodeShareDisplay,
  direction: 'in' | 'out'
): string => {
  if (!share) return ''
  if (share === '기준') return ' · 선택 노드(비율 기준)'

  if (display.mode === 'global') {
    const dir = direction === 'in' ? 'In' : 'Out'
    return ` · 화면 노드 전체 ${dir}의 ${share}`
  }

  if (display.mode === 'edge') {
    if (direction === 'in') {
      return ` · 숫자는 선택 노드→이 노드 flow, 선택 노드 Out의 ${share}`
    }
    return ` · 숫자는 이 노드→선택 노드 flow, 선택 노드 In의 ${share}`
  }

  return ''
}
