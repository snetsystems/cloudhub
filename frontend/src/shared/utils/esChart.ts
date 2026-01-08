import {Plugin} from 'chart.js'

interface SelectEvt {
  gte: number
  lte: number
  indices: number[]
}
interface Opts {
  threshold?: number
  onSelect?: (r: SelectEvt) => void
  onDragStart?: () => void
  onDragEnd?: () => void
}

declare module 'chart.js' {
  interface Chart {
    _sel?: {start?: number; end?: number; active?: boolean}
    _detachSel?: () => void
  }
}

export const stableSelectionPlugin: Plugin<'bar'> = {
  id: 'stable-selection',

  afterLayout(chart, _args, raw) {
    const opts = (raw as unknown) as Opts
    if (chart._detachSel) return

    const THR = opts.threshold ?? 6
    const state = (chart._sel = {
      start: undefined,
      end: undefined,
      active: false as boolean,
    })

    const {canvas} = chart

    function onDown(e: MouseEvent) {
      state.start = e.offsetX
      state.end = e.offsetX
      state.active = false
      opts.onDragStart?.()
    }

    function onMove(e: MouseEvent) {
      if (state.start == null) return

      // 마우스가 chart 영역을 벗어났는지 확인
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left

      // chart 영역을 벗어나면 드래그 상태 초기화
      if (mouseX < 0 || mouseX > rect.width) {
        state.start = state.end = undefined
        state.active = false
        chart.update('none')
        return
      }

      state.end = mouseX
      if (!state.active && Math.abs(state.end - state.start) > THR)
        state.active = true
      chart.update('none')
    }

    function onUp() {
      if (state.active && state.start != null && state.end != null) {
        const [aPx, bPx] = [state.start, state.end].sort((p, q) => p - q)
        const scaleX = chart.scales.x
        const gte = scaleX.getValueForPixel(aPx) as number
        const lte = scaleX.getValueForPixel(bPx) as number

        const hit: number[] = []

        for (let i = gte; i <= lte; i++) {
          hit.push(i)
        }

        opts.onSelect?.({indices: hit, gte, lte})
      }

      if (state.active && state.start != null && state.end != null) {
        opts.onDragEnd?.()
      }

      state.start = state.end = undefined
      state.active = false
      chart.update('none')
    }

    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)

    chart._detachSel = () => {
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  },

  afterDraw(chart) {
    const s = chart._sel
    if (!s?.active || s.start == null || s.end == null) return

    const {
      ctx,
      chartArea: {top, bottom},
    } = chart
    ctx.save()
    ctx.fillStyle = 'rgba(0,123,255,0.18)'
    ctx.fillRect(s.start, top, s.end - s.start, bottom - top)
    ctx.restore()
  },

  beforeDestroy(chart) {
    chart._detachSel?.()
  },
}
