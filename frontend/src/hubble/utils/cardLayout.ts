import {HubbleNode} from 'src/hubble/types'
import {NodeTrafficStats} from 'src/hubble/utils/nodeStats'

export const CARD_WIDTH = 176
export const CARD_BASE_HEIGHT = 102
export const CARD_INTERNAL_EXTRA = 20
export const CARD_ACTIONS_HEIGHT = 30
export const CARD_DIRECTION_ROWS_HEIGHT = 44
export const CARD_PORTS_HEIGHT = 22
export const CARD_LABELS_HEIGHT = 28
export const CARD_METRIC_SHARE_HEIGHT = 12
export const COL_GAP = 200
export const ROW_GAP = 24
export const GRID_GAP = 32
export const CANVAS_PADDING = 48
export const CANVAS_EXTRA_BOTTOM = 40
export const COLUMN_LABEL_HEIGHT = 28

export interface CardPosition {
  id: string
  x: number
  y: number
  column: number
  height: number
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

export const columnSlotX = (column: number): number =>
  CANVAS_PADDING + column * (CARD_WIDTH + COL_GAP)

export const cardHeightForNode = (
  node: HubbleNode,
  stats: NodeTrafficStats | undefined
): number => {
  const hasInternal = stats && stats.internalFlows > 0
  const hasPorts = (node.topPorts?.length ?? 0) > 0
  const hasLabels = (node.labels?.length ?? 0) > 0

  return (
    CARD_BASE_HEIGHT +
    CARD_METRIC_SHARE_HEIGHT +
    CARD_DIRECTION_ROWS_HEIGHT +
    (hasPorts ? CARD_PORTS_HEIGHT : 0) +
    (hasLabels ? CARD_LABELS_HEIGHT : 0) +
    (hasInternal ? CARD_INTERNAL_EXTRA : 0) +
    CARD_ACTIONS_HEIGHT
  )
}

const defaultCardHeight = (): number => CARD_BASE_HEIGHT + CARD_ACTIONS_HEIGHT

const gridColsForCount = (count: number): number => {
  if (count <= 1) return 1
  if (count <= 4) return 2
  return 3
}

const layoutColumnStack = (
  col: number,
  nodes: HubbleNode[],
  cardHeights: Map<string, number>
): CardPosition[] => {
  const baseX = columnSlotX(col)
  const startY = CANVAS_PADDING + COLUMN_LABEL_HEIGHT

  if (col === 1 && nodes.length > 1) {
    const gridCols = gridColsForCount(nodes.length)
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

    return positions
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
  cardHeights: Map<string, number>
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

  const columnStacks = [0, 1, 2]
    .filter(c => (byColumn.get(c)?.length ?? 0) > 0)
    .map(col => ({
      col,
      positions: layoutColumnStack(col, byColumn.get(col) || [], cardHeights),
    }))

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
  const emptyHeight = CANVAS_PADDING * 2 + CARD_BASE_HEIGHT + CANVAS_EXTRA_BOTTOM

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
