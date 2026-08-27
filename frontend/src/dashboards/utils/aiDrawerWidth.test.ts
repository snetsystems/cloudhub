import {
  clampDrawerWidth,
  MIN_MAIN_WIDTH,
  MIN_WIDTH,
  SIDE_NAV_WIDTH,
} from 'src/dashboards/utils/aiDrawerWidth'

const withViewport = (innerWidth: number, run: () => void) => {
  const original = window.innerWidth
  Object.defineProperty(window, 'innerWidth', {
    value: innerWidth,
    configurable: true,
    writable: true,
  })
  try {
    run()
  } finally {
    Object.defineProperty(window, 'innerWidth', {
      value: original,
      configurable: true,
      writable: true,
    })
  }
}

describe('AI drawer width', () => {
  it('never goes narrower than the chat can render', () => {
    // Below MIN_WIDTH the chat's own min-widths stop shrinking, so it overflows
    // the drawer onto the page beside it instead of getting smaller.
    withViewport(1600, () => {
      expect(clampDrawerWidth(100)).toBe(MIN_WIDTH)
      expect(clampDrawerWidth(MIN_WIDTH - 1)).toBe(MIN_WIDTH)
    })
  })

  it('leaves the page its minimum rather than forcing the drawer minimum', () => {
    // A viewport too small to satisfy both: the page wins, and the drawer takes
    // what is left instead of overrunning it.
    withViewport(600, () => {
      const width = clampDrawerWidth(MIN_WIDTH)
      expect(width).toBeLessThan(MIN_WIDTH)
      expect(600 - SIDE_NAV_WIDTH - width).toBeGreaterThanOrEqual(MIN_MAIN_WIDTH)
    })
  })

  it('keeps the requested width when the viewport can afford it', () => {
    withViewport(1600, () => {
      expect(clampDrawerWidth(520)).toBe(520)
    })
  })

  it('caps at 70% of the page so the main content is never a sliver', () => {
    withViewport(1600, () => {
      const pageWidth = 1600 - SIDE_NAV_WIDTH
      expect(clampDrawerWidth(99999)).toBe(Math.floor(pageWidth * 0.7))
    })
  })

  describe('a page that needs more room than the default', () => {
    it('stops the drawer before the page drops below its own minimum', () => {
      withViewport(1600, () => {
        const pageWidth = 1600 - SIDE_NAV_WIDTH
        const pageMinimum = 720

        // The 70% cap alone would leave the page far under its minimum.
        expect(clampDrawerWidth(99999)).toBeGreaterThan(pageWidth - pageMinimum)

        const width = clampDrawerWidth(99999, pageMinimum)
        expect(pageWidth - width).toBeGreaterThanOrEqual(pageMinimum)
      })
    })

    it('still honours the 70% cap when that is the tighter limit', () => {
      withViewport(3000, () => {
        const pageWidth = 3000 - SIDE_NAV_WIDTH
        expect(clampDrawerWidth(99999, 720)).toBe(Math.floor(pageWidth * 0.7))
      })
    })

    it('leaves other pages on the default minimum', () => {
      withViewport(1600, () => {
        expect(clampDrawerWidth(99999)).not.toBe(clampDrawerWidth(99999, 720))
      })
    })
  })
})
