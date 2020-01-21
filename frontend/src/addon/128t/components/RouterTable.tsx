// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'
import classnames from 'classnames'
import chroma from 'chroma-js'

// Components
import GridLayoutSearchBar from 'src/addon/128t/components/GridLayoutSearchBar'
import RouterTableRow from 'src/addon/128t/components/RouterTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {NoHostsState} from 'src/addon/128t/reusable'

//type
import {Router, TopSource, TopSession} from 'src/addon/128t/types'

// constants
import {ROUTER_TABLE_SIZING} from 'src/addon/128t/constants'
import {DEFAULT_CELL_BG_COLOR} from 'src/dashboards/constants'

// Error Handler
import {ErrorHandling} from 'src/shared/decorators/errors'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface Props {
  cellBackgroundColor: string
  cellTextColor: string
  isEditable: boolean
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

  public render() {
    return (
      <div className={`panel`}>
        <div className="panel-heading">
          <div className={this.headingClass}>
            {this.cellName}
            {this.headingBar}
            <GridLayoutSearchBar
              placeholder="Filter by Asset ID..."
              onSearch={this.updateSearchTerm}
            />
          </div>
        </div>
        <div className="panel-body">
          <div className="hosts-table">
            <div className="hosts-table--thead">
              <div className={'hosts-table--tr'}>{this.TableHeader}</div>
            </div>
            {this.TableData}
          </div>
        </div>
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

    const sortedRouters = this.getSortedRouters(
      routers,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <>
        {routers.length > 0 ? (
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
        ) : (
          <NoHostsState />
        )}
      </>
    )
  }

  private get headingClass() {
    const {isEditable} = this.props
    return classnames('dash-graph--heading', {
      'dash-graph--draggable dash-graph--heading-draggable': isEditable,
      'dash-graph--heading-draggable': isEditable,
    })
  }

  private get cellName(): JSX.Element {
    const {cellTextColor, cellBackgroundColor, routers} = this.props

    let nameStyle = {}

    if (cellBackgroundColor !== DEFAULT_CELL_BG_COLOR) {
      nameStyle = {
        color: cellTextColor,
      }
    }

    return (
      <>
        <h2
          className={`dash-graph--name grid-layout--draggable`}
          style={nameStyle}
        >
          {routers.length} Routers
        </h2>
      </>
    )
  }

  private get headingBar(): JSX.Element {
    const {isEditable, cellBackgroundColor} = this.props

    if (isEditable) {
      let barStyle = {}

      if (cellBackgroundColor !== DEFAULT_CELL_BG_COLOR) {
        barStyle = {
          backgroundColor: chroma(cellBackgroundColor).brighten(),
        }
      }

      return (
        <>
          <div className="dash-graph--heading-bar" style={barStyle} />
          <div className="dash-graph--heading-dragger" />
        </>
      )
    }
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
        const sortDesc = _.sortBy(
          allrouters,
          [e => e[key] || e[key] === 0],
          ['asc']
        ).reverse()
        return sortDesc
      default:
        return allrouters
    }
  }

  public updateSearchTerm = (searchTerm: string) => {
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
}

export default RouterTable
