// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'

// Component
import {NoHostsState, sortableClasses} from 'src/addon/128t/reusable'
import {Table, TableHeader, TableBody} from 'src/addon/128t/reusable/layout'
import DeviceConnectionsTableRow from 'src/addon/128t/components/DeviceConnectionsTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

// Constants
import {DEVICE_CONNECTIONS_TABLE_SIZING} from 'src/addon/128t/constants'

// Type
import {SortDirection, OncueData, DeviceConnection} from 'src/addon/128t/types'

// Error Handler
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  oncueData: OncueData
  onClickRow: (url: string) => void
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
}

@ErrorHandling
class DeviceConnectionsTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      searchTerm: '',
      sortKey: 'name',
      sortDirection: SortDirection.ASC,
    }
  }

  public getSortedDeviceConnections = memoize(
    (
      deviceConnections: DeviceConnection[],
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ) =>
      this.sort(
        this.filter(deviceConnections, searchTerm),
        sortKey,
        sortDirection
      )
  )

  render() {
    const {oncueData} = this.props
    const {focusedInProtocolModule} = oncueData
    return (
      <div className={'data-table-container min-height'}>
        <strong className="data-table-title">
          Device Connections
          <span className="data-table-title-sub">
            {focusedInProtocolModule === ''
              ? 'no select'
              : focusedInProtocolModule}
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
    const {DEVICE_CONNECTIONS_URL} = DEVICE_CONNECTIONS_TABLE_SIZING

    return (
      <>
        <div
          className={sortableClasses({sortKey, sortDirection, key: 'url'})}
          onClick={this.updateSort('url')}
          style={{width: DEVICE_CONNECTIONS_URL}}
        >
          URL
          <span className="icon caret-up" />
        </div>
      </>
    )
  }

  private get TableBody() {
    const {oncueData, onClickRow} = this.props
    const {deviceConnections, focusedInDeviceConnection} = oncueData
    const {searchTerm, sortKey, sortDirection} = this.state

    const sortedDeviceConnections = this.getSortedDeviceConnections(
      deviceConnections,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <>
        {deviceConnections.length > 0 ? (
          <FancyScrollbar
            children={sortedDeviceConnections.map(
              (deviceConnection: DeviceConnection): JSX.Element => (
                <DeviceConnectionsTableRow
                  key={deviceConnection.url}
                  url={deviceConnection.url}
                  onClickRow={onClickRow}
                  focusedInDeviceConnection={focusedInDeviceConnection}
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

  private filter(deviceConnections: DeviceConnection[], searchTerm: string) {
    const filterText = searchTerm.toLowerCase()
    return deviceConnections.filter(deviceConnection => {
      return deviceConnection.url.toLowerCase().includes(filterText)
    })
  }

  private sort(
    deviceConnections: DeviceConnection[],
    key: string,
    direction: SortDirection
  ) {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy(deviceConnections, e => e[key])
      case SortDirection.DESC:
        const sortDesc = _.sortBy(
          deviceConnections,
          [e => e[key] || e[key] === 0 || e[key] === ''],
          ['asc']
        ).reverse()
        return sortDesc
      default:
        return deviceConnections
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

export default DeviceConnectionsTable
