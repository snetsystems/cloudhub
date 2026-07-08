import {HubbleNode} from 'src/hubble/types'
import {NodeTrafficStats} from 'src/hubble/utils/nodeStats'

export const CARD_WIDTH = 176
export const CARD_BASE_HEIGHT = 112
export const CARD_PORTS_HEIGHT = 22
export const CARD_DROP_HEIGHT = 22
// External-IP preview on the "Unknown External" card: block margin plus one
// compact mono row per IP (backend sends at most 3).
export const CARD_EXTERNAL_IPS_BLOCK = 6
export const CARD_EXTERNAL_IP_ROW = 14
export const COL_GAP = 120
export const ROW_GAP = 24
export const GRID_GAP = 32
export const CANVAS_PADDING = 48
export const CANVAS_EXTRA_BOTTOM = 40
export const COLUMN_LABEL_HEIGHT = 48
export const NAMESPACE_REGION_SIDE_PADDING = 24
export const NAMESPACE_REGION_TOP_PADDING = 52
export const NAMESPACE_REGION_BOTTOM_PADDING = 24
export const NAMESPACE_GROUP_GAP = 32

export interface CardPosition {
  id: string
  x: number
  y: number
  column: number
  height: number
}

export interface NamespaceRegion {
  x: number
  y: number
  width: number
  height: number
  memberCount: number
}

export interface MapRegionNodeIds {
  external: Set<string>
  applications: Set<string>
  system: Set<string>
}

export const partitionMapRegionNodeIds = (
  nodes: HubbleNode[]
): MapRegionNodeIds => {
  const external = new Set<string>()
  const applications = new Set<string>()
  const system = new Set<string>()

  for (const node of nodes) {
    if (node.kind === 'external') {
      external.add(node.id)
    } else if (node.system) {
      system.add(node.id)
    } else {
      applications.add(node.id)
    }
  }

  return {external, applications, system}
}

// RegionPadding adds extra room on top of the base namespace-region padding.
// Used to make an outer region (Applications) visibly wrap an inner region
// (the drilldown Namespace) instead of sharing the same bounds and colliding
// headers.
export interface RegionPadding {
  top?: number
  side?: number
  bottom?: number
}

export const computeNamespaceRegion = (
  positions: CardPosition[],
  memberIds: ReadonlySet<string>,
  extra?: RegionPadding
): NamespaceRegion | null => {
  const members = positions.filter(position => memberIds.has(position.id))
  if (members.length === 0) return null

  const topPadding = NAMESPACE_REGION_TOP_PADDING + (extra?.top ?? 0)
  const sidePadding = NAMESPACE_REGION_SIDE_PADDING + (extra?.side ?? 0)
  const bottomPadding = NAMESPACE_REGION_BOTTOM_PADDING + (extra?.bottom ?? 0)

  const minX = Math.min(...members.map(position => position.x))
  const minY = Math.min(...members.map(position => position.y))
  const maxX = Math.max(...members.map(position => position.x + CARD_WIDTH))
  const maxY = Math.max(
    ...members.map(position => position.y + position.height)
  )

  return {
    x: minX - sidePadding,
    y: minY - topPadding,
    width: maxX - minX + sidePadding * 2,
    height: maxY - minY + topPadding + bottomPadding,
    memberCount: members.length,
  }
}

const columnForNode = (node: HubbleNode): number => {
  if (node.kind === 'external') return 0
  if (node.system) return 2
  return 1
}

const columnLabel = (column: number): string => {
  switch (column) {
    case 0:
      return 'External'
    case 2:
      return 'System'
    default:
      return 'Applications'
  }
}

// The "Open namespace" action renders as a bottom overlay only while the
// card is selected, so no height is reserved for it here.
export const cardHeightForNode = (
  node: HubbleNode,
  stats: NodeTrafficStats | undefined
): number => {
  const portRows =
    ((node.topInPorts?.length ?? 0) > 0 ? 1 : 0) +
    ((node.topOutPorts?.length ?? 0) > 0 ? 1 : 0)
  // The Ingress/Egress drop breakdown row only renders when both directions
  // have drops (a single direction would just repeat the "Dropped N" header
  // badge) — see HubbleNodeCard.tsx. Height reservation must match that.
  const hasDrops =
    (stats?.ingressDeniedFlows ?? 0) > 0 && (stats?.egressDeniedFlows ?? 0) > 0
  const externalIPCount = node.topExternalIPs?.length ?? 0

  return (
    CARD_BASE_HEIGHT +
    portRows * CARD_PORTS_HEIGHT +
    (hasDrops ? CARD_DROP_HEIGHT : 0) +
    (externalIPCount > 0
      ? CARD_EXTERNAL_IPS_BLOCK + externalIPCount * CARD_EXTERNAL_IP_ROW
      : 0)
  )
}

const defaultCardHeight = (): number => CARD_BASE_HEIGHT

// gridColsForCount scales grid width with the node count (~sqrt) so large
// sets spread horizontally instead of forming a narrow, tall column that
// wastes viewport width after fit-to-screen. Capped to keep rows readable.
const MAX_GRID_COLS = 6

const gridColsForCount = (count: number): number => {
  if (count <= 1) return 1
  return Math.min(MAX_GRID_COLS, Math.ceil(Math.sqrt(count)))
}

const layoutGridBlock = (
  col: number,
  baseX: number,
  nodes: HubbleNode[],
  cardHeights: Map<string, number>,
  startY: number,
  gridColsOverride?: number | null
): {positions: CardPosition[]; endY: number} => {
  const gridCols =
    gridColsOverride && gridColsOverride > 0
      ? Math.min(gridColsOverride, Math.max(1, nodes.length))
      : gridColsForCount(nodes.length)
  const positions: CardPosition[] = []
  let y = startY

  for (let i = 0; i < nodes.length; i += gridCols) {
    const rowNodes = nodes.slice(i, i + gridCols)
    let rowHeight = defaultCardHeight()

    for (const node of rowNodes) {
      rowHeight = Math.max(rowHeight, cardHeights.get(node.id) || rowHeight)
    }

    rowNodes.forEach((node, gridCol) => {
      const height = cardHeights.get(node.id) || defaultCardHeight()
      positions.push({
        id: node.id,
        column: col,
        x: baseX + gridCol * (CARD_WIDTH + GRID_GAP),
        y,
        height,
      })
    })

    y += rowHeight + ROW_GAP
  }

  return {positions, endY: y}
}

const layoutColumnStack = (
  col: number,
  baseX: number,
  nodes: HubbleNode[],
  cardHeights: Map<string, number>,
  focusNodeIds?: ReadonlySet<string>,
  gridColsOverride?: number | null
): CardPosition[] => {
  const startY = CANVAS_PADDING + COLUMN_LABEL_HEIGHT

  if (col === 1 && nodes.length > 1) {
    const focusNodes = focusNodeIds
      ? nodes.filter(node => focusNodeIds.has(node.id))
      : []
    const foreignNodes = focusNodeIds
      ? nodes.filter(node => !focusNodeIds.has(node.id))
      : []

    if (focusNodes.length > 0 && foreignNodes.length > 0) {
      const focusBlock = layoutGridBlock(
        col,
        baseX,
        focusNodes,
        cardHeights,
        startY,
        gridColsOverride
      )
      const foreignBlock = layoutGridBlock(
        col,
        baseX,
        foreignNodes,
        cardHeights,
        focusBlock.endY + NAMESPACE_GROUP_GAP,
        gridColsOverride
      )
      return [...focusBlock.positions, ...foreignBlock.positions]
    }

    return layoutGridBlock(
      col,
      baseX,
      nodes,
      cardHeights,
      startY,
      gridColsOverride
    ).positions
  }

  let y = startY
  return nodes.map(node => {
    const height = cardHeights.get(node.id) || defaultCardHeight()
    const pos: CardPosition = {
      id: node.id,
      column: col,
      x: baseX,
      y,
      height,
    }
    y += height + ROW_GAP
    return pos
  })
}

export const layoutCards = (
  nodes: HubbleNode[],
  cardHeights: Map<string, number>,
  focusNodeIds?: ReadonlySet<string>,
  // Viewport width/height ratio. When provided, the applications grid width
  // is chosen so the fitted content fills the screen best — up to a single
  // row per block when the viewport is wide enough.
  viewportAspect?: number | null
): CardPosition[] => {
  const byColumn = new Map<number, HubbleNode[]>()

  for (const node of nodes) {
    const col = columnForNode(node)
    const list = byColumn.get(col) || []
    list.push(node)
    byColumn.set(col, list)
  }

  for (const list of byColumn.values()) {
    list.sort((a, b) =>
      (a.name || a.label || a.id).localeCompare(b.name || b.label || b.id)
    )
  }

  const appCount = byColumn.get(1)?.length ?? 0
  if (!viewportAspect || viewportAspect <= 0 || appCount <= 1) {
    return assembleColumns(byColumn, cardHeights, focusNodeIds, null)
  }

  // Try every grid width for the applications column and keep the one whose
  // fitted scale — min(viewportW/contentW, viewportH/contentH) — is largest.
  // Ties resolve to the wider grid (closer to one row).
  let best: CardPosition[] = []
  let bestScore = -Infinity
  const maxGridCols = Math.min(appCount, MAX_GRID_COLS)
  for (let cols = 1; cols <= maxGridCols; cols++) {
    const candidate = assembleColumns(byColumn, cardHeights, focusNodeIds, cols)
    const bounds = computeContentBounds(candidate)
    const score = Math.min(viewportAspect / bounds.width, 1 / bounds.height)
    if (score >= bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best
}

// assembleColumns runs the full column layout (placement + vertical
// centering) for one applications-grid width. Extracted so layoutCards can
// evaluate several candidate widths against the viewport.
const assembleColumns = (
  byColumn: Map<number, HubbleNode[]>,
  cardHeights: Map<string, number>,
  focusNodeIds: ReadonlySet<string> | undefined,
  gridColsOverride: number | null
): CardPosition[] => {
  // Columns are placed left-to-right, each starting after the previous
  // column's widest card. Fixed slots would overlap: the applications grid
  // can grow several cards wide, wider than one slot.
  let nextX = CANVAS_PADDING
  const columnStacks = [0, 1, 2]
    .filter(c => (byColumn.get(c)?.length ?? 0) > 0)
    .map(col => {
      const baseX = nextX
      const stackPositions = layoutColumnStack(
        col,
        baseX,
        byColumn.get(col) || [],
        cardHeights,
        focusNodeIds,
        col === 1 ? gridColsOverride : null
      )
      const rightEdge = stackPositions.length
        ? Math.max(...stackPositions.map(p => p.x + CARD_WIDTH))
        : baseX
      nextX = rightEdge + COL_GAP
      return {col, positions: stackPositions}
    })

  const stackHeights = columnStacks.map(s => {
    if (s.positions.length === 0) return 0
    return Math.max(
      ...s.positions.map(
        p => p.y + p.height - (CANVAS_PADDING + COLUMN_LABEL_HEIGHT)
      )
    )
  })

  const maxStackHeight = Math.max(0, ...stackHeights)
  const positions: CardPosition[] = []

  for (const stack of columnStacks) {
    const stackHeight =
      stack.positions.length === 0
        ? 0
        : Math.max(
            ...stack.positions.map(
              p => p.y + p.height - (CANVAS_PADDING + COLUMN_LABEL_HEIGHT)
            )
          )
    const offsetY = (maxStackHeight - stackHeight) / 2

    for (const p of stack.positions) {
      positions.push({...p, y: p.y + offsetY})
    }
  }

  return positions
}

export const canvasSize = (
  positions: CardPosition[]
): {width: number; height: number} => {
  const bounds = computeContentBounds(positions)
  return {width: bounds.width, height: bounds.height}
}

export interface ContentBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
  offsetX: number
  offsetY: number
}

export const computeContentBounds = (
  positions: CardPosition[]
): ContentBounds => {
  const emptyWidth = CANVAS_PADDING * 2 + CARD_WIDTH
  const emptyHeight =
    CANVAS_PADDING * 2 + CARD_BASE_HEIGHT + CANVAS_EXTRA_BOTTOM

  if (positions.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: emptyWidth,
      maxY: emptyHeight,
      width: emptyWidth,
      height: emptyHeight,
      offsetX: CANVAS_PADDING,
      offsetY: CANVAS_PADDING,
    }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const p of positions) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x + CARD_WIDTH)
    maxY = Math.max(maxY, p.y + p.height)
  }

  const width = maxX - minX + CANVAS_PADDING * 2
  const height = maxY - minY + CANVAS_PADDING * 2 + CANVAS_EXTRA_BOTTOM

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    offsetX: CANVAS_PADDING - minX,
    offsetY: CANVAS_PADDING - minY,
  }
}

export const expandContentBounds = (
  prev: ContentBounds | null,
  current: ContentBounds
): ContentBounds => {
  if (!prev) {
    return current
  }

  const minX = Math.min(prev.minX, current.minX)
  const minY = Math.min(prev.minY, current.minY)
  const maxX = Math.max(prev.maxX, current.maxX)
  const maxY = Math.max(prev.maxY, current.maxY)
  const width = maxX - minX + CANVAS_PADDING * 2
  const height = maxY - minY + CANVAS_PADDING * 2 + CANVAS_EXTRA_BOTTOM

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    offsetX: CANVAS_PADDING - minX,
    offsetY: CANVAS_PADDING - minY,
  }
}

export const toRenderPosition = (
  position: CardPosition,
  bounds: ContentBounds
): CardPosition => ({
  ...position,
  x: position.x - bounds.minX + CANVAS_PADDING,
  y: position.y - bounds.minY + CANVAS_PADDING,
})

export {columnLabel, columnForNode}
