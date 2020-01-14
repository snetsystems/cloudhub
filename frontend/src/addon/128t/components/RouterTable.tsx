import React, {PureComponent} from 'react'

import _ from 'lodash'
import memoize from 'memoize-one'

import SearchBar from 'src/hosts/components/SearchBar'
import RouterTableRow from 'src/addon/128t/components/RouterTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

import {Router, TopSource, TopSession} from 'src/addon/128t/types'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {ROUTER_TABLE_SIZING} from 'src/addon/128t/constants'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface Props {
  routers: Router[]
  focusedAssetId: string
  onClickTableRow: (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedAssetId: string
  ) => () => void
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
  routerCount: string
  visible: boolean
}

@ErrorHandling
class RouterTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      searchTerm: '',
      sortDirection: SortDirection.ASC,
      sortKey: 'assetId',
      routerCount: '0',
      visible: true,
    }
  }

  public getSortedRouters = memoize(
    (
      routers: Router[],
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ) => this.sort(this.filter(routers, searchTerm), sortKey, sortDirection)
  )

  public componentWillMount() {
    const {routers} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    const sortedRouters = this.getSortedRouters(
      routers,
      searchTerm,
      sortKey,
      sortDirection
    )

    this.setState({routerCount: sortedRouters.length})
  }

  private onClickHandleVisible = () => {
    this.setState({visible: !this.state.visible})
  }

  public render() {
    const {routerCount, visible} = this.state
    return (
      <div className={`panel ${visible ? 'panel-height' : ''}`}>
        <div className="panel-heading">
          <button
            onClick={this.onClickHandleVisible}
            style={{
              flex: 'none',
              padding: '5px 10px',
              marginRight: '10px',
              width: '30px',
              background: 'none',
              border: '0 none',
              color: '#555',
            }}
          >
            {visible ? '▼' : '▲'}
          </button>
          <h2
            className="panel-title"
            style={{
              flex: 'none',
            }}
          >
            {routerCount} Routers
          </h2>
          <span
            className={'panel-heading-dividebar'}
            style={{
              display: 'block',
              height: '2px',
              backgroundColor: 'rgb(56,56,70)',
              flex: 'auto',
              margin: '0 15px',
            }}
          ></span>
          <div style={{flex: 'none'}}>
            <SearchBar
              placeholder="Filter by Router..."
              onSearch={this.updateSearchTerm}
            />
          </div>
        </div>
        {visible ? (
          <div className="panel-body">
            <div className="hosts-table">
              <div className="hosts-table--thead">
                <div className={'hosts-table--tr'}>{this.TableHeader}</div>
              </div>
              {this.TableData}
            </div>
          </div>
        ) : (
          ''
        )}
      </div>
    )
  }

  private get TableHeader() {
    const {
      ASSETID,
      LOCATIONCOORDINATES,
      MANAGEMENTCONNECTED,
      BANDWIDTH_AVG,
      SESSION_CNT_AVG,
      ENABLED,
      ROLE,
      STARTTIME,
      SOFTWAREVERSION,
      MEMORYUSAGE,
      CPUUSAGE,
      DISKUSAGE,
    } = ROUTER_TABLE_SIZING
    return (
      <>
        <div
          onClick={this.updateSort('assetId')}
          className={this.sortableClasses('assetId')}
          style={{width: ASSETID}}
        >
          Asset ID
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('role')}
          className={this.sortableClasses('role')}
          style={{width: ROLE}}
        >
          Role
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('enabled')}
          className={this.sortableClasses('enabled')}
          style={{width: ENABLED}}
        >
          Enabled
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('locationCoordinates')}
          className={this.sortableClasses('locationCoordinates')}
          style={{width: LOCATIONCOORDINATES}}
        >
          Location Coordinates
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('managementConnected')}
          className={this.sortableClasses('managementConnected')}
          style={{width: MANAGEMENTCONNECTED}}
        >
          Connected
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('startTime')}
          className={this.sortableClasses('startTime')}
          style={{width: STARTTIME}}
        >
          Uptime
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('softwareVersion')}
          className={this.sortableClasses('softwareVersion')}
          style={{width: SOFTWAREVERSION}}
        >
          Version
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('cpuUsage')}
          className={this.sortableClasses('cpuUsage')}
          style={{width: CPUUSAGE}}
        >
          CPU
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('memoryUsage')}
          className={this.sortableClasses('memoryUsage')}
          style={{width: MEMORYUSAGE}}
        >
          Memory
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('diskUsage')}
          className={this.sortableClasses('diskUsage')}
          style={{width: DISKUSAGE}}
        >
          Disk(/)
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('bandwidth_avg')}
          className={this.sortableClasses('bandwidth_avg')}
          style={{width: BANDWIDTH_AVG}}
        >
          Avg. B/W
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('session_arrivals')}
          className={this.sortableClasses('session_arrivals')}
          style={{width: SESSION_CNT_AVG}}
        >
          Session Arrivals
          <span className="icon caret-up" />
        </div>
      </>
    )
  }

  // data add
  private get TableData() {
    const {routers, focusedAssetId, onClickTableRow} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    //const sortedRouters = routers
    const sortedRouters = this.getSortedRouters(
      routers,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <FancyScrollbar
        children={sortedRouters.map((r: Router, i: number) => (
          <RouterTableRow
            onClickTableRow={onClickTableRow}
            focusedAssetId={focusedAssetId}
            router={r}
            key={i}
          />
        ))}
      />
    )
  }

  public filter(allrouters: Router[], searchTerm: string) {
    const filterText = searchTerm.toLowerCase()
    return allrouters.filter(h => {
      return h.assetId.toLowerCase().includes(filterText)
    })
  }

  public sort(allrouters: Router[], key: string, direction: SortDirection) {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy(allrouters, e => e[key])
      case SortDirection.DESC:
        return _.sortBy(allrouters, e => e[key]).reverse()
      default:
        return allrouters
    }
  }

  public updateSearchTerm = (searchTerm: string) => {
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
}

export default RouterTable
