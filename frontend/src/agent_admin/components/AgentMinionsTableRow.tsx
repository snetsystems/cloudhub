import React, {PureComponent} from 'react'
import {AGENT_TABLE_SIZING} from 'src/hosts/constants/tableSizing'
import Dropdown from 'src/shared/components/Dropdown'

interface Props {
  minion: object
  name: string
  ip: string
  host: string
  status: string
}

class AgentMinionsTableRow extends PureComponent<Props> {
  constructor(props) {
    super(props)
  }

  public focusedClasses = (): string => {
    if (name === name) {
      return 'hosts-table--tr'
    }
    return 'hosts-table--tr'
  }

  public statusIndicator = status => {
    if (status === 'accepted') {
      return <div style={{color: '#4ed8a0'}}> accepted </div>
    }

    return <div style={{color: '#e85b1c'}}> unaccepted </div>
  }

  render() {
    const {minion} = this.props
    const {name, os, ip, host, status} = minion
    const {
      NameWidth,
      StatusWidth,
      HostWidth,
      IPWidth,
      ComboBoxWidth,
    } = AGENT_TABLE_SIZING

    return (
      <div className={this.focusedClasses()}>
        <div className="hosts-table--td" style={{width: NameWidth}}>
          {name}
        </div>
        <div className="hosts-table--td" style={{width: IPWidth}}>
          {os}
        </div>
        <div className="hosts-table--td" style={{width: IPWidth}}>
          {ip}
        </div>
        <div className="hosts-table--td" style={{width: HostWidth}}>
          {host}
        </div>
        <div className="hosts-table--td" style={{width: StatusWidth}}>
          {this.statusIndicator(status)}
        </div>
        <div className="hosts-table--td" style={{width: ComboBoxWidth}}>
          <Dropdown
            items={['Accept Key', 'Reject Key', 'Delete Key']}
            className="dropdown-stretch"
          />
        </div>
      </div>
    )
  }
}

export default AgentMinionsTableRow
