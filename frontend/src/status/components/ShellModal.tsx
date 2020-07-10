import React, {PureComponent} from 'react'

import {
  OverlayTechnology,
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
} from 'src/reusable_ui'

import Shell from 'src/status/components/Shell'

interface Props {
  visible: boolean
  headingTitle: string
  onCancel: () => void
}

class ShellModal extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  render() {
    const {visible, headingTitle, onCancel} = this.props
    return (
      <OverlayTechnology visible={visible}>
        <OverlayContainer maxWidth={840}>
          <OverlayHeading title={headingTitle} onDismiss={onCancel} />
          <OverlayBody>{visible ? <Shell /> : null}</OverlayBody>
        </OverlayContainer>
      </OverlayTechnology>
    )
  }
}

export default ShellModal
