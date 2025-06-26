import React, {PureComponent} from 'react'
import Container from 'src/reusable_ui/components/overlays/OverlayContainer'
import Body from 'src/reusable_ui/components/overlays/OverlayBody'
import {Button, ComponentColor} from 'src/reusable_ui'

interface Props {
  isVisible: boolean
  tokens: string[]
  onConfirm: (selected: string[]) => void
  onClose: () => void
}

interface State {
  selectedTokens: string[]
}

class MessageTokensModal extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      selectedTokens: [...props.tokens],
    }
  }

  private get renderHeader() {
    return (
      <div className="overlay--heading">
        <div id="setting-title" className="overlay--title">
          {'Select filters to apply'}
        </div>
        <Button
          onClick={() => this.onCancel()}
          customClass="btn-cancel"
          text="Cancel"
          titleText="Cancel"
        />
        <Button
          color={ComponentColor.Success}
          onClick={() => this.onOk()}
          customClass="btn-ok"
          text="OK"
          titleText="OK"
        />
      </div>
    )
  }

  private get renderBody() {
    const {tokens} = this.props
    const {selectedTokens} = this.state
    return (
      <div>
        {tokens.map(token => (
          <div key={token} className="form-control-static">
            <input
              type="checkbox"
              id={`token_${token}`}
              defaultChecked={selectedTokens.includes(token)}
              onChange={e => this.onToggle(token, e.currentTarget.checked)}
            />
            <label htmlFor={`token_${token}`}>{token}</label>
          </div>
        ))}
      </div>
    )
  }

  public render() {
    const {isVisible} = this.props
    if (!isVisible) {
      return null
    }
    return (
      <>
        <div className="message-tokens-modal">
          <Container maxWidth={600}>
            {this.renderHeader}
            <Body>{this.renderBody}</Body>
          </Container>
        </div>
      </>
    )
  }

  private onToggle(token: string, checked: boolean) {
    this.setState(prev => {
      const {selectedTokens} = prev
      const next = checked
        ? Array.from(new Set([...selectedTokens, token]))
        : selectedTokens.filter(t => t !== token)
      return {selectedTokens: next}
    })
  }

  private onOk() {
    this.props.onConfirm(this.state.selectedTokens)
    this.props.onClose()
  }

  private onCancel() {
    this.props.onClose()
  }
}

export default MessageTokensModal
