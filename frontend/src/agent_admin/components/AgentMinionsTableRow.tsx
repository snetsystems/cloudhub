// Libraries
import React, {MouseEvent, PureComponent} from 'react'

// Constants
import {AGENT_MINION_TABLE_SIZING} from 'src/agent_admin/constants/tableSizing'
import {AgentMinions} from 'src/agent_admin/containers/AgentMinions'
import {OSIndicator} from 'src/agent_admin/components/AgentIndicator'
import {TableBodyRowItem} from 'src/agent_admin/reusable/'

// Types
import {Minion} from 'src/agent_admin/type'
import {ShellInfo} from 'src/types'
import {MinionState} from 'src/agent_admin/type/minion'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  idx: number
  minions: Minion
  focusedHost: string
  onClickTableRow: AgentMinions['onClickTableRowCall']
  onClickModal: ({}) => object
  handleWheelKeyCommand: (host: string, cmdstatus: string) => void
  onRefreshMinion: (host: string) => void | Promise<void>
  handleShellModalOpen?: (shell: ShellInfo) => void
  handleShellModalClose?: () => void
  onMouseOver: (event: MouseEvent<HTMLElement>, minionIPAddress: string) => void
  onMouseLeave: () => void
  renderConsoleTableBodyRow: ({}) => object
  isProcessing?: boolean
  isSaltLoading?: boolean
}

@ErrorHandling
class AgentMinionsTableRow extends PureComponent<Props> {
  constructor(props: Readonly<Props>) {
    super(props)
  }

  public focusedClasses = (host: string): string => {
    const {focusedHost} = this.props
    if (host === focusedHost) {
      return 'agent--row hosts-table--tr focused'
    }
    return 'agent--row hosts-table--tr'
  }

  public isStatusIndicator = (status: string, isInstall?: boolean, isSaltRunning?: boolean) => {
    if (status === MinionState.Accept) {
      const online = isSaltRunning !== false
      return (
        <div
          className={`agent--indicator ${
            online ? 'indicator--primary' : 'indicator--offline'
          }`}
        >
          Accepted
        </div>
      )
    } else if (status === MinionState.UnAccept) {
      return <div className="agent--indicator indicator--fail">UnAccept</div>
    } else if (status === MinionState.Reject) {
      return <div className="agent--indicator indicator--fail">Reject</div>
    } else if (status === MinionState.Denied) {
      return <div className="agent--indicator indicator--fail">Denied</div>
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
    const {
      idx,
      minions,
      onClickModal,
      handleWheelKeyCommand,
      onRefreshMinion,
      handleShellModalOpen,
      onMouseLeave,
      onMouseOver,
      renderConsoleTableBodyRow,
      isProcessing,
      isSaltLoading,
    } = this.props
    const {osVersion, os, ip, host, status, isInstall, isSaltRunning} = minions
    const {
      HostWidth,
      OSWidth,
      OSVersionWidth,
      IPWidth,
      StatusWidth,
      OperationWidth,
    } = AGENT_MINION_TABLE_SIZING
    const minionIPAddresses = (ip ?? '').split(',')
    const isMultipleIPAddress = !!ip && minionIPAddresses.length > 1
    const minionIPAddress = isMultipleIPAddress
      ? `${minionIPAddresses[0]},...`
      : ip

    return (
      <div
        className={this.focusedClasses(host)}
        onClick={this.handleOnClickTableRow}
      >
        <TableBodyRowItem title={host} width={HostWidth} />
        <TableBodyRowItem
          title={os ? <OSIndicator os={os} /> : ''}
          width={OSWidth}
        />
        <TableBodyRowItem title={osVersion} width={OSVersionWidth} />
        <div
          className={`hosts-table--td`}
          onMouseLeave={onMouseLeave}
          onMouseOver={event => onMouseOver(event, ip)}
          style={{width: IPWidth}}
        >
          {ip ? minionIPAddress : '-'}
        </div>
        <TableBodyRowItem
          title={
            <span className="agent-minions-status-content">
              {this.isStatusIndicator(status, isInstall, isSaltRunning)}
              <span className="agent-minions-spinner-slot">
                {isProcessing || (isSaltLoading && status === MinionState.Accept) ? (
                  <div className="simple-spinner" />
                ) : null}
              </span>
            </span>
          }
          width={StatusWidth}
        />
        <TableBodyRowItem
          title={
            <div id={`table-row--select${idx}`} className="agent-minions-operation-actions">
              {onClickModal({
                name: '፧',
                host,
                status,
                _this: this,
                handleWheelKeyCommand,
                idx,
              })}
              {status === MinionState.Accept && (
                <button
                  className="btn btn-sm btn-default agent-row--button-sm agent-row--refresh-button"
                  title="Update agent info"
                  disabled={isProcessing || isSaltRunning !== true}
                  onClick={e => {
                    e.stopPropagation()
                    onRefreshMinion(host)
                  }}
                >
                  {isProcessing ? (
                    <div className="simple-spinner" />
                  ) : (
                    <span className="icon refresh" />
                  )}
                </button>
              )}
            </div>
          }
          width={OperationWidth}
        />
        <TableBodyRowItem
          title={
            <div id={`table-row--select-ip${idx}`}>
              {renderConsoleTableBodyRow({
                name: 'ipselectdropdown',
                host,
                ip,
                os,
                _this: this,
                idx,
                handleShellModalOpen,
              })}
            </div>
          }
          width={OperationWidth}
        />
      </div>
    )
  }
}

export default AgentMinionsTableRow
