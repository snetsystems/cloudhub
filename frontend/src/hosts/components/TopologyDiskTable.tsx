import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'
import uuid from 'uuid'

import SearchBar from 'src/hosts/components/SearchBar'
import PageSpinner from 'src/shared/components/PageSpinner'
import TopologyDiskTableRow from 'src/hosts/components/TopologyDiskTableRow'

import {CLOUD_HOST_DISK_TABLE_SIZING} from 'src/hosts/constants/tableSizing'
import {RemoteDataState} from 'src/types'
import {cspDisk} from 'src/hosts/types/cloud'

import {ErrorHandling} from 'src/shared/decorators/errors'
enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface Props {
  tableData: cspDisk[]
  pageStatus: RemoteDataState
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
}

@ErrorHandling
class TopologyDiskTable extends PureComponent<Props, State> {
  public getSortedDisks = memoize(
    (
      Disks: cspDisk[],
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ): cspDisk[] => {
      return this.sort(this.filter(Disks, searchTerm), sortKey, sortDirection)
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

  public filter(allDisks, searchTerm: string): cspDisk[] {
    const filterText = searchTerm.toLowerCase()
    return _.filter(allDisks, (h: cspDisk) => {
      return (
        h.devicename.toLowerCase().includes(filterText) ||
        _.toString(h.disksize).toLowerCase().includes(filterText) ||
        h.diskinterface.toLowerCase().includes(filterText) ||
        _.toString(h.boot).toLowerCase().includes(filterText) ||
        _.toString(h.autodelete).toLowerCase().includes(filterText) ||
        h.mode.toLowerCase().includes(filterText) ||
        h.type.toLowerCase().includes(filterText)
      )
    })
  }

  public sort(
    Disks: cspDisk[],
    key: string,
    direction: SortDirection
  ): cspDisk[] {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy<cspDisk>(Disks, e => e[key])
      case SortDirection.DESC:
        return _.sortBy<cspDisk>(Disks, e => e[key]).reverse()
      default:
        return Disks
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
    const sortedDisks: cspDisk[] = this.getSortedDisks(
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
      return this.NoDisksState
    }

    if (sortedDisks.length === 0) {
      return this.NoSortedDisksState
    }

    return this.TableWithDisks
  }

  private get TableWithDisks(): JSX.Element {
    const {tableData} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state
    const sortedDisks = this.getSortedDisks(
      tableData,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <div className="hosts-table">
        {this.DisksTableHeader}
        <div className={`hosts-table--tbody`}>
          {sortedDisks.map(h => (
            <TopologyDiskTableRow key={uuid.v4()} rowData={h} />
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
        <h4 style={{margin: '90px 0'}}>There was a problem loading Disks</h4>
      </div>
    )
  }

  private get NoDisksState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>No Disks found</h4>
      </div>
    )
  }

  private get NoSortedDisksState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>
          There are no Disks that match the search criteria
        </h4>
      </div>
    )
  }

  private get DisksTableHeader(): JSX.Element {
    const {
      DevicenameWidth,
      DisksizeWidth,
      InterfaceWidth,
      BootWidth,
      AutodeleteWidth,
      ModeWidth,
      TypeWidth,
    } = CLOUD_HOST_DISK_TABLE_SIZING

    return (
      <div className="hosts-table--thead">
        <div className="hosts-table--tr">
          <div
            onClick={this.updateSort('devicename')}
            className={this.sortableClasses('devicename')}
            style={{
              width: DevicenameWidth,
            }}
          >
            Device Name
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('disksize')}
            className={this.sortableClasses('disksize')}
            style={{
              width: DisksizeWidth,
            }}
          >
            Size (GiB)
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('interface')}
            className={this.sortableClasses('interface')}
            style={{
              width: InterfaceWidth,
            }}
          >
            Interface
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('boot')}
            className={this.sortableClasses('boot')}
            style={{
              width: BootWidth,
            }}
          >
            Boot Y/N
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('autodelete')}
            className={this.sortableClasses('autodelete')}
            style={{
              width: AutodeleteWidth,
            }}
          >
            Auto Delete
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('mode')}
            className={this.sortableClasses('mode')}
            style={{
              width: ModeWidth,
            }}
          >
            Mode
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('type')}
            className={this.sortableClasses('type')}
            style={{
              width: TypeWidth,
            }}
          >
            Type
            <span className="icon caret-up" />
          </div>
        </div>
      </div>
    )
  }
}

export default TopologyDiskTable
