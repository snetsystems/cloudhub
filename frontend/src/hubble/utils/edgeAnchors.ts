import {HubbleEdge} from 'src/hubble/types'
import {CARD_WIDTH, CardPosition} from 'src/hubble/utils/cardLayout'

export interface Anchor {
  x: number
  y: number
}

export interface EdgeAnchors {
  from: Anchor
  to: Anchor
}

const spreadAlongEdge = (
  index: number,
  count: number,
  top: number,
  height: number
): number => {
  const margin = 18
  if (count <= 1) {
    return top + height / 2
  }
  const usable = Math.max(8, height - margin * 2)
  return top + margin + (usable * index) / (count - 1)
}

export const computeEdgeAnchors = (
  edges: HubbleEdge[],
  positionById: Map<string, CardPosition>
): Map<string, EdgeAnchors> => {
  const result = new Map<string, EdgeAnchors>()
  const edgeKey = (src: string, dst: string) => `${src}|${dst}`

  const bySource = new Map<string, HubbleEdge[]>()
  const byTarget = new Map<string, HubbleEdge[]>()

  for (const edge of edges) {
    const sk = edge.src
    const tk = edge.dst
    if (!bySource.has(sk)) bySource.set(sk, [])
    if (!byTarget.has(tk)) byTarget.set(tk, [])
    bySource.get(sk)!.push(edge)
    byTarget.get(tk)!.push(edge)
  }

  const sourceIndex = new Map<string, number>()
  const targetIndex = new Map<string, number>()

  for (const list of bySource.values()) {
    list.sort((a, b) => a.dst.localeCompare(b.dst))
    list.forEach((e, i) => sourceIndex.set(edgeKey(e.src, e.dst), i))
  }
  for (const list of byTarget.values()) {
    list.sort((a, b) => a.src.localeCompare(b.src))
    list.forEach((e, i) => targetIndex.set(edgeKey(e.src, e.dst), i))
  }

  for (const edge of edges) {
    const key = edgeKey(edge.src, edge.dst)
    const srcPos = positionById.get(edge.src)
    const dstPos = positionById.get(edge.dst)
    if (!srcPos || !dstPos) continue

    const srcList = bySource.get(edge.src) || []
    const dstList = byTarget.get(edge.dst) || []
    const srcIdx = sourceIndex.get(key) ?? 0
    const dstIdx = targetIndex.get(key) ?? 0

    const srcY = spreadAlongEdge(srcIdx, srcList.length, srcPos.y, srcPos.height)
    const dstY = spreadAlongEdge(dstIdx, dstList.length, dstPos.y, dstPos.height)

    const srcCenterX = srcPos.x + CARD_WIDTH / 2
    const dstCenterX = dstPos.x + CARD_WIDTH / 2
    const horizontalSep = Math.abs(dstCenterX - srcCenterX)

    if (horizontalSep > CARD_WIDTH * 0.75) {
      if (dstCenterX > srcCenterX) {
        result.set(key, {
          from: {x: srcPos.x + CARD_WIDTH, y: srcY},
          to: {x: dstPos.x, y: dstY},
        })
      } else {
        result.set(key, {
          from: {x: srcPos.x, y: srcY},
          to: {x: dstPos.x + CARD_WIDTH, y: dstY},
        })
      }
    } else {
      // Cards overlap horizontally. Compare vertical centers, but apply a
      // deadband so a 1px drag doesn't flip the anchor top↔bottom. Inside
      // the deadband we fall back to side anchors (chosen by the smaller
      // horizontal gap) which behave continuously as the cards move.
      const srcCenterY = srcPos.y + srcPos.height / 2
      const dstCenterY = dstPos.y + dstPos.height / 2
      const verticalDelta = dstCenterY - srcCenterY
      const HYSTERESIS_PX = 24

      if (verticalDelta > HYSTERESIS_PX) {
        result.set(key, {
          from: {x: srcPos.x + CARD_WIDTH / 2, y: srcPos.y + srcPos.height},
          to: {x: dstPos.x + CARD_WIDTH / 2, y: dstPos.y},
        })
      } else if (verticalDelta < -HYSTERESIS_PX) {
        result.set(key, {
          from: {x: srcPos.x + CARD_WIDTH / 2, y: srcPos.y},
          to: {x: dstPos.x + CARD_WIDTH / 2, y: dstPos.y + dstPos.height},
        })
      } else if (dstCenterX >= srcCenterX) {
        result.set(key, {
          from: {x: srcPos.x + CARD_WIDTH, y: srcY},
          to: {x: dstPos.x, y: dstY},
        })
      } else {
        result.set(key, {
          from: {x: srcPos.x, y: srcY},
          to: {x: dstPos.x + CARD_WIDTH, y: dstY},
        })
      }
    }
  }

  return result
}

export const buildEdgePath = (from: Anchor, to: Anchor): string => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const curve = Math.min(120, Math.abs(dx) * 0.35 + Math.abs(dy) * 0.08)
  const cx = from.x + dx * 0.5
  const cy = from.y + dy * 0.5 - curve * Math.sign(dx || 1)
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`
}
