// Library
import React, {
  useCallback,
  useEffect,
  useState,
  useMemo,
  FC,
} from 'react'
import classnames from 'classnames'
import _ from 'lodash'

// Actions & Utils
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {HANDLE_VERTICAL} from 'src/shared/constants'
import Threesizer from 'src/shared/components/threesizer/Threesizer'

export interface CollapsibleSidePanelSliceProps {
  /** Left / Main content */
  children: React.ReactNode
  /** Right panel content */
  panelContent: React.ReactNode
  /** Whether the right panel is currently open */
  isOpen: boolean
  /** Callback triggered when panel is closed (e.g. by dragging below threshold or clicking close) */
  onClose?: () => void
  /** Default width ratio when opened (default: 0.42) */
  defaultRatio?: number
  /** Threshold in pixels under which dragging snaps closed (default: 120) */
  snapCloseThreshold?: number
  /** Duration of open/close animation in ms (default: 280) */
  animationDuration?: number
  /** Optional localStorage key to persist custom dragged width (omitted by default) */
  localStorageKey?: string
  /** Custom class for container */
  className?: string
  /** Callback when division resize occurs */
  onResize?: (proportions: number[]) => void
}

export const CollapsibleSidePanelSlice: FC<CollapsibleSidePanelSliceProps> = ({
  children,
  panelContent,
  isOpen,
  onClose,
  defaultRatio = 0.42,
  snapCloseThreshold = 120,
  animationDuration = 280,
  localStorageKey,
  className,
  onResize,
}) => {
  const [isRender, setIsRender] = useState<boolean>(isOpen)
  const [verticalProportions, setVerticalProportions] = useState<number[]>(
    isOpen ? [1 - defaultRatio, defaultRatio] : [1, 0]
  )

  const loadSavedRatio = useCallback((): number => {
    if (!localStorageKey) return defaultRatio
    try {
      const saved = localStorage.getItem(localStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (
          Array.isArray(parsed) &&
          parsed.length === 2 &&
          parsed[1] > 0.05 &&
          parsed[0] > 0.05
        ) {
          return parsed[1]
        }
      }
    } catch {
      // ignore
    }
    return defaultRatio
  }, [localStorageKey, defaultRatio])

  const saveRatio = useCallback(
    (proportions: number[]): void => {
      if (!localStorageKey) return
      try {
        localStorage.setItem(localStorageKey, JSON.stringify(proportions))
      } catch {
        // ignore
      }
    },
    [localStorageKey]
  )

  useEffect(() => {
    if (isOpen) {
      setIsRender(true)
      const ratio = loadSavedRatio()
      const frame = requestAnimationFrame(() => {
        setVerticalProportions([1 - ratio, ratio])
      })
      return () => cancelAnimationFrame(frame)
    } else {
      setVerticalProportions([1, 0])
      const timer = setTimeout(() => {
        setIsRender(false)
      }, animationDuration)
      return () => clearTimeout(timer)
    }
  }, [isOpen, animationDuration, loadSavedRatio])

  const debouncedFit = useMemo(
    () => _.debounce(WindowResizeEventTrigger, animationDuration),
    [animationDuration]
  )

  useEffect(() => {
    debouncedFit()
  }, [isOpen, debouncedFit, verticalProportions])

  const handleThreesizerResize = (proportions: number[]): void => {
    if (isRender && isOpen) {
      const totalWidth = window.innerWidth
      const rightPixels = proportions[1] * totalWidth

      // Snap close if dragged below threshold
      if (rightPixels <= snapCloseThreshold || proportions[1] < 0.05) {
        if (onClose) {
          onClose()
        }
        return
      }

      setVerticalProportions(proportions)
      saveRatio(proportions)
    }

    if (onResize) {
      onResize(proportions)
    }
  }

  const renderLeftSection = useCallback(() => {
    return <div className="collapsible-main-section">{children}</div>
  }, [children])

  const renderRightSection = useCallback(() => {
    return (
      <div className="collapsible-panel-section">
        {isRender ? panelContent : <div style={{width: '100%', height: '100%'}} />}
      </div>
    )
  }, [isRender, panelContent])

  const verticalDivisions = useMemo(() => {
    const [leftSize, rightSize] = verticalProportions
    return [
      {
        name: '',
        handleDisplay: 'none',
        headerButtons: [],
        menuOptions: [],
        render: renderLeftSection,
        size: leftSize,
      },
      {
        name: '',
        handleDisplay: isOpen ? 'visible' : 'none',
        handlePixels: 8,
        headerButtons: [],
        menuOptions: [],
        render: renderRightSection,
        size: rightSize,
      },
    ]
  }, [isOpen, verticalProportions, renderLeftSection, renderRightSection])

  return (
    <div className={classnames('collapsible-side-panel-slice', className)}>
      <Threesizer
        orientation={HANDLE_VERTICAL}
        divisions={verticalDivisions}
        onResize={handleThreesizerResize}
      />
    </div>
  )
}

export default CollapsibleSidePanelSlice
