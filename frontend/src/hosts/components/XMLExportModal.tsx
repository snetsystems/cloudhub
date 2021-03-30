import React from 'react'

import {OverlayContainer, OverlayHeading, OverlayBody} from 'src/reusable_ui'
import OverlayTechnology from 'src/reusable_ui/components/overlays/OverlayTechnology'

interface Props {
  onCancel: () => void
  message: string | JSX.Element
  isVisible: boolean
  headingTitle: string
}

const XMLExportModel = (props: Props): JSX.Element => {
  const {onCancel, message, isVisible, headingTitle} = props

  return (
    <OverlayTechnology visible={isVisible}>
      <OverlayContainer>
        <OverlayHeading title={headingTitle} onDismiss={onCancel} />
        <OverlayBody>
          <div className="message-zone" style={{height: '500px'}}>
            {message}
          </div>
        </OverlayBody>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

export default XMLExportModel
