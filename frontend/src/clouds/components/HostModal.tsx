import React from 'react'

import {
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
  Form,
  Button,
  ComponentColor,
} from 'src/reusable_ui'
import OverlayTechnology from 'src/reusable_ui/components/overlays/OverlayTechnology'
import {ComponentStatus} from 'src/reusable_ui/types'

interface Props {
  onCancel: () => void
  onConfirm: () => void
  message: string | JSX.Element
  confirmText: string
  isVisible: boolean
  headingTitle: string
  confirmButtonStatus: ComponentStatus
  customClass?: string
}

const HostModal = (props: Props): JSX.Element => {
  const {
    onCancel,
    onConfirm,
    message,
    confirmText,
    isVisible,
    headingTitle,
    confirmButtonStatus,
    customClass,
  } = props

  return (
    <OverlayTechnology visible={isVisible}>
      <OverlayContainer>
        <OverlayHeading title={headingTitle} onDismiss={onCancel} />
        <OverlayBody>
          <Form>
            <Form.Element>
              <div className="message-zone">{message}</div>
            </Form.Element>
            <Form.Footer>
              <Button
                color={ComponentColor.Success}
                text={confirmText}
                onClick={onConfirm}
                status={confirmButtonStatus}
                customClass={customClass}
              />
            </Form.Footer>
          </Form>
        </OverlayBody>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

export default HostModal
