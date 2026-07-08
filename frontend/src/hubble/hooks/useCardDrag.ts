import {useCallback, useEffect, useRef, useState} from 'react'
import {CardPosition} from 'src/hubble/utils/cardLayout'
import {
  DragOffset,
  loadCardOffsets,
  saveCardOffset,
  clearCardOffsets,
} from 'src/hubble/utils/cardOffsetsStorage'

type DragMode =
  | {kind: 'node'; nodeId: string; origX: number; origY: number}
  | {
      kind: 'region'
      regionKey: string
      memberIds: string[]
      origPositions: Map<string, DragOffset>
    }

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
  const [draggingRegionMembers, setDraggingRegionMembers] = useState<
    Set<string> | null
  >(null)
  const [dragTick, setDragTick] = useState(0)
  const liveOffsetsRef = useRef<Map<string, DragOffset>>(new Map())
  const dragRef = useRef<{
    mode: DragMode
    startX: number
    startY: number
  } | null>(null)
  const didDragRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    // Layout changed: drop in-memory drag state but restore persisted
    // positions so user-pinned cards stay where they were put.
    setOffsets(loadCardOffsets(viewKey))
    liveOffsetsRef.current = new Map()
    setDraggingNodeId(null)
    setDraggingRegionMembers(null)
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
        mode: {kind: 'node', nodeId, origX, origY},
        startX: clientX,
        startY: clientY,
      }
      setDraggingNodeId(nodeId)
      setDraggingRegionMembers(null)
    },
    []
  )

  const startRegionDrag = useCallback(
    (
      regionKey: string,
      memberIds: Iterable<string>,
      clientX: number,
      clientY: number,
      currentPositions: Map<string, DragOffset>
    ) => {
      const origPositions = new Map<string, DragOffset>()
      for (const id of memberIds) {
        const pos = currentPositions.get(id)
        if (pos) {
          origPositions.set(id, {x: pos.x, y: pos.y})
        }
      }
      if (origPositions.size === 0) return

      didDragRef.current = false
      dragRef.current = {
        mode: {
          kind: 'region',
          regionKey,
          memberIds: Array.from(origPositions.keys()),
          origPositions,
        },
        startX: clientX,
        startY: clientY,
      }
      setDraggingNodeId(null)
      setDraggingRegionMembers(new Set(origPositions.keys()))
    },
    []
  )

  const isDragging = draggingNodeId !== null || draggingRegionMembers !== null

  useEffect(() => {
    if (!isDragging) return

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

      if (drag.mode.kind === 'node') {
        liveOffsetsRef.current.set(drag.mode.nodeId, {
          x: drag.mode.origX + dx,
          y: drag.mode.origY + dy,
        })
      } else {
        for (const [id, orig] of drag.mode.origPositions) {
          liveOffsetsRef.current.set(id, {
            x: orig.x + dx,
            y: orig.y + dy,
          })
        }
      }
      scheduleDragRender()
    }

    const onUp = () => {
      const drag = dragRef.current
      if (drag) {
        if (drag.mode.kind === 'node') {
          const live = liveOffsetsRef.current.get(drag.mode.nodeId)
          if (live) {
            setOffsets(prev => {
              const next = new Map(prev)
              next.set(drag.mode.nodeId, live)
              return next
            })
            saveCardOffset(viewKey, drag.mode.nodeId, live)
          }
        } else {
          const nextOffsets = new Map<string, DragOffset>()
          for (const id of drag.mode.memberIds) {
            const live = liveOffsetsRef.current.get(id)
            if (live) {
              nextOffsets.set(id, live)
              saveCardOffset(viewKey, id, live)
            }
          }
          if (nextOffsets.size > 0) {
            setOffsets(prev => {
              const next = new Map(prev)
              for (const [id, offset] of nextOffsets) {
                next.set(id, offset)
              }
              return next
            })
          }
        }
      }
      dragRef.current = null
      setDraggingNodeId(null)
      setDraggingRegionMembers(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [getScale, isDragging, scheduleDragRender, viewKey])

  useEffect(() => {
    if (!isDragging) return
    document.body.classList.add('hubble-is-dragging')
    return () => document.body.classList.remove('hubble-is-dragging')
  }, [isDragging])

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
    setDraggingRegionMembers(null)
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
    startRegionDrag,
    draggingNodeId,
    draggingRegionMembers,
    consumeDidDrag,
    resetOffsets,
  }
}
