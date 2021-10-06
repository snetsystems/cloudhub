import React, {PureComponent} from 'react'

import {
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
  Form,
} from 'src/reusable_ui'
import OverlayTechnology from 'src/reusable_ui/components/overlays/OverlayTechnology'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  onCancel: () => void
  message: JSX.Element
  visible: boolean
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
          <OverlayContainer maxWidth={800}>
            <OverlayHeading title={'Instance Type'} onDismiss={onCancel} />
            <OverlayBody>
              <Form>
                <Form.Element>{message}</Form.Element>
                <Form.Footer></Form.Footer>
              </Form>
            </OverlayBody>
          </OverlayContainer>
        </OverlayTechnology>
      </>
    )
  }
}

export default InstanceTypeModal
