import React, {ReactNode} from 'react'
import {connect} from 'react-redux'
import {
  Button,
  ComponentColor,
  Form,
  OverlayBody,
  OverlayContainer,
  OverlayHeading,
  OverlayTechnology,
} from 'src/reusable_ui'
import {closeModal, openModal} from 'src/shared/actions/aiModal'

interface Props {
  title?: string
  isVisible?: boolean
  message?: string
  confirmText?: string
  cancelText?: string
  customClass?: string
  childNode?: ReactNode
  btnColor?: ComponentColor
  isOneBtn?: boolean
  onConfirm?: () => void
  onCancel?: () => void
  closeModal?: () => void
}

function DeviceManagementModal({
  title,
  isVisible,
  message,
  childNode,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  customClass,
  btnColor,
  isOneBtn,
  closeModal,
}: Props) {
  const handleClose = () => {
    closeModal()
  }

  return (
    <OverlayTechnology visible={isVisible}>
      <OverlayContainer>
        <OverlayHeading
          title={title ?? 'Confirm'}
          onDismiss={() => {
            handleClose()
          }}
        />
        <OverlayBody>
          <Form>
            <Form.Element>
              <div className="message-zone device-modal--childNode">
                {!!message && <span>{message}</span>}
                {!!childNode && childNode}
              </div>
            </Form.Element>
            <Form.Footer>
              {!isOneBtn && (
                <Button
                  color={btnColor ?? ComponentColor.Success}
                  text={confirmText}
                  onClick={() => {
                    !!onConfirm ? onConfirm() : handleClose()
                  }}
                  customClass={customClass}
                />
              )}
              <Button
                text={cancelText}
                onClick={() => {
                  !!onCancel ? onCancel() : handleClose()
                }}
                customClass={customClass}
              />
            </Form.Footer>
          </Form>
        </OverlayBody>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

const mapStateToProps = ({
  aiModal: {
    title,
    isVisible,
    message,
    confirmText,
    cancelText,
    customClass,
    childNode,
    btnColor,
    isOneBtn,
    onConfirm,
    onCancel,
  },
}) => ({
  title,
  isVisible,
  message,
  confirmText,
  cancelText,
  customClass,
  childNode,
  btnColor,
  isOneBtn,
  onConfirm,
  onCancel,
})

const mapDispatchToProps = {
  openModal: openModal,
  closeModal: closeModal,
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DeviceManagementModal)
