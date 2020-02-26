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
  buttonName: string
  message: string | JSX.Element
  cancelText: string
  confirmText: string
  buttonDisabled: boolean
  buttonClassName: string
  isVisible: boolean
  headingTitle: string
  isUseButton: boolean
  confirmButtonStatus: ComponentStatus
  customClass?: string
}

const RouterModal = (props: Props): JSX.Element => {
  const {
    buttonName,
    buttonDisabled,
    onCancel,
    onConfirm,
    message,
    cancelText,
    confirmText,
    buttonClassName,
    isVisible,
    headingTitle,
    isUseButton,
    confirmButtonStatus,
    customClass,
  } = props

  return (
    <>
      {isUseButton ? (
        <button disabled={buttonDisabled} className={buttonClassName}>
          {buttonName}
        </button>
      ) : null}
      <OverlayTechnology visible={isVisible}>
        <OverlayContainer>
          <OverlayHeading
            title={headingTitle}
            onDismiss={() => {
              onCancel()
            }}
          />
          <OverlayBody>
            <Form>
              <Form.Element>
                <div className="message-zone">{message}</div>
              </Form.Element>
              <Form.Footer>
                <Button
                  color={ComponentColor.Success}
                  text={confirmText}
                  onClick={() => {
                    onConfirm()
                  }}
                  status={confirmButtonStatus}
                  customClass={customClass}
                />
                <Button
                  text={cancelText}
                  onClick={() => {
                    onCancel()
                  }}
                />
              </Form.Footer>
            </Form>
          </OverlayBody>
        </OverlayContainer>
      </OverlayTechnology>
    </>
  )
}

export default RouterModal
