import React, {PureComponent} from 'react'

import _ from 'lodash'
import memoize from 'memoize-one'

import SearchBar from 'src/hosts/components/SearchBar'
import AgentMinionsTableRow from 'src/agent_admin/components/AgentMinionsTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

import PageSpinner from 'src/shared/components/PageSpinner'

import {AGENT_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

import {Source, RemoteDataState, Minion} from 'src/types'

import {ErrorHandling} from 'src/shared/decorators/errors'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}
export interface Props {
  minions: Minion[]
  minionsPageStatus: RemoteDataState
  onClickTableRow: () => void
  onClickModal: ({}) => object
  handleWheelKeyCommand: () => void
  focusedHost: string
}
interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
}

@ErrorHandling
class AgentMinionsTable extends PureComponent<Props, State> {
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
      // const apps = h.apps ? h.apps.join(', ') : ''

      // let tagResult = false
      // if (h.tags) {
      //   tagResult = Object.keys(h.tags).reduce((acc, key) => {
      //     return acc || h.tags[key].toLowerCase().includes(filterText)
      //   }, false)
      // } else {
      //   tagResult = false
      // }
      return h.host.toLowerCase().includes(filterText)
      // apps.toLowerCase().includes(filterText) ||
      // tagResult
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

  public componentWillMount() {}

  public componentDidMount() {}

  public componentWillUnmount() {}

  private get AgentTableHeader() {
    return this.AgentTableHeaderEachPage
  }

  private get AgentTableContents() {
    const {minions, minionsPageStatus} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    const sortedHosts = this.getSortedHosts(
      minions,
      searchTerm,
      sortKey,
      sortDirection
    )

    if (minionsPageStatus === RemoteDataState.Loading) {
      return this.LoadingState
    }
    if (minionsPageStatus === RemoteDataState.Error) {
      return this.ErrorState
    }
    if (minions.length === 0) {
      return this.NoHostsState
    }
    if (sortedHosts.length === 0) {
      return this.NoSortedHostsState
    }

    return this.AgentTableWithHosts
  }

  private get LoadingState(): JSX.Element {
    return <PageSpinner />
  }

  private get ErrorState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>There was a problem loading hosts</h4>
      </div>
    )
  }

  private get NoHostsState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>No Hosts found</h4>
      </div>
    )
  }

  private get NoSortedHostsState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>
          There are no hosts that match the search criteria
        </h4>
      </div>
    )
  }

  public render() {
    return (
      <div className="panel">
        <div className="panel-heading">
          <h2 className="panel-title">{this.AgentTitle}</h2>
          <SearchBar
            placeholder="Filter by Minion..."
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
    const {
      CheckWidth,
      NameWidth,
      IPWidth,
      HostWidth,
      StatusWidth,
    } = AGENT_TABLE_SIZING
    return (
      <div className="hosts-table--thead">
        <div className="hosts-table--tr">
          <div
            onClick={this.updateSort('name')}
            className={this.sortableClasses('name')}
            style={{width: NameWidth}}
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
            onClick={this.updateSort('load')}
            className={this.sortableClasses('load')}
            style={{width: StatusWidth}}
          >
            Status
            <span className="icon caret-up" />
          </div>
          <div
            className="hosts-table--th list-type"
            style={{width: StatusWidth}}
          >
            select
          </div>
        </div>
      </div>
    )
  }

  private get AgentTableWithHosts() {
    const {
      minions,
      onClickTableRow,
      onClickModal,
      handleWheelKeyCommand,
      focusedHost,
    } = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    const sortedHosts = this.getSortedHosts(
      minions,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <div className="hosts-table">
        {this.AgentTableHeader}
        <FancyScrollbar
          children={sortedHosts.map((m, i) => (
            <AgentMinionsTableRow
              key={i}
              minions={m}
              onClickTableRow={onClickTableRow}
              onClickModal={onClickModal}
              handleWheelKeyCommand={handleWheelKeyCommand}
              focusedHost={focusedHost}
            />
          ))}
          itemHeight={26}
          className="hosts-table--tbody"
        />
      </div>
    )
  }
}

export default AgentMinionsTable
