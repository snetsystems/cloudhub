import _ from 'lodash'
import React from 'react'

import {OverlayContainer, OverlayHeading, OverlayBody} from 'src/reusable_ui'
import OverlayTechnology from 'src/reusable_ui/components/overlays/OverlayTechnology'

interface Props {
  onCancel: () => void
  message: string | JSX.Element
  isVisible: boolean
  headingTitle: string
  customStyle?: React.CSSProperties
  containerMaxWidth?: number
}

const Modal = (props: Props): JSX.Element => {
  const {
    onCancel,
    message,
    isVisible,
    headingTitle,
    customStyle,
    containerMaxWidth,
  } = props

  return (
    <OverlayTechnology visible={isVisible}>
      <OverlayContainer
        maxWidth={
          _.isNull(containerMaxWidth) || _.isUndefined(containerMaxWidth)
            ? undefined
            : containerMaxWidth
        }
      >
        <OverlayHeading title={headingTitle} onDismiss={onCancel} />
        <OverlayBody>
          <div
            className="message-zone"
            style={customStyle || {height: '500px'}}
          >
            {message}
          </div>
        </OverlayBody>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

export default Modal
