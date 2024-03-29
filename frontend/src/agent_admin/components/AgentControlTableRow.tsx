// Libraries
import React, {MouseEvent, PureComponent} from 'react'
import _ from 'lodash'

// Components
import {AgentControl} from 'src/agent_admin/containers/AgentControl'
import {OSIndicator} from 'src/agent_admin/components/AgentIndicator'
import {TableBodyRowItem} from 'src/agent_admin/reusable/'

// Constants
import {AGENT_CONTROL_TABLE_SIZING} from 'src/agent_admin/constants/tableSizing'

// Types
import {Minion} from 'src/agent_admin/type'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  minions: Minion
  isCheck: boolean
  isAllCheck: boolean
  handleMinionCheck: AgentControl['handleMinionCheck']
  onClickAction: AgentControl['onClickActionCall']
  onMouseOver: (event: MouseEvent<HTMLElement>, minionIPAddress: string) => void
  onMouseLeave: () => void
}

@ErrorHandling
class AgentControlTableRow extends PureComponent<Props> {
  public focusedClasses = (): string =>
    Boolean(this.props.isCheck) ? 'hosts-table--tr focused' : 'hosts-table--tr'

  public getHandleMinionCheck = (event: React.MouseEvent<HTMLInputElement>) => {
    event.stopPropagation()
    return this.props.handleMinionCheck({_this: this})
  }

  public render() {
    return this.TableRowEachPage
  }

  private get TableRowEachPage() {
    const {minions, isCheck, onMouseLeave, onMouseOver} = this.props
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
    const minionIPAddresses = ip.split(',')
    const isMultipleIPAddress = ip !== '' && minionIPAddresses.length > 1
    const minionIPAddress = isMultipleIPAddress
      ? `${minionIPAddresses[0]},...`
      : ip

    return (
      <div className={this.focusedClasses()}>
        <TableBodyRowItem
          title={
            <div className="dark-checkbox">
              <input
                id={`agent-control--${host}`}
                type="checkbox"
                checked={Boolean(isCheck)}
                onClick={this.getHandleMinionCheck}
                readOnly
              />
              <label htmlFor={`agent-control--${host}`} />
            </div>
          }
          width={CheckWidth}
        />
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
