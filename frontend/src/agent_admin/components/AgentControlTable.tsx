// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'

// Components
import AgentControlTableRow from 'src/agent_admin/components/AgentControlTableRow'
import SearchBar from 'src/hosts/components/SearchBar'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import PageSpinner from 'src/shared/components/PageSpinner'
import AgentControlModal from 'src/agent_admin/components/AgentControlModal'

// Contants
import {AGENT_TABLE_SIZING} from 'src/agent_admin/constants/tableSizing'

// Types
import {RemoteDataState} from 'src/types'
import {Minion} from 'src/agent_admin/type'

// Decorator
import {ErrorHandling} from 'src/shared/decorators/errors'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface Props {
  minions: Minion[]
  controlPageStatus: RemoteDataState
  isAllCheck: boolean
  onClickAction: (host: string, isRunning: boolean) => () => void
  onClickRun: () => void
  onClickStop: () => void
  onClickInstall: () => void
  handleAllCheck: ({_this: object}) => void
  handleMinionCheck: ({_this: object}) => void
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
}

@ErrorHandling
class AgentControlTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      searchTerm: '',
      sortDirection: SortDirection.ASC,
      sortKey: 'name',
    }
  }

  public getSortedHosts = memoize(
    (
      minions: Minion[],
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection.ASC
    ) => this.sort(this.filter(minions, searchTerm), sortKey, sortDirection)
  )

  public filter(allHosts: Minion[], searchTerm: string): Minion[] {
    const filterText = searchTerm.toLowerCase()
    return allHosts.filter(h => {
      return h.host.toLowerCase().includes(filterText)
    })
  }

  public sort(
    hosts: Minion[],
    key: string,
    direction: SortDirection
  ): Minion[] {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy(hosts, e => e[key])
      case SortDirection.DESC:
        return _.sortBy(hosts, e => e[key]).reverse()
      default:
        return hosts
    }
  }

  public updateSearchTerm = (searchTerm: string): void => {
    this.setState({searchTerm})
  }

  public updateSort = (key: string) => () => {
    const {sortKey, sortDirection} = this.state
    if (sortKey === key) {
      const reverseDirection =
        sortDirection === SortDirection.ASC
          ? SortDirection.DESC
          : SortDirection.ASC
      this.setState({sortDirection: reverseDirection})
    } else {
      this.setState({sortKey: key, sortDirection: SortDirection.ASC})
    }
  }

  public sortableClasses = (key: string): string => {
    const {sortKey, sortDirection} = this.state
    if (sortKey === key) {
      if (sortDirection === SortDirection.ASC) {
        return 'hosts-table--th sortable-header sorting-ascending'
      }
      return 'hosts-table--th sortable-header sorting-descending'
    }
    return 'hosts-table--th sortable-header'
  }

  private get AgentTableHeader(): JSX.Element {
    return this.AgentTableHeaderEachPage
  }

  private get AgentTableContents(): JSX.Element {
    const {minions, controlPageStatus} = this.props

    if (controlPageStatus === RemoteDataState.Error) {
      return this.ErrorState
    }
    if (controlPageStatus === RemoteDataState.Done && minions.length === 0) {
      return this.NoHostsState
    }
    if (controlPageStatus === RemoteDataState.Done && minions.length === 0) {
      return this.NoSortedHostsState
    }

    return this.AgentTableWithHosts
  }

  private get LoadingState(): JSX.Element {
    return (
      <div className="agent--state agent--loding-state">
        <PageSpinner />
      </div>
    )
  }

  private get ErrorState(): JSX.Element {
    return (
      <div className="agent--state generic-empty-state">
        <h4 style={{margin: '90px 0'}}>There was a problem loading hosts</h4>
      </div>
    )
  }

  private get NoHostsState(): JSX.Element {
    return (
      <div className="agent--state generic-empty-state">
        <h4 style={{margin: '90px 0'}}>No Hosts found</h4>
      </div>
    )
  }

  private get NoSortedHostsState(): JSX.Element {
    return (
      <div className="agent--state generic-empty-state">
        <h4 style={{margin: '90px 0'}}>
          There are no hosts that match the search criteria
        </h4>
      </div>
    )
  }

  public render() {
    const {
      onClickRun,
      onClickStop,
      onClickInstall,
      controlPageStatus,
      minions,
    } = this.props

    const isCheckedMinions = !(
      minions.filter(m => m.isCheck === true).length > 0
    )

    return (
      <div className="panel">
        {controlPageStatus === RemoteDataState.Loading
          ? this.LoadingState
          : null}
        <div className="panel-heading">
          <h2 className="panel-title">{this.AgentTitle}</h2>
          <SearchBar
            placeholder="Filter by Host..."
            onSearch={this.updateSearchTerm}
          />
        </div>
        <div className="panel-body">{this.AgentTableContents}</div>
        <div className="pabel-body--agent-control">
          <AgentControlModal
            disabled={isCheckedMinions}
            minions={minions}
            name={'RUN'}
            message={'running agents included. keep going?'}
            buttonClassName={'btn btn-inline_block btn-default agent--btn'}
            cancelText={'Cancel'}
            confirmText={'OK'}
            onCancel={() => {}}
            onConfirm={onClickRun.bind(this)}
          />

          <AgentControlModal
            disabled={isCheckedMinions}
            minions={minions}
            name={'STOP'}
            message={'stoped agents included. keep going?'}
            buttonClassName={'btn btn-inline_block btn-default agent--btn'}
            cancelText={'Cancel'}
            confirmText={'Go STOP'}
            onCancel={() => {}}
            onConfirm={onClickStop.bind(this)}
          />

          <AgentControlModal
            disabled={isCheckedMinions}
            minions={minions}
            name={'INSTALL'}
            message={'Agents with Telegraf installed are included. keep going?'}
            buttonClassName={'btn btn-inline_block btn-default agent--btn'}
            cancelText={'Cancel'}
            confirmText={'OK'}
            onCancel={() => {}}
            onConfirm={onClickInstall.bind(this)}
          />
        </div>
      </div>
    )
  }

  private getHandleAllCheck = () => {
    const {handleAllCheck} = this.props
    return handleAllCheck({_this: this})
  }

  private get AgentTitle() {
    const {minions} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state
    const sortedHosts = this.getSortedHosts(
      minions,
      searchTerm,
      sortKey,
      sortDirection
    )

    const hostsCount = sortedHosts.length
    if (hostsCount === 1) {
      return `1 Minions`
    }
    return `${hostsCount} Minions`
  }

  private get AgentTableHeaderEachPage() {
    const {isAllCheck} = this.props
    const {CheckWidth, IPWidth, HostWidth, StatusWidth} = AGENT_TABLE_SIZING
    return (
      <div className="hosts-table--thead">
        <div className="hosts-table--tr">
          <div style={{width: CheckWidth}} className="hosts-table--th">
            <input
              type="checkbox"
              checked={isAllCheck}
              onClick={this.getHandleAllCheck}
              readOnly
            />
          </div>
          <div
            onClick={this.updateSort('name')}
            className={this.sortableClasses('name')}
            style={{width: HostWidth}}
          >
            Host
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('OS')}
            className={this.sortableClasses('OS')}
            style={{width: IPWidth}}
          >
            OS
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('OSVersion')}
            className={this.sortableClasses('OSVersion')}
            style={{width: IPWidth}}
          >
            OS Version
            <span className="icon caret-up" />
          </div>

          <div
            onClick={this.updateSort('ip')}
            className={this.sortableClasses('ip')}
            style={{width: IPWidth}}
          >
            IP
            <span className="icon caret-up" />
          </div>
          <div
            className="hosts-table--th list-type"
            style={{width: StatusWidth}}
          >
            Enabled
          </div>
          <div
            className={this.sortableClasses('cpu')}
            style={{width: StatusWidth}}
          >
            Action
          </div>
        </div>
      </div>
    )
  }

  private get AgentTableWithHosts() {
    const {minions, onClickAction, isAllCheck, handleMinionCheck} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    const sortedHosts: [] = this.getSortedHosts(
      minions,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <div className="hosts-table">
        {this.AgentTableHeader}
        {sortedHosts.length > 0 ? (
          <FancyScrollbar
            children={sortedHosts.map(
              (m: Minion, i: number): JSX.Element => (
                <AgentControlTableRow
                  key={i}
                  minions={m}
                  isCheck={m.isCheck}
                  isAllCheck={isAllCheck}
                  onClickAction={onClickAction}
                  handleMinionCheck={handleMinionCheck}
                />
              )
            )}
            className="hosts-table--tbody"
          />
        ) : null}
      </div>
    )
  }
}

export default AgentControlTable
