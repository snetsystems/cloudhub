import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'
import uuid from 'uuid'

import SearchBar from 'src/hosts/components/SearchBar'
import PageSpinner from 'src/shared/components/PageSpinner'
import TopologyStorageTableRow from 'src/hosts/components/TopologyStorageTableRow'

import {CLOUD_HOST_STORAGE_TABLE_SIZING} from 'src/hosts/constants/tableSizing'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {RemoteDataState, Host} from 'src/types'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface Props {
  tableData: []
  pageStatus: RemoteDataState
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
}

@ErrorHandling
class TopologyStorageTable extends PureComponent<Props, State> {
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

  public filter(allHosts, searchTerm: string) {
    const filterText = searchTerm.toLowerCase()

    return _.filter(
      allHosts,
      (h: {
        attachmentStatus: string
        attachmentTime: string
        deleteOnTermination: string
        deviceName: string
        encrypted: string
        volumeId: string
        volumeSize: number
      }) => {
        const {
          attachmentStatus,
          attachmentTime,
          deleteOnTermination,
          deviceName,
          encrypted,
          volumeId,
          volumeSize,
        } = h

        return (
          _.toString(volumeSize).toLowerCase().includes(filterText) ||
          attachmentStatus.toLowerCase().includes(filterText) ||
          attachmentTime.toLowerCase().includes(filterText) ||
          deleteOnTermination.toLowerCase().includes(filterText) ||
          deviceName.toLowerCase().includes(filterText) ||
          encrypted.toLowerCase().includes(filterText) ||
          volumeId.toLowerCase().includes(filterText)
        )
      }
    )
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

  public render() {
    return (
      <div style={{width: '100%'}}>
        <div style={{margin: '10px 0'}}>
          <SearchBar
            placeholder="Filter by text search..."
            onSearch={this.updateSearchTerm}
          />
        </div>
        <div>{this.TableContents}</div>
      </div>
    )
  }

  private get TableContents(): JSX.Element {
    const {pageStatus, tableData} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state
    const sortedHosts = this.getSortedHosts(
      tableData,
      searchTerm,
      sortKey,
      sortDirection
    )
    if (pageStatus === RemoteDataState.Loading) {
      return this.LoadingState
    }
    if (pageStatus === RemoteDataState.Error) {
      return this.ErrorState
    }
    if (tableData.length === 0) {
      return this.NoHostsState
    }
    if (sortedHosts.length === 0) {
      return this.NoSortedHostsState
    }
    return this.TableWithHosts
  }

  private get TableWithHosts(): JSX.Element {
    const {tableData} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state
    const sortedHosts = this.getSortedHosts(
      tableData,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <div className="hosts-table">
        {this.HostsTableHeader}
        <div className={`hosts-table--tbody`}>
          {sortedHosts.map(h => (
            <TopologyStorageTableRow key={uuid.v4()} rowData={h} />
          ))}
        </div>
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

  private get HostsTableHeader(): JSX.Element {
    const {
      VolumeIdWidth,
      DeviceNameWidth,
      VolumeSizeWidth,
      VolumeStatusWidth,
      AttachTimeWidth,
      EncryptedWidth,
      DelOnTermWidth,
    } = CLOUD_HOST_STORAGE_TABLE_SIZING

    return (
      <div className="hosts-table--thead">
        <div className="hosts-table--tr">
          <div
            onClick={this.updateSort('volumeId')}
            className={this.sortableClasses('volumeId')}
            style={{
              width: VolumeIdWidth,
            }}
          >
            Volume ID
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('deviceName')}
            className={this.sortableClasses('deviceName')}
            style={{
              width: DeviceNameWidth,
            }}
          >
            Device name
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('volumeSize')}
            className={this.sortableClasses('volumeSize')}
            style={{
              width: VolumeSizeWidth,
            }}
          >
            Volume size (GiB)
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('attachmentStatus')}
            className={this.sortableClasses('attachmentStatus')}
            style={{
              width: VolumeStatusWidth,
            }}
          >
            Attachment status
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('attachmentTime')}
            className={this.sortableClasses('attachmentTime')}
            style={{
              width: AttachTimeWidth,
            }}
          >
            Attachment time
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('encrypted')}
            className={this.sortableClasses('encrypted')}
            style={{
              width: EncryptedWidth,
            }}
          >
            Encrypted
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('deleteOnTermination')}
            className={this.sortableClasses('deleteOnTermination')}
            style={{
              width: DelOnTermWidth,
            }}
          >
            Delete on termination
            <span className="icon caret-up" />
          </div>
        </div>
      </div>
    )
  }
}

export default TopologyStorageTable
