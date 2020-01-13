import React, {PureComponent} from 'react'

import _ from 'lodash'
import memoize from 'memoize-one'

import TopSessionsTableRow from 'src/addon/128t/components/TopSessionsTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

import {TopSession} from 'src/addon/128t/types'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {TOPSESSIONS_TABLE_SIZING} from 'src/addon/128t/constants'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface Props {
  topSessions: TopSession[]
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
  topSessionCount: string
}

@ErrorHandling
class TopSessionsTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      searchTerm: '',
      sortDirection: SortDirection.ASC,
      sortKey: 'service',
      topSessionCount: '0',
    }
  }

  public getSortedTopSessions = memoize(
    (
      topSessions: TopSession[],
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ) => this.sort(this.filter(topSessions, searchTerm), sortKey, sortDirection)
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
    const {topSessionCount} = this.state
    return (
      <div className="panel">
        <div className="panel-heading">
          <h2 className="panel-title">{topSessionCount} Top Sessions</h2>
        </div>
        <div className="panel-body">
          <div className="hosts-table">
            <div className="hosts-table--thead">
              <div className="hosts-table--tr">{this.TableHeader}</div>
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
          onClick={this.updateSort('sourceAddress')}
          className={this.sortableClasses('sourceAddress')}
          style={{width: TOPSESSION_SOURCE_ADDRESS}}
        >
          Source Address
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('sourcsourcePort')}
          className={this.sortableClasses('sourcsourcePort')}
          style={{width: TOPSESSION_SOURCE_PORT}}
        >
          Source Port
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('destinationAddress')}
          className={this.sortableClasses('destinationAddress')}
          style={{width: TOPSESSION_DESTINATION_ADDRESS}}
        >
          Destination Address
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('destinationPort')}
          className={this.sortableClasses('destinationPort')}
          style={{width: TOPSESSION_DESTINATION_PORT}}
        >
          Destination Port
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
      <FancyScrollbar
        children={sortedTopSessions.map((r, i) => (
          <TopSessionsTableRow topSessions={r} key={i} />
        ))}
      />
    )
  }

  public filter(allTopSessions: TopSession[], searchTerm: string) {
    const filterText = searchTerm.toLowerCase()
    return allTopSessions.filter(h => {
      return h.service.toLowerCase().includes(filterText)
    })
  }

  public sort(allTopSessions: TopSession[], key: string, direction: string) {
    console.log({direction, key, allTopSessions})
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy<TopSession>(allTopSessions, e => {
          console.log(e[key])
          return e[key]
        })
      case SortDirection.DESC:
        return _.sortBy<TopSession>(allTopSessions, e => {
          console.log(e[key])
          return e[key]
        }).reverse()
      default:
        return allTopSessions
    }
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
