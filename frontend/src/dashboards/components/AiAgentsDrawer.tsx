import React, {useCallback, useEffect, useRef, useState} from 'react'
import classnames from 'classnames'
import {connect} from 'react-redux'
import CloudhubAiChatStandalone from 'src/ai_chat/containers/CloudhubAiChatStandalone'
import {isOrgNavMenuEnabled} from 'src/side_nav/utils/orgNavMenuVisibility'
import {OrgNavMenuState} from 'src/shared/actions/orgNavMenu'
import {AiAgentsDrawerState} from 'src/shared/reducers/aiAgentsDrawer'
import {
  clampDrawerWidth,
  DEFAULT_WIDTH,
  MIN_MAIN_WIDTH,
  WIDTH_STORAGE_KEY,
} from 'src/dashboards/utils/aiDrawerWidth'

interface Props {
  isOpen: boolean
  orgNavMenu: OrgNavMenuState
  inPresentationMode?: boolean
  /** Width the page beneath keeps for itself. See aiDrawerWidth. */
  minMainWidth?: number
}

const readStoredWidth = (): number => {
  try {
    const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY)
    const parsed = raw ? parseInt(raw, 10) : DEFAULT_WIDTH
    return Number.isFinite(parsed) ? parsed : DEFAULT_WIDTH
  } catch {
    return DEFAULT_WIDTH
  }
}

const persistWidth = (width: number): void => {
  try {
    window.localStorage.setItem(WIDTH_STORAGE_KEY, String(width))
  } catch {
    // Ignore quota / private-mode failures.
  }
}

const layoutNotifier = (() => {
  let frame: number | null = null
  let isSynthetic = false

  const dispatch = () => {
    isSynthetic = true
    window.dispatchEvent(new Event('resize'))
    isSynthetic = false
  }

  return {
    notify: () => {
      if (frame != null) {
        return
      }

      frame = window.requestAnimationFrame(() => {
        frame = null
        dispatch()
      })
    },
    isSynthetic: () => isSynthetic,
  }
})()

const AiAgentsDrawer: React.FC<Props> = ({
  isOpen,
  orgNavMenu,
  inPresentationMode = false,
  minMainWidth = MIN_MAIN_WIDTH,
}) => {
  const [hasOpened, setHasOpened] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const dragRef = useRef<{startX: number; startWidth: number} | null>(null)
  const widthRef = useRef(width)

  useEffect(() => {
    setWidth(clampDrawerWidth(readStoredWidth(), minMainWidth))
  }, [minMainWidth])

  useEffect(() => {
    if (isOpen) {
      setHasOpened(true)
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true))
      })
      return () => cancelAnimationFrame(frame)
    }

    setIsVisible(false)
  }, [isOpen])

  widthRef.current = width

  const isExpanded = isVisible && !inPresentationMode
  const panelWidth = isExpanded ? width : 0

  useEffect(() => {
    layoutNotifier.notify()

    if (isResizing) {
      return
    }

    const timers = [80, 180, 320].map(delay =>
      window.setTimeout(layoutNotifier.notify, delay)
    )

    return () => {
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }, [isResizing, panelWidth])

  useEffect(() => {
    const handleWindowResize = () => {
      if (layoutNotifier.isSynthetic()) {
        return
      }

      setWidth(current => {
        const next = clampDrawerWidth(current, minMainWidth)
        if (next !== current) {
          persistWidth(next)
        }
        return next
      })
    }

    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [minMainWidth])

  const handleResizeMove = useCallback((event: MouseEvent) => {
    if (!dragRef.current) {
      return
    }

    const nextWidth = clampDrawerWidth(
      dragRef.current.startWidth + (dragRef.current.startX - event.clientX),
      minMainWidth
    )
    setWidth(nextWidth)
  }, [minMainWidth])

  const handleResizeEnd = useCallback(() => {
    persistWidth(clampDrawerWidth(widthRef.current, minMainWidth))
    dragRef.current = null
    setIsResizing(false)
    document.body.classList.remove('ai-agents-drawer-resizing')
    window.removeEventListener('mousemove', handleResizeMove)
    window.removeEventListener('mouseup', handleResizeEnd)
  }, [handleResizeMove, minMainWidth])

  const handleResizeStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return
      }

      event.preventDefault()
      dragRef.current = {startX: event.clientX, startWidth: width}
      setIsResizing(true)
      document.body.classList.add('ai-agents-drawer-resizing')
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
    },
    [handleResizeEnd, handleResizeMove, width]
  )

  useEffect(() => {
    return () => {
      document.body.classList.remove('ai-agents-drawer-resizing')
      window.removeEventListener('mousemove', handleResizeMove)
      window.removeEventListener('mouseup', handleResizeEnd)
    }
  }, [handleResizeEnd, handleResizeMove])

  if (!hasOpened || !isOrgNavMenuEnabled(orgNavMenu?.selection, 'ai-chat')) {
    return null
  }

  return (
    <>
      {isExpanded && (
        <div
          className={classnames('ai-agents-drawer-resizer', {
            dragging: isResizing,
          })}
          onMouseDown={handleResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize"
        >
          <span className="ai-agents-drawer-resizer--tooltip">
            Drag to resize.
          </span>
        </div>
      )}
      <div
        className={classnames('ai-agents-drawer', {
          'is-open': isExpanded,
          'is-resizing': isResizing,
        })}
        style={{width: panelWidth}}
        aria-hidden={!isExpanded}
      >
        <CloudhubAiChatStandalone
          mode="drawer"
          isOpen={isOpen}
          defaultSidebarCollapsed={true}
          chatOnly={true}
          customClass="ai-agents-drawer-chat"
        />
      </div>
    </>
  )
}

const mapStateToProps = ({
  aiAgentsDrawer,
  orgNavMenu,
}: {
  aiAgentsDrawer: AiAgentsDrawerState
  orgNavMenu: OrgNavMenuState
}) => ({
  isOpen: aiAgentsDrawer.isOpen,
  orgNavMenu: orgNavMenu || {orgId: null, selection: {}},
})

const ConnectedAiAgentsDrawer = connect(mapStateToProps)(AiAgentsDrawer)

interface DashboardsAiSplitProps {
  children: React.ReactNode
  inPresentationMode?: boolean
  /**
   * Width this page keeps for itself when the drawer is dragged wide. Defaults
   * to MIN_MAIN_WIDTH; pass a larger one for a dense layout.
   */
  minMainWidth?: number
}

export const DashboardsAiSplit: React.FC<DashboardsAiSplitProps> = ({
  children,
  inPresentationMode = false,
  minMainWidth,
}) => (
  <div
    className={classnames('page-contents--split', 'dashboards-ai-split', {
      'presentation-mode': inPresentationMode,
    })}
  >
    <div className="dashboards-ai-split--main">{children}</div>
    <ConnectedAiAgentsDrawer
      inPresentationMode={inPresentationMode}
      minMainWidth={minMainWidth}
    />
  </div>
)

export default ConnectedAiAgentsDrawer
