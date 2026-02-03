import React, {FunctionComponent} from 'react'
import ReactTooltip from 'react-tooltip'

interface Props {
  tipID: string
  tipContent: string
  customClass?: string
  clickToClose?: boolean
}

const QuestionMarkTooltip: FunctionComponent<Props> = ({
  tipID,
  tipContent,
  customClass,
  clickToClose = false,
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
      place="bottom"
      class={`influx-tooltip ${customClass || ''}`}
      clickable={clickToClose}
      globalEventOff={clickToClose ? "click" : undefined}
    />
  </div>
)

export default QuestionMarkTooltip
