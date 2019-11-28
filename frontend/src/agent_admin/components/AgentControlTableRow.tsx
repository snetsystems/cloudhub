// Libraries
import React, {PureComponent} from 'react'

// Components
import AgentControl from 'src/agent_admin/containers/AgentControl'

// Constants
import {AGENT_TABLE_SIZING} from 'src/agent_admin/constants/tableSizing'

// Types
import {Minion} from 'src/types'

interface Props {
  minions: Minion
  isCheck: boolean
  isAllCheck: boolean
  handleMinionCheck: AgentControl['handleMinionCheck']
  onClickAction: AgentControl['onClickActionCall']
}

class AgentControlTableRow extends PureComponent<Props> {
  constructor(props) {
    super(props)
  }

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
    const {CheckWidth, StatusWidth, HostWidth, IPWidth} = AGENT_TABLE_SIZING

    return (
      <div className={this.focusedClasses()}>
        <div className="hosts-table--td" style={{width: CheckWidth}}>
          <input
            type="checkbox"
            checked={isCheck}
            onClick={this.getHandleMinionCheck}
            readOnly
          />
        </div>
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
          {isInstall === true ? 'Enable' : 'Disable'}
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

  private get handleOnClickAction() {
    const {minions, onClickAction} = this.props
    const {host, isRunning} = minions
    return onClickAction(host, isRunning)
  }
}

export default AgentControlTableRow
