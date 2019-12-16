// Libraries
import React, {PureComponent} from 'react'

// Components
import {AgentConfiguration} from 'src/agent_admin/containers/AgentConfiguration'

// Constants
import {AGENT_TABLE_SIZING} from 'src/agent_admin/constants/tableSizing'

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

  private get handleOnClickTableRow() {
    const {minions, onClickTableRow} = this.props
    const {ip, host} = minions

    return onClickTableRow(host, ip)
  }

  private get handleOnClickAction() {
    const {minions, onClickAction} = this.props
    const {host, isRunning} = minions

    return onClickAction(host, isRunning)
  }

  private get TableRowEachPage(): JSX.Element {
    const {minions} = this.props
    const {osVersion, os, ip, host, isRunning} = minions
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
          <button
            className="btn btn-default action-call"
            onClick={this.handleOnClickAction}
          >
            {isRunning === true ? <>■</> : <>▶</>}
          </button>
        </div>
      </div>
    )
  }
}

export default AgentConfigurationTableRow
