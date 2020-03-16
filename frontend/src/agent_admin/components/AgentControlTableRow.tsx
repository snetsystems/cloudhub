// Libraries
import React, {PureComponent} from 'react'

// Components
import {AgentControl} from 'src/agent_admin/containers/AgentControl'
import {OSIndicator} from 'src/agent_admin/components/AgentIndicator'
import {TableBodyRowItem} from 'src/agent_admin/reusable/'

// Constants
import {AGENT_CONTROL_TABLE_SIZING} from 'src/agent_admin/constants/tableSizing'

// Types
import {Minion} from 'src/agent_admin/type'

interface Props {
  minions: Minion
  isCheck: boolean
  isAllCheck: boolean
  handleMinionCheck: AgentControl['handleMinionCheck']
  onClickAction: AgentControl['onClickActionCall']
}

class AgentControlTableRow extends PureComponent<Props> {
  public focusedClasses = (): string => {
    const {isCheck} = this.props
    return isCheck ? 'hosts-table--tr focused' : 'hosts-table--tr'
  }

  public getHandleMinionCheck = event => {
    event.stopPropagation()
    const {handleMinionCheck} = this.props
    return handleMinionCheck({_this: this})
  }

  public render() {
    return this.TableRowEachPage
  }

  private get TableRowEachPage() {
    const {minions, isCheck} = this.props
    const {osVersion, os, ip, host, isInstall, isRunning} = minions
    const {
      CheckWidth,
      StatusWidth,
      HostWidth,
      OSWidth,
      OSVersionWidth,
      IPWidth,
      ActionWidth,
    } = AGENT_CONTROL_TABLE_SIZING

    return (
      <div className={this.focusedClasses()}>
        <TableBodyRowItem
          title={
            <input
              type="checkbox"
              checked={isCheck}
              onClick={this.getHandleMinionCheck}
              readOnly
            />
          }
          width={CheckWidth}
        />
        <TableBodyRowItem title={host} width={HostWidth} />
        <TableBodyRowItem
          title={os ? <OSIndicator os={os} /> : ''}
          width={OSWidth}
        />
        <TableBodyRowItem title={osVersion} width={OSVersionWidth} />
        <TableBodyRowItem title={ip} width={IPWidth} />
        <TableBodyRowItem
          title={isInstall === true ? 'Enable' : 'Disable'}
          width={StatusWidth}
        />
        <TableBodyRowItem
          title={
            <button
              className="btn btn-default action-call"
              onClick={this.handleOnClickAction}
            >
              {isRunning === true ? <>■</> : <>▶</>}
            </button>
          }
          width={ActionWidth}
        />
      </div>
    )
  }

  private get handleOnClickAction() {
    const {minions, onClickAction} = this.props
    const {host, isRunning} = minions
    return onClickAction(host, isRunning)
  }
}

export default AgentControlTableRow
