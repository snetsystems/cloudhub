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

import {Minion} from 'src/agent_admin/type'

interface Props {
  onCancel: () => void
  onConfirm: () => void
  name: string
  message: string
  cancelText: string
  confirmText: string
  disabled: boolean
  minions: Minion[]
  buttonClassName: string
  customClass?: string
}

interface State {
  isVisible: boolean
}

class AgentControlModal extends PureComponent<Props, State> {
  constructor(props) {
    super(props)

    this.state = {
      isVisible: false,
    }
  }

  handleOnClick = () => {
    const {onConfirm, minions, name} = this.props
    let checkMinion: Minion[] = minions.filter(m => m.isCheck === true)
    let commandMinion: Minion[] = []

    switch (name.toLocaleLowerCase()) {
      case 'run':
        commandMinion = checkMinion.filter(m => m.isRunning === true)
        commandMinion.length > 0
          ? this.setState({isVisible: !this.state.isVisible})
          : onConfirm()
        break

      case 'stop':
        commandMinion = checkMinion.filter(m => m.isRunning === false)
        commandMinion.length > 0
          ? this.setState({isVisible: !this.state.isVisible})
          : onConfirm()
        break

      case 'install':
        commandMinion = checkMinion.filter(m => m.isInstall === true)
        commandMinion.length > 0
          ? this.setState({isVisible: !this.state.isVisible})
          : onConfirm()
        break

      default:
        return
    }
  }

  public render() {
    const {
      name,
      disabled,
      onCancel,
      onConfirm,
      message,
      cancelText,
      confirmText,
      buttonClassName,
      customClass,
    } = this.props
    const {isVisible} = this.state
    return (
      <>
        <button
          disabled={disabled}
          className={buttonClassName}
          onClick={this.handleOnClick}
        >
          {name}
        </button>
        <OverlayTechnology visible={isVisible}>
          <OverlayContainer>
            <OverlayHeading
              title="Check for You"
              onDismiss={() => {
                this.setState({isVisible: !this.state.isVisible})
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
                      this.setState({isVisible: !this.state.isVisible})
                      onConfirm()
                    }}
                    customClass={customClass}
                  />
                  <Button
                    text={cancelText}
                    onClick={() => {
                      this.setState({isVisible: !this.state.isVisible})
                      onCancel()
                    }}
                    customClass={customClass}
                  />
                </Form.Footer>
              </Form>
            </OverlayBody>
          </OverlayContainer>
        </OverlayTechnology>
      </>
    )
  }
}

export default AgentControlModal
