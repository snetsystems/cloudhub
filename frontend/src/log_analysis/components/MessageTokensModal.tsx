import _ from 'lodash'
import React, {PureComponent} from 'react'
import Container from 'src/reusable_ui/components/overlays/OverlayContainer'
import Body from 'src/reusable_ui/components/overlays/OverlayBody'
import {Button, ComponentColor} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

interface Props {
  isVisible: boolean
  tokens: string[]
  onConfirm: (selected: string[]) => void
  onClose: () => void
}

interface State {
  selectedTokens: string[]
  prevTokens: string[]
}

class MessageTokensModal extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      selectedTokens: [...props.tokens],
      prevTokens: [...props.tokens],
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (!_.isEqual(prevProps.tokens, this.props.tokens)) {
      this.setState({
        selectedTokens: [...this.props.tokens],
        prevTokens: [...this.props.tokens],
      })
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
    const allSelected = tokens.length > 0 && selectedTokens.length === tokens.length
    const someSelected = selectedTokens.length > 0 && selectedTokens.length < tokens.length

    return (
      <>
        <div className="form-control-static select-all-container">
          <input
            type="checkbox"
            id="select_all_tokens"
            checked={allSelected}
            ref={input => {
              if (input) {
                input.indeterminate = someSelected
              }
            }}
            onChange={e => this.onToggleAll(e.currentTarget.checked)}
          />
          <label htmlFor="select_all_tokens">
            <strong>Select All</strong>
          </label>
        </div>
        <FancyScrollbar
          style={{height: 'calc(100% - 40px)'}}
       >
          {tokens.map((token,idx) => (
            <div key={`${token}_${idx}`} className="form-control-static">
              <input
                type="checkbox"
                id={`token_${token}_${idx}`}
                checked={selectedTokens.includes(token)}
                onChange={e => this.onToggle(token, e.currentTarget.checked)}
              />
              <label htmlFor={`token_${token}_${idx}`}>{token}</label>
            </div>
          ))}
      </FancyScrollbar>
      </>
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

  private onToggleAll(checked: boolean) {
    this.setState({
      selectedTokens: checked ? [...this.props.tokens] : []
    })
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
