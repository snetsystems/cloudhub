import React, {PureComponent} from 'react'

import {
  OverlayTechnology,
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
} from 'src/reusable_ui'

import Shell from 'src/agent_admin/components/Shell'
import {Notification} from 'src/types/notifications'
interface Props {
  visible: boolean
  headingTitle: string
  addr: string
  onCancel: () => void
  notify?: (message: Notification) => void
}

class ShellModal extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  render() {
    const {visible, headingTitle, onCancel, addr, notify} = this.props
    return (
      <OverlayTechnology visible={visible}>
        <OverlayContainer maxWidth={840}>
          <OverlayHeading title={headingTitle} onDismiss={onCancel} />
          <OverlayBody>
            {visible ? <Shell addr={addr} notify={notify} /> : null}
          </OverlayBody>
        </OverlayContainer>
      </OverlayTechnology>
    )
  }
}

export default ShellModal
