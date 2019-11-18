import React, {PureComponent} from 'react'

import _ from 'lodash'
import memoize from 'memoize-one'

import SearchBar from 'src/hosts/components/SearchBar'
import AgentConfigurationTableRow from 'src/agent_admin/components/AgentConfigurationTableRow'
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
  onClickTableRow: () => void
  onClickAction: () => void
  // onClickRun: () => void
  // onClickStop: () => void
  // onClickInstall: () => void
  // handleWheelKeyCommand: () => void
}
interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
}

@ErrorHandling
class AgentConfigurationTable extends PureComponent<Props, State> {
  private allCheck = React.createRef()

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

  public render() {
    // const {onClickRun, onClickStop, onClickInstall} = this.props

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

  private handleAllCheck() {
    return console.log(this)
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
            className="hosts-table--th list-type"
            style={{width: StatusWidth}}
          >
            Installed
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

  private get AgentTableContents() {
    const {minions} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    const sortedHosts = this.getSortedHosts(
      minions,
      searchTerm,
      sortKey,
      sortDirection
    )

    if (minions.length === 0) {
      return this.NoHostsState
    }
    if (sortedHosts.length === 0) {
      return this.NoSortedHostsState
    }

    return this.AgentTableWithHosts
  }

  private get AgentTableWithHosts() {
    const {minions, onClickTableRow, onClickAction} = this.props
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
            <AgentConfigurationTableRow
              key={i}
              minions={m}
              onClickTableRow={onClickTableRow}
              onClickAction={onClickAction}
            />
          ))}
          itemHeight={26}
          className="hosts-table--tbody"
        />
      </div>
    )
  }

  private get NoHostsState() {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>No Hosts found</h4>
      </div>
    )
  }

  private get NoSortedHostsState() {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>
          There are no hosts that match the search criteria
        </h4>
      </div>
    )
  }
}

export default AgentConfigurationTable
