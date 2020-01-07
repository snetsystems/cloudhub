import React, {PureComponent} from 'react'

import {
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
  Form,
  Button,
  ComponentColor,
} from 'src/reusable_ui'
import OverlayTechnology from 'src/reusable_ui/components/overlays/OverlayTechnology'

interface Props {
  onCancel: () => void
  onConfirm: () => void
  message: string
  cancelText: string
  confirmText: string
  visible: boolean
  headingTitle: string
}

interface State {
  isVisible: boolean
}

class AgentConfigModal extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {
      onCancel,
      onConfirm,
      message,
      cancelText,
      confirmText,
      visible,
      headingTitle,
    } = this.props
    return (
      <>
        <OverlayTechnology visible={visible}>
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
                    onClick={() => {
                      onConfirm()
                    }}
                  />
                  <Button text={cancelText} onClick={onCancel} />
                </Form.Footer>
              </Form>
            </OverlayBody>
          </OverlayContainer>
        </OverlayTechnology>
      </>
    )
  }
}

export default AgentConfigModal
