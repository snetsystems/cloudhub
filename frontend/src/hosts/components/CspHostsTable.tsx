import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'

import SearchBar from 'src/hosts/components/SearchBar'
import PageSpinner from 'src/shared/components/PageSpinner'
import Dropdown from 'src/shared/components/Dropdown'

import {CLOUD_HOSTS_TABLE_SIZING} from 'src/hosts/constants/tableSizing'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {Source, RemoteDataState, CloudHost} from 'src/types'

import {HostsPage} from 'src/hosts/containers/HostsPage'

//middlware
import CspHostRow from './CspHostRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

interface Instance {
  provider: string
  namespace: string
  instanceid: string
  instancename: string
}

export interface Props {
  cloudHosts: CloudHost[]
  namespaceFilterItems: string[]
  selectedNamespace: string
  cspPageStatus: RemoteDataState
  source: Source
  focusedInstance: Instance
  getHandleOnChoose: (selectItem: {text: string}) => void
  onClickTableRow: HostsPage['handleClickCspTableRow']
  tableTitle: () => JSX.Element
  handleInstanceTypeModal: (
    provider: string,
    namespace: string,
    type: string
  ) => void
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
  activeEditorTab: string
}

@ErrorHandling
class CspHostsTable extends PureComponent<Props, State> {
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
      activeEditorTab: 'snet',
    }
  }

  public filter(allHosts: CloudHost[], searchTerm: string): CloudHost[] {
    const filterText = searchTerm.toLowerCase()
    return allHosts.filter(h => {
      const apps = h.apps ? h.apps.join(', ') : ''
      let tagResult = false
      if (h.tags) {
        tagResult = Object.keys(h.tags).reduce((acc, key) => {
          return acc || h.tags[key].toLowerCase().includes(filterText)
        }, false)
      } else {
        tagResult = false
      }

      return (
        h.instanceId.toLowerCase().includes(filterText) ||
        apps.toLowerCase().includes(filterText) ||
        tagResult
      )
    })
  }

  public sort(
    hosts: CloudHost[],
    key: string,
    direction: SortDirection
  ): CloudHost[] {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy<CloudHost>(hosts, e => e[key])
      case SortDirection.DESC:
        return _.sortBy<CloudHost>(hosts, e => e[key]).reverse()
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
    const {
      namespaceFilterItems,
      selectedNamespace,
      getHandleOnChoose,
    } = this.props

    return (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2 className="panel-title">{this.HostsTitle}</h2>
          </div>

          <div style={{display: 'flex'}}>
            <div style={{marginRight: '5px'}}>
              <Dropdown
                items={['ALL', ...namespaceFilterItems]}
                onChoose={getHandleOnChoose}
                selected={selectedNamespace}
                className="dropdown-sm"
              />
            </div>
            <SearchBar
              placeholder="Filter by Name..."
              onSearch={this.updateSearchTerm}
            />
          </div>
        </div>
        <div className="panel-body">{this.CloudTableContents}</div>
      </div>
    )
  }

  private get CloudTableContents(): JSX.Element {
    const {cloudHosts, cspPageStatus} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state
    const sortedHosts = this.getSortedHosts(
      cloudHosts,
      searchTerm,
      sortKey,
      sortDirection
    )
    if (
      cspPageStatus === RemoteDataState.Loading ||
      cspPageStatus === RemoteDataState.NotStarted
    ) {
      return this.LoadingState
    }
    if (cspPageStatus === RemoteDataState.Error) {
      return this.ErrorState
    }
    if (cloudHosts.length === 0) {
      return this.NoHostsState
    }
    if (sortedHosts.length === 0) {
      return this.NoSortedHostsState
    }
    return this.CloudTableWithHosts
  }

  private get CloudTableWithHosts(): JSX.Element {
    const {
      source,
      cloudHosts,
      focusedInstance,
      onClickTableRow,
      handleInstanceTypeModal,
      selectedNamespace,
    } = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    let sortedHosts = this.getSortedHosts(
      cloudHosts,
      searchTerm,
      sortKey,
      sortDirection
    )

    if (selectedNamespace !== 'ALL') {
      sortedHosts = [
        ...sortedHosts.filter(h => h.csp.namespace === selectedNamespace),
      ]
    }

    return (
      <div className="hosts-table">
        {this.CloudHostsTableHeader}
        <FancyScrollbar
          children={sortedHosts.map(h => {
            return (
              <CspHostRow
                key={`${h.csp.id}-${h.instanceId}`}
                host={h}
                sourceID={source.id}
                focusedInstance={focusedInstance}
                onClickTableRow={onClickTableRow}
                handleInstanceTypeModal={handleInstanceTypeModal}
              />
            )
          })}
          className="hosts-table--tbody"
        />
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

  private get HostsTitle(): JSX.Element {
    const {tableTitle} = this.props

    return tableTitle()
  }

  private get CloudHostsTableHeader(): JSX.Element {
    const {
      CloudNamespaceWidth,
      CloudNameWidth,
      CloudInstanceIDWidth,
      CloudInstanceStateWidth,
      CloudInstanceTypeWidth,
      CloudAppsWidth,
      CloudCPUWidth,
      CloudMemoryWidth,
      CloudDiskWidth,
    } = CLOUD_HOSTS_TABLE_SIZING

    return (
      <div className="hosts-table--thead">
        <div className="hosts-table--tr">
          <div
            onClick={this.updateSort('namespace')}
            className={this.sortableClasses('namespace')}
            style={{width: CloudNamespaceWidth}}
          >
            {this.props.focusedInstance.provider == 'gcp'
              ? 'Project'
              : 'Region'}
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('name')}
            className={this.sortableClasses('name')}
            style={{width: CloudNameWidth}}
          >
            Name
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('instanceID')}
            className={this.sortableClasses('instanceID')}
            style={{width: CloudInstanceIDWidth}}
          >
            Instance ID
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('instanceState')}
            className={this.sortableClasses('instanceState')}
            style={{width: CloudInstanceStateWidth}}
          >
            Instance state
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('instanceType')}
            className={this.sortableClasses('instanceType')}
            style={{width: CloudInstanceTypeWidth}}
          >
            Instance type
            <span className="icon caret-up" />
          </div>
          <div
            className="hosts-table--th list-type"
            style={{width: CloudAppsWidth}}
          >
            Apps
          </div>
          <div
            onClick={this.updateSort('cpu')}
            className={this.sortableClasses('cpu')}
            style={{width: CloudCPUWidth}}
          >
            CPU
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('memory')}
            className={this.sortableClasses('memory')}
            style={{width: CloudMemoryWidth}}
          >
            Memory
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('disk')}
            className={this.sortableClasses('disk')}
            style={{width: CloudDiskWidth}}
          >
            Disk
            <span className="icon caret-up" />
          </div>
        </div>
      </div>
    )
  }
}

export default CspHostsTable
