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
  // cancelText: string
  visible: boolean
  // headingTitle: string
}

interface State {
  isVisible: boolean
}

@ErrorHandling
class InstanceTypeModal extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {onCancel, message, visible} = this.props
    return (
      <>
        <OverlayTechnology visible={visible}>
          <OverlayContainer>
            <OverlayHeading title={'Instance Type'} onDismiss={onCancel} />
            <OverlayBody>
              <Form>
                <Form.Element>
                  <div>{'test'} </div>
                </Form.Element>
                <Form.Footer>
                  <Button text={'CLOSE'} onClick={onCancel} />
                </Form.Footer>
              </Form>
            </OverlayBody>
          </OverlayContainer>
        </OverlayTechnology>
      </>
    )
  }
}

export default InstanceTypeModal
