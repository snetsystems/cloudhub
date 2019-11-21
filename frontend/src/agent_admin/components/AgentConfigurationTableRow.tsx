import React, {PureComponent} from 'react'
import {AGENT_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

import {Minion} from 'src/types'

interface Props {
  // key: Readonly<Props>
  minions: Minion
  focusedHost: string
  // ip: string
  // host: string
  // status: string
  // currentUrl: string
  // // onClickTableRow: () => void
  // onClickModal: ({}) => object
  // handleWheelKeyCommand: () => void
}

class AgentConfigurationTableRow extends PureComponent<Props> {
  constructor(props) {
    super(props)
  }

  public focusedClasses = (host: string): string => {
    const {focusedHost} = this.props
    if (host === focusedHost) {
      return 'hosts-table--tr focused'
    }
    return 'hosts-table--tr'
  }

  render() {
    return this.TableRowEachPage
  }

  private get TableRowEachPage() {
    const {minions, onClickTableRow, onClickAction} = this.props

    const {osVersion, os, ip, host, isInstall, isRunning} = minions
    const {
      CheckWidth,
      NameWidth,
      StatusWidth,
      HostWidth,
      IPWidth,
    } = AGENT_TABLE_SIZING

    return (
      <div
        className={this.focusedClasses(host)}
        onClick={onClickTableRow(host, ip)}
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
          {isRunning === true ? (
            <button
              className="btn btn-default action-call"
              onClick={onClickAction(host, isRunning)}
            >
              ■
            </button>
          ) : (
            <button
              className="btn btn-default action-call"
              onClick={onClickAction(host, isRunning)}
            >
              ▶
            </button>
          )}
        </div>
      </div>
    )
  }
}

export default AgentConfigurationTableRow
