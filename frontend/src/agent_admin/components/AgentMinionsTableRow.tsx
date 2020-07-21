// Libraries
import React, {PureComponent} from 'react'

// Constants
import {AGENT_MINION_TABLE_SIZING} from 'src/agent_admin/constants/tableSizing'
import {AgentMinions} from 'src/agent_admin/containers/AgentMinions'
import {OSIndicator} from 'src/agent_admin/components/AgentIndicator'
import {TableBodyRowItem} from 'src/agent_admin/reusable/'
import {ShellProps} from 'src/agent_admin/components/Shell'
// Types
import {Minion} from 'src/agent_admin/type'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  idx: number
  minions: Minion
  focusedHost: string
  onClickTableRow: AgentMinions['onClickTableRowCall']
  onClickModal: ({}) => object
  handleWheelKeyCommand: (host: string, cmdstatus: string) => void
  handleShellModalOpen?: (props: ShellProps) => void
  handleShellModalClose?: () => void
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
    if (status === 'Accept') {
      return <div className="agent--indicator indicator--primary">Accepted</div>
    } else if (status === 'UnAccept') {
      return <div className="agent--indicator indicator--fail">UnAccept</div>
    } else if (status === 'Reject') {
      return <div className="agent--indicator indicator--fail">Reject</div>
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
        <TableBodyRowItem title={ip} width={IPWidth} />
        <TableBodyRowItem
          title={this.isStatusIndicator(status)}
          width={StatusWidth}
        />
        <TableBodyRowItem
          title={
            <div id={`table-row--select${idx}`}>
              {onClickModal({
                name: '=',
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
            <div id={`table-row--select${idx}`}>
              <button
                className="btn btn-sm btn-primary"
                onClick={e => {
                  e.stopPropagation()
                  handleShellModalOpen({addr: ip})
                }}
              >
                open SSH
              </button>
            </div>
          }
          width={OperationWidth}
        />
      </div>
    )
  }
}

export default AgentMinionsTableRow
