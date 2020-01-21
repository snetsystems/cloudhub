// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'
import classnames from 'classnames'
import chroma from 'chroma-js'

// import SearchBar from 'src/hosts/components/SearchBar'
import GridLayoutSearchBar from 'src/addon/128t/components/GridLayoutSearchBar'
import TopSessionsTableRow from 'src/addon/128t/components/TopSessionsTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {NoHostsState} from 'src/addon/128t/reusable'

//type
import {TopSession} from 'src/addon/128t/types'

// constants
import {TOPSESSIONS_TABLE_SIZING} from 'src/addon/128t/constants'
import {DEFAULT_CELL_BG_COLOR} from 'src/dashboards/constants'

// Error Handler
import {ErrorHandling} from 'src/shared/decorators/errors'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface Props {
  topSessions: TopSession[]
  isEditable: boolean
  cellBackgroundColor: string
  cellTextColor: string
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
  topSessionCount: number
}

@ErrorHandling
class TopSessionsTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      searchTerm: '',
      sortDirection: SortDirection.ASC,
      sortKey: 'service',
      topSessionCount: 0,
    }
  }

  public getSortedTopSessions = memoize(
    (
      topSessions: TopSession[],
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ) => {
      const sorted = this.sort(
        this.filter(topSessions, searchTerm),
        sortKey,
        sortDirection
      )
      return sorted
    }
  )

  public componentWillMount() {
    const {topSessions} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    this.setSessionCount(topSessions, searchTerm, sortKey, sortDirection)
  }

  public componentWillReceiveProps(nextProps: Props) {
    const {topSessions} = this.props
    if (topSessions === nextProps.topSessions) return
    const {sortKey, sortDirection, searchTerm} = this.state

    this.setSessionCount(
      nextProps.topSessions,
      searchTerm,
      sortKey,
      sortDirection
    )
  }

  private setSessionCount(
    topSessions: TopSession[],
    searchTerm: string,
    sortKey: string,
    sortDirection: SortDirection
  ) {
    const sortedTopSessions = this.getSortedTopSessions(
      topSessions,
      searchTerm,
      sortKey,
      sortDirection
    )
    this.setState({topSessionCount: sortedTopSessions.length})
  }

  public render() {
    return (
      <div className={`panel`}>
        <div className="panel-heading">
          <div className={this.headingClass}>
            {this.cellName}
            {this.headingBar}
            <GridLayoutSearchBar
              placeholder="Filter by Tenant..."
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
      TOPSESSION_SERVICE,
      TOPSESSION_TENANT,
      TOPSESSION_VALUE,
      TOPSESSION_PROTOCOL,
      TOPSESSION_SOURCE_ADDRESS,
      TOPSESSION_SOURCE_PORT,
      TOPSESSION_DESTINATION_ADDRESS,
      TOPSESSION_DESTINATION_PORT,
    } = TOPSESSIONS_TABLE_SIZING
    return (
      <>
        <div
          onClick={this.updateSort('service')}
          className={this.sortableClasses('service')}
          style={{width: TOPSESSION_SERVICE}}
        >
          Service
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('tenant')}
          className={this.sortableClasses('tenant')}
          style={{width: TOPSESSION_TENANT}}
        >
          Tenant
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('value')}
          className={this.sortableClasses('value')}
          style={{width: TOPSESSION_VALUE}}
        >
          Value
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('protocol')}
          className={this.sortableClasses('protocol')}
          style={{width: TOPSESSION_PROTOCOL}}
        >
          Protocol
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('source.address')}
          className={this.sortableClasses('source.address')}
          style={{width: TOPSESSION_SOURCE_ADDRESS}}
          title="Source Address"
        >
          S/A
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('source.port')}
          className={this.sortableClasses('sourcePort')}
          style={{width: TOPSESSION_SOURCE_PORT}}
          title="Source Port"
        >
          S/P
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('destination.address')}
          className={this.sortableClasses('destination.address')}
          style={{width: TOPSESSION_DESTINATION_ADDRESS}}
          title="Destination Address"
        >
          D/A
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('destination.port')}
          className={this.sortableClasses('destination.port')}
          style={{width: TOPSESSION_DESTINATION_PORT}}
          title="Destination Port"
        >
          D/P
          <span className="icon caret-up" />
        </div>
      </>
    )
  }

  // data add
  private get TableData() {
    const {topSessions} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    const sortedTopSessions = this.getSortedTopSessions(
      topSessions,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <>
        {topSessions.length > 0 ? (
          <FancyScrollbar
            children={sortedTopSessions.map(
              (r: TopSession, i: number): JSX.Element => (
                <TopSessionsTableRow topSessions={r} key={i} />
              )
            )}
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
    const {cellTextColor, cellBackgroundColor, topSessions} = this.props

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
          {topSessions.length} Top Sessions
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

  public filter(allTopSessions: TopSession[], searchTerm: string) {
    const filterText = searchTerm.toLowerCase()
    return allTopSessions.filter(h => {
      return h.tenant.toLowerCase().includes(filterText)
    })
  }

  public sort(allTopSessions: TopSession[], key: string, direction: string) {
    let dumpKey: string | string[] =
      key.indexOf('.') > -1 ? key.split('.') : key
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy(allTopSessions, e => {
          return Array.isArray(dumpKey) ? e[dumpKey[0]][dumpKey[1]] : e[dumpKey]
        })
      case SortDirection.DESC:
        return _.sortBy(allTopSessions, e => {
          return Array.isArray(dumpKey) ? e[dumpKey[0]][dumpKey[1]] : e[dumpKey]
        }).reverse()
      default:
        return allTopSessions
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

export default TopSessionsTable
