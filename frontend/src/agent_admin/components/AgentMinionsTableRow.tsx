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
  handleShellModalOpen?: (shell: ShellInfo) => void
  handleShellModalClose?: () => void
  onMouseOver: (event: MouseEvent<HTMLElement>, minionIPAddress: string) => void
  onMouseLeave: () => void
  renderConsoleTableBodyRow: ({}) => object
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

  public isStatusIndicator = (status: string) => {
    if (status === MinionState.Accept) {
      return <div className="agent--indicator indicator--primary">Accepted</div>
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
      handleShellModalOpen,
      onMouseLeave,
      onMouseOver,
      renderConsoleTableBodyRow,
    } = this.props
    const {osVersion, os, ip, host, status} = minions
    const {
      HostWidth,
      OSWidth,
      OSVersionWidth,
      IPWidth,
      StatusWidth,
      OperationWidth,
    } = AGENT_MINION_TABLE_SIZING
    const minionIPAddresses = ip.split(',')
    const isMultipleIPAddress = ip !== '' && minionIPAddresses.length > 1
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
          title={this.isStatusIndicator(status)}
          width={StatusWidth}
        />
        <TableBodyRowItem
          title={
            <div id={`table-row--select${idx}`}>
              {onClickModal({
                name: '፧',
                host,
                status,
                _this: this,
                handleWheelKeyCommand,
                idx,
              })}
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
