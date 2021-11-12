import React, {PureComponent} from 'react'

import {
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
  Form,
} from 'src/reusable_ui'
import OverlayTechnology from 'src/reusable_ui/components/overlays/OverlayTechnology'
import {RemoteDataState} from 'src/types'
// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'
import PageSpinner from 'src/shared/components/PageSpinner'

interface Props {
  onCancel: () => void
  message: JSX.Element
  visible: boolean
  status?: RemoteDataState
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
            <div style={{position: 'relative'}}>
              {this.loadingState}
              <OverlayHeading title={'Instance Type'} onDismiss={onCancel} />
              <OverlayBody>
                <Form>
                  <Form.Element>{message}</Form.Element>
                  <Form.Footer></Form.Footer>
                </Form>
              </OverlayBody>
            </div>
          </OverlayContainer>
        </OverlayTechnology>
      </>
    )
  }

  private get loadingState() {
    const {status} = this.props
    let isLoading = false

    if (status === RemoteDataState.Loading) {
      isLoading = true
    }

    return isLoading ? (
      <div
        style={{
          position: 'absolute',
          zIndex: 3,
          backgroundColor: 'rgba(0,0,0,0.5)',
          width: '100%',
          height: '100%',
        }}
      >
        <PageSpinner />
      </div>
    ) : null
  }
}

export default InstanceTypeModal
