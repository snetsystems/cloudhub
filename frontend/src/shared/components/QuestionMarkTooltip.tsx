import React, {FunctionComponent} from 'react'
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
}) => (
  <div className="question-mark-tooltip">
    <div
      className="question-mark-tooltip--icon"
      data-for={`${tipID}-tooltip`}
      data-tip={tipContent}
      data-delay-hide={clickToClose ? "0" : "100"}
      data-delay-show="50"
      data-event={clickToClose ? "click" : "mouseenter"}
      data-event-off={clickToClose ? "blur" : "mouseleave"}
      role="button"
      tabIndex={0}
      aria-label="tooltip"
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
      globalEventOff={clickToClose ? "click" : undefined}
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

export default QuestionMarkTooltip
