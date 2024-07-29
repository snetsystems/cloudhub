import React, {FunctionComponent, MouseEvent} from 'react'
import moment from 'moment'
import classnames from 'classnames'
import {AnnotationViewer} from 'src/types'

interface TimeStampProps {
  time: number
}

const TimeStamp: FunctionComponent<TimeStampProps> = ({time}) => (
  <div className="annotation-tooltip--timestamp">
    {`${moment(time).format('YYYY/MM/DD HH:mm:ss.SSS')}`}
  </div>
)

interface AnnotationState {
  isMouseOver: string | boolean
}

interface Props {
  annotation: AnnotationViewer
  timestamp: number
  onMouseLeave: (e: MouseEvent<HTMLDivElement>) => void
  annotationState: AnnotationState
}

const AnnotationViewerTooltip: FunctionComponent<Props> = props => {
  const {
    annotation,
    onMouseLeave,
    timestamp,
    annotationState: {isMouseOver},
  } = props

  const tooltipClass = classnames('annotation-tooltip', {
    hidden: !isMouseOver,
  })

  return (
    <div
      id={`tooltip-${annotation.id}`}
      onMouseLeave={onMouseLeave}
      className={tooltipClass}
    >
      <div className="annotation-tooltip--items">
        <div className="annotation-tooltip-text">{annotation.text}</div>
        <div className="annotation-tooltip--lower">
          <TimeStamp time={timestamp} />
        </div>
      </div>
    </div>
  )
}

export default AnnotationViewerTooltip
