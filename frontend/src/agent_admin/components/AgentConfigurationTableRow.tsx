// Libraries
import React, {PureComponent, MouseEvent} from 'react'

// Components
import {AgentConfiguration} from 'src/agent_admin/containers/AgentConfiguration'
import {OSIndicator} from 'src/agent_admin/components/AgentIndicator'
import {TableBodyRowItem} from 'src/agent_admin/reusable/'

// Constants
import {AGENT_CONFIGURATION_TABLE_SIZING} from 'src/agent_admin/constants/tableSizing'

// Types
import {Minion} from 'src/agent_admin/type'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  minions: Minion
  focusedHost: string
  onClickTableRow: AgentConfiguration['onClickTableRowCall']
  onClickAction: AgentConfiguration['onClickActionCall']
  onMouseOver: (event: MouseEvent<HTMLElement>, minionIPAddress: string) => void
  onMouseLeave: () => void
}

@ErrorHandling
class AgentConfigurationTableRow extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public focusedClasses = (host: string): string => {
    const {focusedHost} = this.props
    if (host === focusedHost) {
      return 'agent--row hosts-table--tr focused'
    }
    return 'agent--row hosts-table--tr'
  }

  public render() {
    return this.TableRowEachPage
  }

  private handleOnClickTableRow = (): void => {
    const {minions, onClickTableRow} = this.props
    const {host} = minions

    onClickTableRow(host)
  }

  private handleOnClickAction = (e: MouseEvent): void => {
    e.stopPropagation()
    const {minions, onClickAction} = this.props
    const {host, isRunning} = minions

    onClickAction(host, isRunning)
  }
  private get TableRowEachPage(): JSX.Element {
    const {minions, onMouseLeave, onMouseOver} = this.props
    const {osVersion, os, ip, host, isRunning} = minions
    const {
      HostWidth,
      OSWidth,
      OSVersionWidth,
      IPWidth,
      ActionWidth,
    } = AGENT_CONFIGURATION_TABLE_SIZING
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
          title={
            <button
              className="btn btn-default action-call"
              onClick={this.handleOnClickAction}
            >
              <>{isRunning === true ? '■' : '▶'}</>
            </button>
          }
          width={ActionWidth}
        />
      </div>
    )
  }
}

export default AgentConfigurationTableRow
