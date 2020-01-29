// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'

// import SearchBar from 'src/hosts/components/SearchBar'
import GridLayoutSearchBar from 'src/addon/128t/components/GridLayoutSearchBar'
import TopSessionsTableRow from 'src/addon/128t/components/TopSessionsTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {
  NoHostsState,
  sortableClasses,
  SortDirection,
} from 'src/addon/128t/reusable'

import {
  CellName,
  HeadingBar,
  PanelHeader,
  Panel,
  PanelBody,
  Table,
  TableHeader,
  TableBody,
} from 'src/addon/128t/reusable/layout'

//type
import {TopSession} from 'src/addon/128t/types'

// constants
import {TOPSESSIONS_TABLE_SIZING} from 'src/addon/128t/constants'

// Error Handler
import {ErrorHandling} from 'src/shared/decorators/errors'

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
    const sortedTopSessions: TopSession[] = this.getSortedTopSessions(
      topSessions,
      searchTerm,
      sortKey,
      sortDirection
    )
    this.setState({topSessionCount: sortedTopSessions.length})
  }

  public render() {
    const {
      isEditable,
      cellTextColor,
      cellBackgroundColor,
      topSessions,
    } = this.props
    return (
      <Panel>
        <PanelHeader isEditable={isEditable}>
          <CellName
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            value={topSessions}
            name={'Top Sources'}
          />
          <HeadingBar
            isEditable={isEditable}
            cellBackgroundColor={cellBackgroundColor}
          />
          <GridLayoutSearchBar
            placeholder="Filter by Tenant..."
            onSearch={this.updateSearchTerm}
          />
        </PanelHeader>
        <PanelBody>
          <Table>
            <TableHeader>{this.TableHeader}</TableHeader>
            <TableBody>{this.TableData}</TableBody>
          </Table>
        </PanelBody>
      </Panel>
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
    const {sortKey, sortDirection} = this.state
    return (
      <>
        <div
          onClick={this.updateSort('service')}
          className={sortableClasses({sortKey, sortDirection, key: 'service'})}
          style={{width: TOPSESSION_SERVICE}}
        >
          Service
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('tenant')}
          className={sortableClasses({sortKey, sortDirection, key: 'tenant'})}
          style={{width: TOPSESSION_TENANT}}
        >
          Tenant
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('value')}
          className={sortableClasses({sortKey, sortDirection, key: 'value'})}
          style={{width: TOPSESSION_VALUE}}
        >
          Value
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('protocol')}
          className={sortableClasses({sortKey, sortDirection, key: 'protocol'})}
          style={{width: TOPSESSION_PROTOCOL}}
        >
          Protocol
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('source.address')}
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'source.address',
          })}
          style={{width: TOPSESSION_SOURCE_ADDRESS}}
          title="Source Address"
        >
          S/A
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('source.port')}
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'sourcePort',
          })}
          style={{width: TOPSESSION_SOURCE_PORT}}
          title="Source Port"
        >
          S/P
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('destination.address')}
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'destination.address',
          })}
          style={{width: TOPSESSION_DESTINATION_ADDRESS}}
          title="Destination Address"
        >
          D/A
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('destination.port')}
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'destination.port',
          })}
          style={{width: TOPSESSION_DESTINATION_PORT}}
          title="Destination Port"
        >
          D/P
          <span className="icon caret-up" />
        </div>
      </>
    )
  }

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

  private filter(allTopSessions: TopSession[], searchTerm: string) {
    const filterText = searchTerm.toLowerCase()
    return allTopSessions.filter(h => {
      return h.tenant.toLowerCase().includes(filterText)
    })
  }

  private sort(allTopSessions: TopSession[], key: string, direction: string) {
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

  private updateSearchTerm = (searchTerm: string) => {
    this.setState({searchTerm})
  }

  private updateSort = (key: string) => (): void => {
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
}

export default TopSessionsTable
