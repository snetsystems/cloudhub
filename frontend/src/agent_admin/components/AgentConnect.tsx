// Libraries
import _ from 'lodash'
import React, {PureComponent, ChangeEvent, KeyboardEvent} from 'react'

interface Props {
  isEventStopPropagation?: boolean
}

interface State {
  ip: string
}

class AgentConnect extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      ip: '',
    }
  }

  public render() {
    const {ip} = this.state
    const isNull = _.isNull(ip)
    return (
      <div
        className={`agent-connect-container`}
        onClick={e => {
          if (this.props.isEventStopPropagation) {
            e.stopPropagation()
          }
        }}
      >
        <input
          type="text"
          className="form-control input-sm connect-input"
          placeholder="IP Address"
          onChange={this.handleOnChange}
          onKeyPress={this.handleOnKeyPress}
          value={this.state.ip}
        />
        <button
          className={'btn btn-default btn-xs'}
          onClick={this.handleConfirmClick}
          disabled={isNull}
        >
          OK
        </button>
      </div>
    )
  }

  private handleConfirmClick = () => {
    this.handleConnect()
  }

  private handleConnect = () => {
    const {ip} = this.state

    if (ip) {
      const rdp = 'rdp://' + ip + '/?admin=&span=&w=1280&h=800'
      window.location.href = rdp
    }
  }

  private handleOnKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (!_.isNull(this.state.ip)) {
        this.handleConnect()
      }
    }
  }

  private handleOnChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({ip: e.target.value})
  }
}
export default AgentConnect
