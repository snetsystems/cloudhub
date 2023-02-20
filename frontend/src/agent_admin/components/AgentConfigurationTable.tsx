// Libraries
import React, {PureComponent, MouseEvent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'

// Components
import {AgentConfiguration} from 'src/agent_admin/containers/AgentConfiguration'
import AgentConfigurationTableRow from 'src/agent_admin/components/AgentConfigurationTableRow'
import SearchBar from 'src/hosts/components/SearchBar'
import PageSpinner from 'src/shared/components/PageSpinner'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import AgentMinionsToolTip from 'src/agent_admin/components/AgentMinionsToolTip'

// Constants
import {AGENT_CONFIGURATION_TABLE_SIZING} from 'src/agent_admin/constants/tableSizing'

// Types
import {RemoteDataState} from 'src/types'
import {Minion, SortDirection} from 'src/agent_admin/type'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  minions: Minion[]
  configPageStatus: RemoteDataState
  onClickTableRow: AgentConfiguration['onClickTableRowCall']
  onClickAction: AgentConfiguration['onClickActionCall']
  focusedHost: string
  isCollectorInstalled: boolean
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
  isToolipActive: boolean
  targetPosition: {width: number; top: number; right: number; left: number}
  minionIPAdress: string
}

@ErrorHandling
class AgentConfigurationTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      searchTerm: '',
      sortDirection: SortDirection.ASC,
      sortKey: 'host',
      isToolipActive: false,
      targetPosition: {width: 0, top: 0, right: 0, left: 0},
      minionIPAdress: '',
    }
  }

  public getSortedHosts = memoize(
    (
      minions: Minion[],
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
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

  private get AgentTableContents(): JSX.Element {
    const {minions, configPageStatus, isCollectorInstalled} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    const sortedHosts: Minion[] = this.getSortedHosts(
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

    if (configPageStatus === RemoteDataState.Done && !isCollectorInstalled) {
      return this.NoInstalledCollector
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

  private get NoInstalledCollector(): JSX.Element {
    return (
      <div className="agent--state generic-empty-state">
        <h4 style={{margin: '90px 0'}}>There is no installed collector.</h4>
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
          <span>
            This feature is{' '}
            <span className="caution-word">not supported yet</span> for Windows.
          </span>
          <SearchBar
            placeholder="Filter by Host..."
            onSearch={this.updateSearchTerm}
          />
        </div>
        <div className="panel-body">{this.AgentTableContents}</div>
      </div>
    )
  }

  private get AgentTitle(): string {
    const {minions} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state
    const filteredMinion = minions.filter((m: Minion) => m.isInstall === true)

    const sortedHosts: [] = this.getSortedHosts(
      filteredMinion,
      searchTerm,
      sortKey,
      sortDirection
    )

    const hostsCount: number = sortedHosts.length
    if (hostsCount === 1) {
      return `1 Minions`
    }
    return `${hostsCount} Minions`
  }

  private get AgentTableHeaderEachPage() {
    const {
      HostWidth,
      OSWidth,
      OSVersionWidth,
      IPWidth,
      ActionWidth,
    } = AGENT_CONFIGURATION_TABLE_SIZING
    return (
      <div className="hosts-table--thead">
        <div className="hosts-table--tr">
          <div
            onClick={this.updateSort('host')}
            className={this.sortableClasses('host')}
            style={{width: HostWidth}}
          >
            Host
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('os')}
            className={this.sortableClasses('os')}
            style={{width: OSWidth}}
          >
            OS
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('osVersion')}
            className={this.sortableClasses('osVersion')}
            style={{width: OSVersionWidth}}
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
            style={{width: ActionWidth}}
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

  private onMouseOver = (
    event: MouseEvent<HTMLDivElement>,
    minionIPAddress: string
  ) => {
    const eventTarget = event.target as HTMLCanvasElement
    const {width, top, right, left} = eventTarget.getBoundingClientRect()

    this.setState({
      isToolipActive: true,
      targetPosition: {width, top, right, left},
      minionIPAdress: minionIPAddress,
    })
  }

  private onMouseLeave = () => {
    this.setState({
      isToolipActive: false,
      targetPosition: {top: null, right: null, left: null, width: null},
    })
  }

  private get tooltip() {
    const {isToolipActive, targetPosition, minionIPAdress} = this.state
    const minionIPAddresses = minionIPAdress.split(',')
    const isMultipleIPAddress =
      minionIPAdress !== '' && minionIPAddresses.length > 1

    if (isToolipActive && isMultipleIPAddress) {
      return (
        <AgentMinionsToolTip
          targetPosition={targetPosition}
          tooltipNode={minionIPAddresses}
        />
      )
    }
  }

  private get AgentTableWithHosts() {
    const {minions, onClickTableRow, onClickAction, focusedHost} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state
    const filteredMinion = minions.filter((m: Minion) => m.isInstall === true)

    const sortedHosts: [] = this.getSortedHosts(
      filteredMinion,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <div className="hosts-table">
        {this.AgentTableHeader}
        {this.tooltip}
        {sortedHosts.length > 0 ? (
          <FancyScrollbar
            children={sortedHosts.map(
              (m: Minion, i: number): JSX.Element =>
                m.os && m.os.toLocaleLowerCase() !== 'windows' ? (
                  <AgentConfigurationTableRow
                    key={i}
                    minions={m}
                    onClickTableRow={onClickTableRow}
                    onClickAction={onClickAction}
                    focusedHost={focusedHost}
                    onMouseLeave={this.onMouseLeave}
                    onMouseOver={this.onMouseOver}
                  />
                ) : null
            )}
            className="hosts-table--tbody"
          />
        ) : null}
      </div>
    )
  }
}

export default AgentConfigurationTable
