import React, {PureComponent} from 'react'

import {
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
  Form,
  Button,
} from 'src/reusable_ui'
import OverlayTechnology from 'src/reusable_ui/components/overlays/OverlayTechnology'

// Components
import CodeMirrorConsole from 'src/agent_admin/components/CodeMirrorConsole'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  onCancel: () => void
  message: string
  cancelText: string
  visible: boolean
  headingTitle: string
}

interface State {
  isVisible: boolean
}

@ErrorHandling
class AgentConfigConsoleModal extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {onCancel, message, cancelText, visible, headingTitle} = this.props
    return (
      <>
        <OverlayTechnology visible={visible}>
          <OverlayContainer>
            <OverlayHeading title={headingTitle} onDismiss={onCancel} />
            <OverlayBody>
              <Form>
                <Form.Element>
                  <CodeMirrorConsole res={message} />
                </Form.Element>
                <Form.Footer>
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

export default AgentConfigConsoleModal