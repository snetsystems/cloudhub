import React, {PureComponent} from 'react'
import {AGENT_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

interface Props {
  minion: object
  name: string
  ip: string
  host: string
  status: string
}

class AgentTableRow extends PureComponent<Props> {
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
    return this.TableRowEachPage
  }

  private get TableRowEachPage() {
    const {currentUrl} = this.props

    switch (currentUrl) {
      case 'agent-minions':
        return this.TableRowMinion
      case 'agent-control':
        return this.TableRowControl
      case 'agent-configuration':
        return this.TableRowConfig
      case 'agent-log':
        return this.TableRowLog
      default:
        return ''
    }
  }

  private get TableRowMinion() {
    const {minion, onClickTableRow} = this.props
    const {name, os, ip, host, status} = minion
    const {
      NameWidth,
      StatusWidth,
      HostWidth,
      IPWidth,
      ComboBoxWidth,
    } = AGENT_TABLE_SIZING

    return (
      <div className={this.focusedClasses()} onClick={onClickTableRow}>
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
          <button className="btn btn-default modal-call">Menu</button>
        </div>
      </div>
    )
  }

  private get TableRowControl() {
    const {minion, onClickTableRow} = this.props
    const {name, ip, host, isInstall} = minion
    console.log('TableRowControl isInstall:', isInstall)
    const {NameWidth, StatusWidth, HostWidth, IPWidth} = AGENT_TABLE_SIZING

    return (
      <div className={this.focusedClasses()} onClick={onClickTableRow}>
        <div className="hosts-table--td" style={{width: NameWidth}}>
          {name}
        </div>
        <div className="hosts-table--td" style={{width: IPWidth}}>
          {ip}
        </div>
        <div className="hosts-table--td" style={{width: HostWidth}}>
          {host}
        </div>
        <div className="hosts-table--td" style={{width: HostWidth}}>
          {isInstall}
        </div>
        <div className="hosts-table--td" style={{width: HostWidth}}>
          <button className="btn btn-default action-call">▶</button>
        </div>
      </div>
    )
  }

  private get TableRowConfig() {
    const {minion, onClickTableRow} = this.props
    const {name, os, ip, host, isSaveFile} = minion
    const {NameWidth, StatusWidth, HostWidth, IPWidth} = AGENT_TABLE_SIZING

    return (
      <div className={this.focusedClasses()} onClick={onClickTableRow}>
        <div className="hosts-table--td" style={{width: NameWidth}}>
          {name}
        </div>
        <div className="hosts-table--td" style={{width: IPWidth}}>
          {ip}
        </div>
        <div className="hosts-table--td" style={{width: HostWidth}}>
          {host}
        </div>
        <div className="hosts-table--td" style={{width: StatusWidth}}>
          {isSaveFile === 'no' ? 'No file' : 'Yes'}
        </div>
        <div className="hosts-table--td" style={{width: StatusWidth}}>
          <button className="btn btn-default action-call">▶</button>
        </div>
      </div>
    )
  }

  private get TableRowLog() {
    const {minion, onClickTableRow} = this.props
    const {name, ip, host, isInstall, status} = minion
    const {
      NameWidth,
      StatusWidth,
      HostWidth,
      IPWidth,
      ComboBoxWidth,
    } = AGENT_TABLE_SIZING

    return (
      <div className={this.focusedClasses()} onClick={onClickTableRow}>
        <div className="hosts-table--td" style={{width: NameWidth}}>
          {name}
        </div>
        <div className="hosts-table--td" style={{width: IPWidth}}>
          {ip}
        </div>
        <div className="hosts-table--td" style={{width: HostWidth}}>
          {host}
        </div>
        <div className="hosts-table--td" style={{width: HostWidth}}>
          {isInstall === 'no' ? 'No Installed' : 'Yes'}
        </div>
        <div className="hosts-table--td" style={{width: HostWidth}}>
          <button className="btn btn-default action-call">▶</button>
        </div>
        <div className="hosts-table--td" style={{width: HostWidth}}>
          {status === 'accepted' ? (
            <div
              style={{
                borderRadius: '50%',
                backgroundColor: 'green',
                width: '15px',
                height: '15px',
              }}
            />
          ) : (
            <div
              style={{
                borderRadius: '50%',
                backgroundColor: 'red',
                width: '15px',
                height: '15px',
              }}
            />
          )}
        </div>
      </div>
    )
  }
}

export default AgentTableRow
