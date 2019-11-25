import React, {PureComponent} from 'react'

import _ from 'lodash'
import memoize from 'memoize-one'

import SearchBar from 'src/hosts/components/SearchBar'
import AgentTableRow from 'src/agent_admin/components/AgentTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

import PageSpinner from 'src/shared/components/PageSpinner'

import {AGENT_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

import {Source, RemoteDataState, Host} from 'src/types'

import {ErrorHandling} from 'src/shared/decorators/errors'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface Props {
  hosts: Host[]
  hostsPageStatus: RemoteDataState
  source: Source
  focusedHost: string
  currentUrl: string
}
interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
}

@ErrorHandling
class AgentTable extends PureComponent<State> {
  private allCheck = React.createRef()
  constructor(props) {
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
        h.host.toLowerCase().includes(filterText) ||
        apps.toLowerCase().includes(filterText) ||
        tagResult
      )
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
        {this.pageProcess}
      </div>
    )
  }

  private get agentControlTemp() {
    const {onClickRun, onClickStop, onClickInstall} = this.props

    return (
      <div
        className=""
        style={{
          padding: '20px',
          paddingTop: '0px',
          textAlign: 'right',
        }}
      >
        <button
          className="btn btn-inline_block btn-default"
          onClick={onClickRun.bind(this)}
        >
          RUN
        </button>
        <button
          className="btn btn-inline_block btn-default"
          onClick={onClickStop.bind(this)}
          style={{
            marginLeft: '5px',
          }}
        >
          STOP
        </button>
        <button
          className="btn btn-inline_block btn-default"
          onClick={onClickInstall.bind(this)}
          style={{
            marginLeft: '5px',
          }}
        >
          INSTALL
        </button>
      </div>
    )
  }

  private get pageProcess() {
    const {currentUrl} = this.props
    switch (currentUrl) {
      case 'agent-minions':
        return ''
      case 'agent-control':
        return this.agentControlTemp
      case 'agent-configuration':
        return this.agentConfigTemp
      case 'agent-log':
        return ''
      default:
        break
    }
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
    const {currentUrl} = this.props
    const {CheckWidth, NameWidth, IPWidth, StatusWidth} = AGENT_TABLE_SIZING
    return (
      <div className="hosts-table--thead">
        <div className="hosts-table--tr">
          {currentUrl === 'agent-control' ? (
            <div style={{width: CheckWidth}} className="hosts-table--th">
              <input
                type="checkbox"
                id="allCheck"
                ref={this.allCheck.current}
                onClick={this.handleAllCheck}
              />
            </div>
          ) : (
            ''
          )}
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

          {currentUrl === 'agent-control' || currentUrl === 'agent-log' ? (
            <div
              className="hosts-table--th list-type"
              style={{width: StatusWidth}}
            >
              Installed
            </div>
          ) : (
            ''
          )}

          {currentUrl === 'agent-configuration' ? (
            <div
              className="hosts-table--th list-type"
              style={{width: StatusWidth}}
            >
              Save File
            </div>
          ) : (
            ''
          )}

          {currentUrl != 'agent-minions' ? (
            <div
              className={this.sortableClasses('cpu')}
              style={{width: StatusWidth}}
            >
              Action
            </div>
          ) : (
            ''
          )}

          {currentUrl === 'agent-minions' || currentUrl === 'agent-log' ? (
            <div
              onClick={this.updateSort('load')}
              className={this.sortableClasses('load')}
              style={{width: StatusWidth}}
            >
              Status
              <span className="icon caret-up" />
            </div>
          ) : (
            ''
          )}

          {currentUrl === 'agent-minions' ? (
            <div
              className="hosts-table--th list-type"
              style={{width: StatusWidth}}
            >
              select
            </div>
          ) : (
            ''
          )}
        </div>
      </div>
    )
  }
  private handleAllCheck() {
    return console.log(this)
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
    const {
      currentUrl,
      minions,
      onClickTableRow,
      onClickAction,
      onClickModal,
    } = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    const filteredMinion = minions.filter(m => m.isAccept === true)

    const sortedHosts = this.getSortedHosts(
      currentUrl !== 'agent-minions' ? filteredMinion : minions,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <div className="hosts-table">
        {this.AgentTableHeader}
        <FancyScrollbar
          children={sortedHosts.map((m, i) => (
            <AgentTableRow
              key={i}
              minion={m}
              currentUrl={currentUrl}
              onClickTableRow={onClickTableRow}
              onClickAction={onClickAction}
              onClickModal={onClickModal}
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

export default AgentTable
