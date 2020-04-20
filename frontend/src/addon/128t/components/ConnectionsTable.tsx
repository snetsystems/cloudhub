// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'

// Components
import {NoHostsState, sortableClasses} from 'src/addon/128t/reusable'
import {Table, TableHeader, TableBody} from 'src/addon/128t/reusable/layout'
import ConnectionsTableRow from 'src/addon/128t/components/ConnectionsTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

// Constants
import {CONNECTION_TABLE_SIZING} from 'src/addon/128t/constants'

//type
import {SortDirection, Connection, OncueData} from 'src/addon/128t/types'

// Error Handler
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  oncueData: OncueData
}

interface State {
  sortDirection: SortDirection
  sortKey: string
  searchTerm: string
}

@ErrorHandling
class ConnectionsTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      searchTerm: '',
      sortKey: 'pathID',
      sortDirection: SortDirection.ASC,
    }
  }

  public getSortedConnections = memoize(
    (
      connections: Connection[],
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ) => this.sort(this.filter(connections, searchTerm), sortKey, sortDirection)
  )

  render() {
    const {oncueData} = this.props
    const {focusedInDeviceConnection} = oncueData
    return (
      <div className={'data-table-container min-height'}>
        <strong className="data-table-title">
          Connections
          <span className="data-table-title-sub">
            {focusedInDeviceConnection === ''
              ? 'no select'
              : focusedInDeviceConnection}
          </span>
        </strong>
        <Table>
          <TableHeader>{this.TableHeader}</TableHeader>
          <TableBody>{this.TableBody}</TableBody>
        </Table>
      </div>
    )
  }

  private get TableHeader() {
    const {sortKey, sortDirection} = this.state
    const {
      CONNECTION_PATH_ID,
      CONNECTION_CONNECTED,
      CONNECTION_DISCONNECTED,
      CONNECTION_IN_USER,
      CONNECTION_DATA_COUNT,
      CONNECTION_SPEED,
    } = CONNECTION_TABLE_SIZING
    return (
      <>
        <div
          className={sortableClasses({sortKey, sortDirection, key: 'pathID'})}
          onClick={this.updateSort('pathID')}
          style={{width: CONNECTION_PATH_ID}}
        >
          Path ID
          <span className="icon caret-up" />
        </div>
        <div
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'connected',
          })}
          onClick={this.updateSort('connected')}
          style={{width: CONNECTION_CONNECTED}}
        >
          Connected
          <span className="icon caret-up" />
        </div>
        <div
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'disconnected',
          })}
          onClick={this.updateSort('disconnected')}
          style={{width: CONNECTION_DISCONNECTED}}
        >
          Disconnected
          <span className="icon caret-up" />
        </div>
        <div
          className={sortableClasses({sortKey, sortDirection, key: 'inUser'})}
          onClick={this.updateSort('inUser')}
          style={{width: CONNECTION_IN_USER}}
        >
          In User
          <span className="icon caret-up" />
        </div>
        <div
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'dataCount',
          })}
          onClick={this.updateSort('dataCount')}
          style={{width: CONNECTION_DATA_COUNT}}
        >
          Data Count
          <span className="icon caret-up" />
        </div>
        <div
          className={sortableClasses({sortKey, sortDirection, key: 'speed'})}
          onClick={this.updateSort('speed')}
          style={{width: CONNECTION_SPEED}}
        >
          Speed
          <span className="icon caret-up" />
        </div>
      </>
    )
  }

  private get TableBody() {
    const {oncueData} = this.props
    const {connection} = oncueData
    const {searchTerm, sortKey, sortDirection} = this.state

    const sortedConnections = this.getSortedConnections(
      connection,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <>
        {connection.length > 0 ? (
          <FancyScrollbar
            children={sortedConnections.map(
              (connection: Connection): JSX.Element => (
                <ConnectionsTableRow
                  key={connection.pathId}
                  connection={connection}
                />
              )
            )}
          />
        ) : (
          <NoHostsState />
        )}
      </>
    )
  }

  private filter(connections: Connection[], searchTerm: string) {
    const filterText = searchTerm.toLowerCase()
    return connections.filter((connection: Connection) => {
      return connection.pathId.toLowerCase().includes(filterText)
    })
  }

  private sort(
    connections: Connection[],
    key: string,
    direction: SortDirection
  ) {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy(connections, (e) => e[key])
      case SortDirection.DESC:
        const sortDesc = _.sortBy(
          connections,
          [(e) => e[key] || e[key] === 0 || e[key] === ''],
          ['asc']
        ).reverse()
        return sortDesc
      default:
        return connections
    }
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

export default ConnectionsTable
