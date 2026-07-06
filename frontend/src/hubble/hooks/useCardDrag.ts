import {useCallback, useEffect, useRef, useState} from 'react'
import {CardPosition} from 'src/hubble/utils/cardLayout'
import {
  DragOffset,
  loadCardOffsets,
  saveCardOffset,
  clearCardOffsets,
} from 'src/hubble/utils/cardOffsetsStorage'

// viewKey identifies which map the offsets belong to ('overview' or the
// drilldown namespace); dragged positions are persisted per view so a
// hand-arranged map survives reloads.
export const useCardDrag = (
  layoutKey: string,
  getScale: () => number,
  viewKey: string
) => {
  const [offsets, setOffsets] = useState<Map<string, DragOffset>>(() =>
    loadCardOffsets(viewKey)
  )
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [dragTick, setDragTick] = useState(0)
  const liveOffsetsRef = useRef<Map<string, DragOffset>>(new Map())
  const dragRef = useRef<{
    nodeId: string
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)
  const didDragRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    // Layout changed: drop in-memory drag state but restore persisted
    // positions so user-pinned cards stay where they were put.
    setOffsets(loadCardOffsets(viewKey))
    liveOffsetsRef.current = new Map()
    setDraggingNodeId(null)
    setDragTick(0)
    dragRef.current = null
    didDragRef.current = false
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [layoutKey, viewKey])

  const applyPositions = useCallback(
    (base: CardPosition[]): CardPosition[] =>
      base.map(p => {
        const o = liveOffsetsRef.current.get(p.id) ?? offsets.get(p.id)
        return o ? {...p, x: o.x, y: o.y} : p
      }),
    [offsets, dragTick]
  )

  const scheduleDragRender = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      setDragTick(t => t + 1)
    })
  }, [])

  const startDrag = useCallback(
    (
      nodeId: string,
      clientX: number,
      clientY: number,
      origX: number,
      origY: number
    ) => {
      didDragRef.current = false
      dragRef.current = {
        nodeId,
        startX: clientX,
        startY: clientY,
        origX,
        origY,
      }
      setDraggingNodeId(nodeId)
    },
    []
  )

  useEffect(() => {
    if (!draggingNodeId) return

    const onMove = (e: MouseEvent) => {
      e.preventDefault()
      const drag = dragRef.current
      if (!drag) return

      const scale = Math.max(getScale(), 0.001)
      const dx = (e.clientX - drag.startX) / scale
      const dy = (e.clientY - drag.startY) / scale
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didDragRef.current = true
      }

      liveOffsetsRef.current.set(drag.nodeId, {
        x: drag.origX + dx,
        y: drag.origY + dy,
      })
      scheduleDragRender()
    }

    const onUp = () => {
      const drag = dragRef.current
      if (drag) {
        const live = liveOffsetsRef.current.get(drag.nodeId)
        if (live) {
          setOffsets(prev => {
            const next = new Map(prev)
            next.set(drag.nodeId, live)
            return next
          })
          saveCardOffset(viewKey, drag.nodeId, live)
        }
      }
      dragRef.current = null
      setDraggingNodeId(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draggingNodeId, getScale, scheduleDragRender, viewKey])

  useEffect(() => {
    if (!draggingNodeId) return
    document.body.classList.add('hubble-is-dragging')
    return () => document.body.classList.remove('hubble-is-dragging')
  }, [draggingNodeId])

  const consumeDidDrag = useCallback(() => {
    const moved = didDragRef.current
    didDragRef.current = false
    return moved
  }, [])

  const resetOffsets = useCallback(() => {
    clearCardOffsets(viewKey)
    setOffsets(new Map())
    liveOffsetsRef.current = new Map()
    setDraggingNodeId(null)
    setDragTick(0)
    dragRef.current = null
    didDragRef.current = false
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [viewKey])

  return {
    applyPositions,
    startDrag,
    draggingNodeId,
    consumeDidDrag,
    resetOffsets,
  }
}
