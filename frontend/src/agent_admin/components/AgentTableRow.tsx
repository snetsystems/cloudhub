import React, {PureComponent} from 'react'
import {AGENT_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

interface Props {
  minion: object
  ip: string
  host: string
  status: string
}

class AgentTableRow extends PureComponent<Props> {
  constructor(props) {
    super(props)
  }

  public focusedClasses = (): string => {
    return 'hosts-table--tr'
  }
  public isRunningIndicator = isRunning => {
    if (isRunning === true) {
      return (
        <div
          style={{
            borderRadius: '50%',
            backgroundColor: '#4ed8a0',
            width: '15px',
            height: '15px',
          }}
        />
      )
    }

    return (
      <div
        style={{
          borderRadius: '50%',
          backgroundColor: '#e85b1c',
          width: '15px',
          height: '15px',
        }}
      />
    )
  }

  public isAcceptIndicator = isAccept => {
    if (isAccept === true) {
      return (
        <div
          style={{
            color: '#4ed8a0',
          }}
        >
          Accepted
        </div>
      )
    }

    return (
      <div
        style={{
          color: '#e85b1c',
        }}
      >
        unAccept
      </div>
    )
  }

  render() {
    return this.TableRowEachPage
  }

  private get TableRowEachPage() {
    const {
      key,
      minion,
      currentUrl,
      onClickTableRow,
      onClickAction,
      onClickModal,
      onClickRun,
      onClickStop,
      onClickInstall,
    } = this.props

    const {
      osVersion,
      os,
      ip,
      host,
      isRunning,
      isInstall,
      isSaveFile,
      isAccept,
    } = minion
    const {
      CheckWidth,
      NameWidth,
      StatusWidth,
      HostWidth,
      IPWidth,
    } = AGENT_TABLE_SIZING

    return (
      <div
        className={this.focusedClasses()}
        onClickCapture={onClickTableRow.bind(this)}
      >
        {currentUrl === 'agent-control' ? (
          <div className="hosts-table--td" style={{width: CheckWidth}}>
            <input type="checkbox" />
          </div>
        ) : (
          ''
        )}

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

        {currentUrl === 'agent-control' || currentUrl === 'agent-log' ? (
          <div className="hosts-table--td" style={{width: HostWidth}}>
            {isInstall === true ? 'installed' : 'not install'}
          </div>
        ) : (
          ''
        )}

        {currentUrl === 'agent-configuration' ? (
          <div className="hosts-table--td" style={{width: StatusWidth}}>
            {isSaveFile === 'no' ? 'No file' : 'Yes'}
          </div>
        ) : (
          ''
        )}

        {currentUrl !== 'agent-minions' ? (
          <div className="hosts-table--td" style={{width: StatusWidth}}>
            <button
              className="btn btn-default action-call"
              onClick={onClickAction.bind(this)}
            >
              ▶
            </button>
          </div>
        ) : (
          ''
        )}

        {currentUrl === 'agent-minions' ? (
          <div className="hosts-table--td" style={{width: StatusWidth}}>
            {this.isAcceptIndicator(isAccept)}
          </div>
        ) : (
          ''
        )}

        {currentUrl === 'agent-log' ? (
          <div className="hosts-table--td" style={{width: StatusWidth}}>
            {this.isRunningIndicator(isRunning)}
          </div>
        ) : (
          ''
        )}

        {currentUrl === 'agent-minions' ? (
          <div
            className="hosts-table--td"
            id={`table-row--select${key}`}
            style={{width: StatusWidth}}
          >
            {onClickModal({name: 'select', isAccept, _this: this, key})}
          </div>
        ) : (
          ''
        )}
      </div>
    )
  }
}

export default AgentTableRow
