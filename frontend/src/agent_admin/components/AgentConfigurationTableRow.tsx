// Libraries
import React, {PureComponent, MouseEvent} from 'react'

// Components
import {AgentConfiguration} from 'src/agent_admin/containers/AgentConfiguration'
import {OSIndicator} from 'src/agent_admin/components/AgentIndicator'

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
    const {ip, host} = minions

    onClickTableRow(host, ip)
  }

  private handleOnClickAction = (e: MouseEvent): void => {
    e.stopPropagation()
    const {minions, onClickAction} = this.props
    const {host, isRunning} = minions

    onClickAction(host, isRunning)
  }
  private get TableRowEachPage(): JSX.Element {
    const {minions} = this.props
    const {osVersion, os, ip, host, isRunning} = minions
    const {
      HostWidth,
      OSWidth,
      OSVersionWidth,
      IPWidth,
      ActionWidth,
    } = AGENT_CONFIGURATION_TABLE_SIZING

    return (
      <div
        className={this.focusedClasses(host)}
        onClick={this.handleOnClickTableRow}
      >
        <div className="hosts-table--td" style={{width: HostWidth}}>
          {host}
        </div>

        <div className="hosts-table--td" style={{width: OSWidth}}>
          <OSIndicator os={os} />
        </div>

        <div className="hosts-table--td" style={{width: OSVersionWidth}}>
          {osVersion}
        </div>

        <div className="hosts-table--td" style={{width: IPWidth}}>
          {ip}
        </div>

        <div className="hosts-table--td" style={{width: ActionWidth}}>
          <button
            className="btn btn-default action-call"
            onClick={this.handleOnClickAction}
          >
            <>{isRunning === true ? '■' : '▶'}</>
          </button>
        </div>
      </div>
    )
  }
}

export default AgentConfigurationTableRow
