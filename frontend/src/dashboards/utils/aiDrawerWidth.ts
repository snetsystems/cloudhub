/**
 * Geometry for the AI chat drawer.
 *
 * Kept apart from the component so the rules can be read and tested on their
 * own: they encode a contract with the chat's stylesheet, and getting them
 * wrong makes the chat overflow onto the page beside it rather than shrink.
 */

export const DEFAULT_WIDTH = 480

/**
 * The chat cannot render narrower than this: .chat-sidebar collapsed (48) plus
 * .chat-thread-container (420) in CloudhubAiChatStandalone.scss, both hard
 * min-widths. Allowing a narrower drawer does not shrink the chat, it makes it
 * overflow onto whatever sits beside it.
 */
export const MIN_WIDTH = 468

/**
 * Width the page under the drawer keeps for itself, by default.
 *
 * A page with a denser layout owns its own figure and passes it through
 * DashboardsAiSplit's minMainWidth, because 280px leaves such a page unusable
 * long before the drawer runs out of room to grow. The figure lives with that
 * page, not here: this module must not accumulate a list of its callers.
 */
export const MIN_MAIN_WIDTH = 280

/** Matches `.page { width: calc(100% - 60px) }` in Page.scss. */
export const SIDE_NAV_WIDTH = 60

export const WIDTH_STORAGE_KEY = 'cloudhub.aiAgentsDrawer.width'

export const clampDrawerWidth = (
  width: number,
  minMainWidth: number = MIN_MAIN_WIDTH
): number => {
  const pageWidth = window.innerWidth - SIDE_NAV_WIDTH
  const maxWidth = Math.min(
    Math.floor(pageWidth * 0.7),
    pageWidth - minMainWidth
  )

  // On a viewport too small to satisfy both, the page keeps its minimum and the
  // drawer takes what is left. Raising the result to MIN_WIDTH here instead
  // would let the drawer squeeze the page below MIN_MAIN_WIDTH.
  if (maxWidth <= MIN_WIDTH) {
    return Math.max(0, maxWidth)
  }

  return Math.min(maxWidth, Math.max(MIN_WIDTH, width))
}
