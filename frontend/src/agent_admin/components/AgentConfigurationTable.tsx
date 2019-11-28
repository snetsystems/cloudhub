// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'

// Components
import AgentConfiguration from 'src/agent_admin/containers/AgentConfiguration'
import AgentConfigurationTableRow from 'src/agent_admin/components/AgentConfigurationTableRow'
import SearchBar from 'src/hosts/components/SearchBar'
import PageSpinner from 'src/shared/components/PageSpinner'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

// Constants
import {AGENT_TABLE_SIZING} from 'src/agent_admin/constants/tableSizing'

// Types
import {RemoteDataState, Minion} from 'src/types'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

interface Props {
  minions: Minion[]
  configPageStatus: RemoteDataState
  onClickTableRow: AgentConfiguration['onClickTableRowCall']
  onClickAction: AgentConfiguration['onClickActionCall']
  focusedHost: string
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
}

@ErrorHandling
class AgentConfigurationTable extends PureComponent<Props, State> {
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
      minions,
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ) => this.sort(this.filter(minions, searchTerm), sortKey, sortDirection)
  )

  public filter(allHosts, searchTerm) {
    const filterText = searchTerm.toLowerCase()
    return allHosts.filter(h => {
      return h.host.toLowerCase().includes(filterText)
    })
  }

  public sort(hosts, key, direction) {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy(hosts, e => e[key])
      case SortDirection.DESC:
        return _.sortBy(hosts, e => e[key]).reverse()
      default:
        return hosts
    }
  }

  public updateSearchTerm = searchTerm => {
    this.setState({searchTerm})
  }

  public updateSort = key => () => {
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

  public sortableClasses = key => {
    const {sortKey, sortDirection} = this.state
    if (sortKey === key) {
      if (sortDirection === SortDirection.ASC) {
        return 'hosts-table--th sortable-header sorting-ascending'
      }
      return 'hosts-table--th sortable-header sorting-descending'
    }
    return 'hosts-table--th sortable-header'
  }

  private get AgentTableContents() {
    const {minions, configPageStatus} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    const sortedHosts = this.getSortedHosts(
      minions,
      searchTerm,
      sortKey,
      sortDirection
    )

    if (configPageStatus === RemoteDataState.Error) {
      return this.ErrorState
    }
    if (configPageStatus === RemoteDataState.Done && minions.length === 0) {
      return this.NoHostsState
    }
    if (configPageStatus === RemoteDataState.Done && sortedHosts.length === 0) {
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
        <h4>There was a problem loading hosts</h4>
      </div>
    )
  }

  private get NoHostsState(): JSX.Element {
    return (
      <div className="agent--state generic-empty-state">
        <h4>No Hosts found</h4>
      </div>
    )
  }

  private get NoSortedHostsState(): JSX.Element {
    return (
      <div className="agent--state generic-empty-state">
        <h4>There are no hosts that match the search criteria</h4>
      </div>
    )
  }

  public render() {
    const {configPageStatus} = this.props

    return (
      <div className="panel">
        {configPageStatus === RemoteDataState.Loading
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
      </div>
    )
  }

  private get AgentTitle() {
    const {minions} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state
    const filteredMinion = minions.filter(m => m.isInstall === true)

    const sortedHosts = this.getSortedHosts(
      filteredMinion,
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
    const {IPWidth, HostWidth, StatusWidth} = AGENT_TABLE_SIZING
    return (
      <div className="hosts-table--thead">
        <div className="hosts-table--tr">
          <div
            onClick={this.updateSort('name')}
            className={this.sortableClasses('name')}
            style={{width: HostWidth}}
          >
            Host
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('operatingSystem')}
            className={this.sortableClasses('operatingSystem')}
            style={{width: IPWidth}}
          >
            OS
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('operatingSystem')}
            className={this.sortableClasses('operatingSystem')}
            style={{width: IPWidth}}
          >
            OS Version
            <span className="icon caret-up" />
          </div>

          <div
            onClick={this.updateSort('deltaUptime')}
            className={this.sortableClasses('deltaUptime')}
            style={{width: IPWidth}}
          >
            IP
            <span className="icon caret-up" />
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

  private get AgentTableHeader() {
    return this.AgentTableHeaderEachPage
  }

  private get AgentTableWithHosts() {
    const {minions, onClickTableRow, onClickAction, focusedHost} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state
    const filteredMinion = minions.filter(m => m.isInstall === true)

    const sortedHosts = this.getSortedHosts(
      filteredMinion,
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
                <AgentConfigurationTableRow
                  key={i}
                  minions={m}
                  onClickTableRow={onClickTableRow}
                  onClickAction={onClickAction}
                  focusedHost={focusedHost}
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

export default AgentConfigurationTable
