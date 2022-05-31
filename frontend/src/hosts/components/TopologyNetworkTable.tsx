import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'
import uuid from 'uuid'

import SearchBar from 'src/hosts/components/SearchBar'
import PageSpinner from 'src/shared/components/PageSpinner'
import TopologyNetworkTableRow from 'src/hosts/components/TopologyNetworkTableRow'

import {CLOUD_HOST_NETWORK_TABLE_SIZING} from 'src/hosts/constants/tableSizing'
import {RemoteDataState} from 'src/types'
import {cspNetwork} from 'src/hosts/types/cloud'

import {ErrorHandling} from 'src/shared/decorators/errors'
enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface Props {
  tableData: cspNetwork[]
  pageStatus: RemoteDataState
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
}

@ErrorHandling
class TopologyNetworkTable extends PureComponent<Props, State> {
  public getSortedNetworks = memoize(
    (
      Networks: cspNetwork[],
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ): cspNetwork[] => {
      return this.sort(
        this.filter(Networks, searchTerm),
        sortKey,
        sortDirection
      )
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

  public filter(allNetworks, searchTerm: string): cspNetwork[] {
    const filterText = searchTerm.toLowerCase()
    return _.filter(allNetworks, (h: cspNetwork) => {
      return (
        h.name.toLowerCase().includes(filterText) ||
        h.internal_ip.toLowerCase().includes(filterText) ||
        h.external_ip.toLowerCase().includes(filterText) ||
        h.tier.toLowerCase().includes(filterText) ||
        h.type.toLowerCase().includes(filterText)
      )
    })
  }

  public sort(
    Networks: cspNetwork[],
    key: string,
    direction: SortDirection
  ): cspNetwork[] {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy<cspNetwork>(Networks, e => e[key])
      case SortDirection.DESC:
        return _.sortBy<cspNetwork>(Networks, e => e[key]).reverse()
      default:
        return Networks
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
    const sortedNetworks: cspNetwork[] = this.getSortedNetworks(
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
      return this.NoNetworksState
    }

    if (sortedNetworks.length === 0) {
      return this.NoSortedNetworksState
    }

    return this.TableWithNetworks
  }

  private get TableWithNetworks(): JSX.Element {
    const {tableData} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state
    const sortedNetworks = this.getSortedNetworks(
      tableData,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <div className="hosts-table">
        {this.NetworksTableHeader}
        <div className={`hosts-table--tbody`}>
          {sortedNetworks.map(h => (
            <TopologyNetworkTableRow key={uuid.v4()} rowData={h} />
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
        <h4 style={{margin: '90px 0'}}>There was a problem loading Networks</h4>
      </div>
    )
  }

  private get NoNetworksState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>No Networks found</h4>
      </div>
    )
  }

  private get NoSortedNetworksState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>
          There are no Networks that match the search criteria
        </h4>
      </div>
    )
  }

  private get NetworksTableHeader(): JSX.Element {
    return (
      <div className="hosts-table--thead">
        <div className="hosts-table--tr">
          {_.keys(_.values(this.props.tableData)[0]).map(k => {
            const upperHead = k[0].toUpperCase() + k.slice(1).replace('_', '')
            return (
              <div
                key={k}
                onClick={this.updateSort(k)}
                className={this.sortableClasses(k)}
                style={{
                  width: CLOUD_HOST_NETWORK_TABLE_SIZING[`${upperHead}Width`],
                }}
              >
                {k[0].toUpperCase() + k.slice(1).replace('_', ' ')}
                <span className="icon caret-up" />
              </div>
            )
          })}
        </div>
      </div>
    )
  }
}

export default TopologyNetworkTable
