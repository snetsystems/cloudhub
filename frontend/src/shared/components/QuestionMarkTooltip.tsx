import React, {FunctionComponent, useEffect, useRef} from 'react'
import ReactTooltip from 'react-tooltip'

interface Props {
  tipID: string
  tipContent: string
  customClass?: string
  clickToClose?: boolean
  tooltipPlace?: 'top' | 'right' | 'bottom' | 'left'
}

const QuestionMarkTooltip: FunctionComponent<Props> = ({
  tipID,
  tipContent,
  customClass,
  clickToClose = false,
  tooltipPlace = 'bottom',
}) => {
  const iconRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!clickToClose) {
      return
    }

    // Capture phase so this runs before overlay stopPropagation
    const handleOutsideClick = (e: MouseEvent) => {
      const iconEl = iconRef.current
      if (!iconEl) {
        return
      }

      const tipEl = document.getElementById(`${tipID}-tooltip`)
      const isOpen = !!tipEl && tipEl.classList.contains('show')
      if (!isOpen) {
        return
      }

      const target = e.target as Node
      if (iconEl.contains(target) || (tipEl && tipEl.contains(target))) {
        return
      }

      ReactTooltip.hide(iconEl)
    }

    document.addEventListener('click', handleOutsideClick, true)
    return () => {
      document.removeEventListener('click', handleOutsideClick, true)
    }
  }, [clickToClose, tipID])

  const handleIconClick = () => {
    if (!clickToClose) {
      return
    }

    const iconEl = iconRef.current
    if (!iconEl) {
      return
    }

    const tipEl = document.getElementById(`${tipID}-tooltip`)
    const isOpen = !!tipEl && tipEl.classList.contains('show')

    if (isOpen) {
      ReactTooltip.hide(iconEl)
    } else {
      ReactTooltip.show(iconEl)
    }
  }

  return (
    <div className="question-mark-tooltip">
      <div
        ref={iconRef}
        className="question-mark-tooltip--icon"
        data-for={`${tipID}-tooltip`}
        data-tip={tipContent}
        data-delay-hide={clickToClose ? '0' : '100'}
        data-delay-show="50"
        // Dummy event disables react-tooltip hover; we handle clicks ourselves
        data-event={clickToClose ? 'manual' : undefined}
        role="button"
        tabIndex={0}
        aria-label="tooltip"
        onClick={handleIconClick}
      >
        ?
      </div>
      <ReactTooltip
        id={`${tipID}-tooltip`}
        effect="solid"
        html={true}
        place={tooltipPlace}
        class={`influx-tooltip ${customClass || ''}`}
        clickable={clickToClose}
        overridePosition={({left, top}, currentEvent, currentTarget, node) => {
          const padding = 10
          const windowWidth = window.innerWidth
          const windowHeight = window.innerHeight
          const tooltipWidth = node.offsetWidth || 300
          const tooltipHeight = node.offsetHeight || 100

          if (left + tooltipWidth > windowWidth - padding) {
            left = windowWidth - tooltipWidth - padding
          }

          if (left < padding) {
            left = padding
          }

          if (top + tooltipHeight > windowHeight - padding) {
            top = windowHeight - tooltipHeight - padding
          }

          if (top < padding) {
            top = padding
          }

          return {left, top}
        }}
      />
    </div>
  )
}

export default QuestionMarkTooltip
