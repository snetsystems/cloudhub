// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'

//components
import SearchBar from 'src/hosts/components/SearchBar'
import HostRow from 'src/hosts/components/HostRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import PageSpinner from 'src/shared/components/PageSpinner'

//types
import {HOSTS_TABLE_SIZING} from 'src/hosts/constants/tableSizing'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {Source, RemoteDataState, Host} from 'src/types'
import {HostsPageHostTab} from 'src/hosts/containers/HostsPageHostTab'

//middlware
import {
  setLocalStorage,
  getLocalStorage,
  verifyLocalStorage,
} from 'src/shared/middleware/localStorage'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface Props {
  hosts: Host[]
  hostPageStatus: RemoteDataState
  source: Source
  focusedHost: string
  onClickTableRow: HostsPageHostTab['handleClickTableRow']
  tableTitle: () => JSX.Element
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
}

@ErrorHandling
class HostsTable extends PureComponent<Props, State> {
  public getSortedHosts = memoize(
    (
      hosts,
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ) => {
      return this.sort(this.filter(hosts, searchTerm), sortKey, sortDirection)
    }
  )

  constructor(props: Props) {
    super(props)

    this.state = {
      searchTerm: '',
      sortDirection: SortDirection.ASC,
      sortKey: 'name',
    }
  }

  public filter(allHosts: Host[], searchTerm: string): Host[] {
    const filterText = searchTerm.toLowerCase()
    return allHosts.filter(h => {
      const apps = h.apps ? h.apps.join(', ') : ''

      let tagResult = false
      if (h.tags) {
        tagResult = Object.keys(h.tags).reduce((acc, key) => {
          return acc || h.tags[key].toLowerCase().includes(filterText)
        }, false)
      } else {
        tagResult = false
      }
      return (
        h.name.toLowerCase().includes(filterText) ||
        apps.toLowerCase().includes(filterText) ||
        tagResult
      )
    })
  }

  public sort(hosts: Host[], key: string, direction: SortDirection): Host[] {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy<Host>(hosts, e => e[key])
      case SortDirection.DESC:
        return _.sortBy<Host>(hosts, e => e[key]).reverse()
      default:
        return hosts
    }
  }

  public updateSearchTerm = (searchTerm: string): void => {
    this.setState({searchTerm})
  }

  public updateSort = (key: string) => (): void => {
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

  public componentWillMount() {
    verifyLocalStorage(getLocalStorage, setLocalStorage, 'hostsTableState', {
      sortKey: this.state.sortKey,
      sortDirection: this.state.sortDirection,
      focusedHost: this.props.focusedHost,
    })

    const {sortKey, sortDirection} = getLocalStorage('hostsTableState')

    this.setState({
      sortKey,
      sortDirection,
    })
  }

  public componentDidUpdate() {
    setLocalStorage('hostsTableState', {
      sortKey: this.state.sortKey,
      sortDirection: this.state.sortDirection,
      focusedHost: this.props.focusedHost,
    })
  }

  public render() {
    return (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2 className="panel-title">{this.HostsTitle}</h2>
          </div>

          <div>
            <SearchBar
              placeholder="Filter by Host..."
              onSearch={this.updateSearchTerm}
            />
          </div>
        </div>
        <div className="panel-body">{this.TableContents}</div>
      </div>
    )
  }

  private get TableContents(): JSX.Element {
    const {hosts, hostPageStatus} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state
    const sortedHosts = this.getSortedHosts(
      hosts,
      searchTerm,
      sortKey,
      sortDirection
    )
    if (
      hostPageStatus === RemoteDataState.Loading ||
      hostPageStatus === RemoteDataState.NotStarted
    ) {
      return this.LoadingState
    }
    if (hostPageStatus === RemoteDataState.Error) {
      return this.ErrorState
    }
    if (hosts.length === 0) {
      return this.NoHostsState
    }
    if (sortedHosts.length === 0) {
      return this.NoSortedHostsState
    }
    return this.TableWithHosts
  }

  private get TableWithHosts(): JSX.Element {
    const {source, hosts, focusedHost, onClickTableRow} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state
    const sortedHosts = this.getSortedHosts(
      hosts,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <div className="hosts-table">
        {this.HostsTableHeader}
        <FancyScrollbar
          children={sortedHosts.map(h => (
            <HostRow
              key={h.name}
              host={h}
              sourceID={source.id}
              focusedHost={focusedHost}
              onClickTableRow={onClickTableRow}
            />
          ))}
          className="hosts-table--tbody"
        />
      </div>
    )
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

  private get HostsTitle(): JSX.Element {
    const {tableTitle} = this.props

    return tableTitle()
  }

  private get HostsTableHeader(): JSX.Element {
    const {NameWidth, StatusWidth, CPUWidth, LoadWidth} = HOSTS_TABLE_SIZING

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
            onClick={this.updateSort('deltaUptime')}
            className={this.sortableClasses('deltaUptime')}
            style={{width: StatusWidth}}
          >
            Status
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('cpu')}
            className={this.sortableClasses('cpu')}
            style={{width: CPUWidth}}
          >
            CPU
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('load')}
            className={this.sortableClasses('load')}
            style={{width: LoadWidth}}
          >
            Load
            <span className="icon caret-up" />
          </div>
          <div className="hosts-table--th list-type">Apps</div>
        </div>
      </div>
    )
  }
}

export default HostsTable
