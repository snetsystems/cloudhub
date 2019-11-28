// Libraries
import React, {PureComponent} from 'react'

// Constants
import {AGENT_TABLE_SIZING} from 'src/agent_admin/constants/tableSizing'
import AgentMinions from 'src/agent_admin/containers/AgentMinions'

// Types
import {Minion} from 'src/types'

interface Props {
  idx: number
  minions: Minion
  focusedHost: string
  onClickTableRow: AgentMinions['onClickTableRowCall']
  onClickModal: ({}) => object
  handleWheelKeyCommand: (host: string, cmdstatus: string) => void
}

class AgentMinionsTableRow extends PureComponent<Props> {
  constructor(props) {
    super(props)
  }

  public focusedClasses = (host: string): string => {
    const {focusedHost} = this.props
    if (host === focusedHost) {
      return 'agent--row hosts-table--tr focused'
    }
    return 'agent--row hosts-table--tr'
  }

  public isAcceptIndicator = isAccept => {
    if (isAccept === 'true') {
      return <div className="agent--indicator indicator--primary">Accepted</div>
    }

    return <div className="agent--indicator indicator--fail">unAccept</div>
  }

  public isStatusIndicator = status => {
    if (status === 'Accept') {
      return <div className="agent--indicator indicator--primary">Accepted</div>
    } else if (status === 'UnAccept') {
      return <div className="agent--indicator indicator--fail">UnAccept</div>
    } else if (status === 'ReJect') {
      return <div className="agent--indicator indicator--fail">ReJect</div>
    }
  }

  render() {
    return this.TableRowEachPage
  }

  private get handleOnClickTableRow() {
    const {minions, onClickTableRow} = this.props
    const {host} = minions
    return onClickTableRow(host)
  }

  private get TableRowEachPage() {
    const {idx, minions, onClickModal, handleWheelKeyCommand} = this.props
    const {osVersion, os, ip, host, status} = minions
    const {StatusWidth, HostWidth, IPWidth} = AGENT_TABLE_SIZING

    return (
      <div
        className={this.focusedClasses(host)}
        onClick={this.handleOnClickTableRow}
      >
        <div className="hosts-table--td" style={{width: HostWidth}}>
          {host}
        </div>

        <div className="hosts-table--td" style={{width: IPWidth}}>
          {os}
        </div>

        <div className="hosts-table--td" style={{width: IPWidth}}>
          {osVersion}
        </div>

        <div className="hosts-table--td" style={{width: IPWidth}}>
          {ip}
        </div>
        <div className="hosts-table--td" style={{width: StatusWidth}}>
          {this.isStatusIndicator(status)}
        </div>
        <div
          className="hosts-table--td"
          id={`table-row--select${idx}`}
          style={{width: StatusWidth}}
        >
          {onClickModal({
            name: '=',
            host,
            status,
            _this: this,
            handleWheelKeyCommand,
            idx,
          })}
        </div>
      </div>
    )
  }
}

export default AgentMinionsTableRow
