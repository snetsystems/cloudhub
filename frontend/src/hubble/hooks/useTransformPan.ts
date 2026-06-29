import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react'

export interface PanOffset {
  x: number
  y: number
}

const wheelCaptureOptions: AddEventListenerOptions = {
  passive: false,
  capture: true,
}

const MIN_ZOOM = 0.25
const MAX_ZOOM = 2.5

const normalizeWheelDelta = (
  e: WheelEvent,
  viewportHeight: number
): {dx: number; dy: number} => {
  let dx = e.deltaX
  let dy = e.deltaY

  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    dx *= 16
    dy *= 16
  } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    dx *= viewportHeight
    dy *= viewportHeight
  }

  return {dx, dy}
}

export const useTransformPan = (enabled: boolean) => {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const panRef = useRef<PanOffset>({x: 0, y: 0})
  const scaleRef = useRef(1)
  const [pan, setPanState] = useState<PanOffset>({x: 0, y: 0})
  const [scale, setScaleState] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const panDragRef = useRef<{
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)
  const didPanRef = useRef(false)

  const setPan = useCallback((next: PanOffset | ((prev: PanOffset) => PanOffset)) => {
    setPanState(prev => {
      const value = typeof next === 'function' ? next(prev) : next
      panRef.current = value
      return value
    })
  }, [])

  const setScale = useCallback((next: number) => {
    scaleRef.current = next
    setScaleState(next)
  }, [])

  const onWheel = useCallback(
    (e: WheelEvent) => {
      const el = viewportRef.current
      if (!el || !enabled) return

      e.preventDefault()
      e.stopPropagation()

      const {dy} = normalizeWheelDelta(e, el.clientHeight)
      if (dy === 0) return

      const rect = el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const currentScale = scaleRef.current
      const currentPan = panRef.current
      const zoomFactor = Math.exp(-dy * 0.001)
      const nextScale = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, currentScale * zoomFactor)
      )

      const worldX = (mouseX - currentPan.x) / currentScale
      const worldY = (mouseY - currentPan.y) / currentScale

      setScale(nextScale)
      setPan({
        x: mouseX - worldX * nextScale,
        y: mouseY - worldY * nextScale,
      })
    },
    [enabled, setPan, setScale]
  )

  const attachWheel = useCallback(
    (el: HTMLDivElement | null) => {
      const prev = viewportRef.current
      if (prev) {
        prev.removeEventListener('wheel', onWheel, wheelCaptureOptions)
      }

      viewportRef.current = el

      if (el && enabled) {
        el.addEventListener('wheel', onWheel, wheelCaptureOptions)
      }
    },
    [enabled, onWheel]
  )

  // Re-bind when enabled/onWheel changes while the node is already mounted.
  useLayoutEffect(() => {
    attachWheel(viewportRef.current)
  }, [attachWheel])

  const setViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      attachWheel(node)
    },
    [attachWheel]
  )

  const canStartPan = useCallback(
    (target: EventTarget | null, button: number, shiftKey: boolean): boolean => {
      if (!(target instanceof HTMLElement)) return false
      if (button !== 0 && button !== 1) return false
      if (target.closest('button')) return false
      if (target.closest('.hubble-node-card-grip')) return false
      if (button === 1 || shiftKey) return true
      if (target.closest('.hubble-node-card-body')) return false
      if (target.closest('.hubble-node-card-action')) return false
      return true
    },
    []
  )

  const beginPan = useCallback((clientX: number, clientY: number) => {
    didPanRef.current = false
    panDragRef.current = {
      startX: clientX,
      startY: clientY,
      origX: panRef.current.x,
      origY: panRef.current.y,
    }
    setIsPanning(true)
  }, [])

  const handleMouseDownCapture = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return
      if (!canStartPan(e.target, e.button, e.shiftKey)) return
      e.preventDefault()
      e.stopPropagation()
      beginPan(e.clientX, e.clientY)
    },
    [beginPan, canStartPan, enabled]
  )

  useEffect(() => {
    if (!isPanning) return

    const onMove = (e: MouseEvent) => {
      e.preventDefault()
      const drag = panDragRef.current
      if (!drag) return

      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didPanRef.current = true
      }

      setPan({
        x: drag.origX + dx,
        y: drag.origY + dy,
      })
    }

    const onUp = () => {
      panDragRef.current = null
      setIsPanning(false)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isPanning, setPan])

  useEffect(() => {
    if (!isPanning) return
    document.body.classList.add('hubble-is-panning')
    return () => document.body.classList.remove('hubble-is-panning')
  }, [isPanning])

  const consumeDidPan = useCallback(() => {
    const moved = didPanRef.current
    didPanRef.current = false
    return moved
  }, [])

  const centerOnContent = useCallback(
    (contentWidth: number, contentHeight: number) => {
      const el = viewportRef.current
      if (!el) {
        setPan({x: 0, y: 0})
        setScale(1)
        return
      }
      setScale(1)
      setPan({
        x: (el.clientWidth - contentWidth) / 2,
        y: (el.clientHeight - contentHeight) / 2,
      })
    },
    [setPan, setScale]
  )

  const fitContentTop = useCallback(
    (contentWidth: number, _contentHeight: number) => {
      const el = viewportRef.current
      if (!el) {
        setPan({x: 0, y: 0})
        setScale(1)
        return
      }
      setScale(1)
      setPan({
        x: Math.max(0, (el.clientWidth - contentWidth) / 2),
        y: 16,
      })
    },
    [setPan, setScale]
  )

  const fitToViewport = useCallback(
    (contentWidth: number, contentHeight: number) => {
      const el = viewportRef.current
      if (!el) {
        setPan({x: 0, y: 0})
        setScale(1)
        return
      }

      const pad = 12
      const availW = Math.max(1, el.clientWidth - pad * 2)
      const availH = Math.max(1, el.clientHeight - pad * 2)

      // Viewport hasn't been laid out yet (e.g. mounted inside a Threesizer
      // before the parent has assigned a height). Reading clientHeight at
      // this point would clamp the scale to the 0.35 minimum and freeze
      // the graph as a tiny dot. Retry on the next frame instead — by then
      // the layout has settled and the real dimensions are available.
      if (el.clientWidth < 50 || el.clientHeight < 50) {
        globalThis.requestAnimationFrame(() => {
          fitToViewport(contentWidth, contentHeight)
        })
        return
      }

      const scaleX = availW / contentWidth
      const scaleY = availH / contentHeight
      const nextScale = Math.max(0.35, Math.min(scaleX, scaleY, 1.25))
      const scaledW = contentWidth * nextScale
      const scaledH = contentHeight * nextScale

      setScale(nextScale)
      setPan({
        x: pad + (availW - scaledW) / 2,
        y: pad + (availH - scaledH) / 2,
      })
    },
    [setPan, setScale]
  )

  const getScale = useCallback(() => scaleRef.current, [])

  return {
    setViewportRef,
    pan,
    scale,
    getScale,
    handleMouseDownCapture,
    isPanning,
    consumeDidPan,
    centerOnContent,
    fitContentTop,
    fitToViewport,
  }
}
