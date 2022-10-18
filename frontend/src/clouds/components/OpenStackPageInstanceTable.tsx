// libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'

// components
import SearchBar from 'src/hosts/components/SearchBar'
import PageSpinner from 'src/shared/components/PageSpinner'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {OpenStackPage} from 'src/clouds/containers/OpenStackPage'
import OpenStackTooltip from 'src/clouds/components/OpenStackTooltip'
import OpenStackPageInstanceTableRow from 'src/clouds/components/OpenStackPageInstanceTableRow'
import OpenStackPageHeader from 'src/clouds/components/OpenStackPageHeader'

// types
import {OPENSATCK_TABLE_SIZING} from 'src/clouds/constants/tableSizing'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {Source, RemoteDataState} from 'src/types'
import {
  OpenStackInstance,
  OpenStackInstanceFlaverDetail,
  OpenStackProject,
} from 'src/clouds/types/openstack'

// constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface Props {
  focusedProject: Partial<OpenStackProject>
  source: Source
  focusedInstance: Partial<OpenStackInstance>
  openStackPageStatus: RemoteDataState
  onClickTableRow: OpenStackPage['handleClickInstanceTableRow']
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
  activeEditorTab: string
  isToolipActive: boolean
  targetPosition: {width: number; top: number; right: number; left: number}
  tooltipNode: Partial<OpenStackInstanceFlaverDetail>
}

@ErrorHandling
class OpenStackPageInstanceTable extends PureComponent<Props, State> {
  public getSortedInstances = memoize(
    (
      instances,
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ) => {
      return this.sort(
        this.filter(instances, searchTerm),
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
      sortKey: 'instanceName',
      activeEditorTab: 'snet',
      isToolipActive: false,
      targetPosition: {width: 0, top: 0, right: 0, left: 0},
      tooltipNode: {},
    }
  }

  public filter(
    instances: OpenStackInstance[],
    searchTerm: string
  ): OpenStackInstance[] {
    const filterText = searchTerm.toLowerCase()
    return instances.filter(h => {
      const {
        instanceName,
        imageName,
        ipAddress,
        flavor,
        keyPair,
        status,
        availabilityZone,
        task,
        powerState,
        age,
      } = h

      return (
        instanceName +
        imageName +
        ipAddress +
        flavor +
        keyPair +
        status +
        availabilityZone +
        task +
        powerState +
        age
      )
        .toLowerCase()
        .includes(filterText)
    })
  }

  public sort(
    instances: OpenStackInstance[],
    key: string,
    direction: SortDirection
  ): OpenStackInstance[] {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy<OpenStackInstance>(instances, e => e[key])
      case SortDirection.DESC:
        return _.sortBy<OpenStackInstance>(instances, e => e[key]).reverse()
      default:
        return instances
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
    const {focusedProject} = this.props

    return (
      <div className="panel" style={{backgroundColor: DEFAULT_CELL_BG_COLOR}}>
        <OpenStackPageHeader
          cellName={`instances (${
            focusedProject?.projectData.projectName || ''
          })`}
          cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
          cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        >
          <div style={{display: 'flex', zIndex: 4, marginRight: '10px'}}>
            <SearchBar
              placeholder="Filter by Name..."
              onSearch={this.updateSearchTerm}
            />
          </div>
        </OpenStackPageHeader>

        <div className="panel-body">{this.CloudTableContents}</div>
        <div className="dash-graph--gradient-border">
          <div className="dash-graph--gradient-top-left" />
          <div className="dash-graph--gradient-top-right" />
          <div className="dash-graph--gradient-bottom-left" />
          <div className="dash-graph--gradient-bottom-right" />
        </div>
      </div>
    )
  }

  private get CloudTableContents(): JSX.Element {
    const {focusedProject, openStackPageStatus} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    const instances = focusedProject?.instances || []
    const sortedInstances = this.getSortedInstances(
      instances,
      searchTerm,
      sortKey,
      sortDirection
    )
    if (
      openStackPageStatus === RemoteDataState.Loading ||
      openStackPageStatus === RemoteDataState.NotStarted
    ) {
      return this.LoadingState
    }
    if (openStackPageStatus === RemoteDataState.Error) {
      return this.ErrorState
    }
    if (instances.length === 0) {
      return this.NoInstancesState
    }
    if (sortedInstances.length === 0) {
      return this.NoSortedInstancesState
    }
    return this.CloudTableWithInstances
  }

  private get CloudTableWithInstances(): JSX.Element {
    const {
      source,
      focusedProject,
      focusedInstance,
      onClickTableRow,
    } = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    const instances = focusedProject.instances

    let sortedInstances = this.getSortedInstances(
      instances,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <div className="hosts-table">
        {this.OpenStackPageTableHeader}
        <FancyScrollbar
          children={sortedInstances.map(h => {
            return (
              <OpenStackPageInstanceTableRow
                key={`openStack-${h.instanceId}`}
                instance={h}
                sourceID={source.id}
                onClickTableRow={onClickTableRow}
                focusedInstance={focusedInstance}
                onMouseLeave={this.onMouseLeave}
                onMouseOver={this.onMouseOver}
              />
            )
          })}
          className="hosts-table--tbody"
        />
        {this.tooltip}
      </div>
    )
  }

  private get LoadingState(): JSX.Element {
    return <PageSpinner />
  }

  private get ErrorState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>
          There was a problem loading instances
        </h4>
      </div>
    )
  }

  private get NoInstancesState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>No Instances found</h4>
      </div>
    )
  }

  private get NoSortedInstancesState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>
          There are no Instances that match the search criteria
        </h4>
      </div>
    )
  }

  private get OpenStackPageTableHeader(): JSX.Element {
    const {
      InstanceNameWidth,
      ImageNameWidth,
      IpAddressWidth,
      FlavorWidth,
      KeyPairWidth,
      StatusWidth,
      AvailabilityZoneWidth,
      TaskWidth,
      PowerStateWidth,
      AgeWidth,
    } = OPENSATCK_TABLE_SIZING

    return (
      <div className="hosts-table--thead">
        <div className="hosts-table--tr">
          <div
            onClick={this.updateSort('namespace')}
            className={this.sortableClasses('namespace')}
            style={{width: InstanceNameWidth}}
          >
            Instance Name
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('name')}
            className={this.sortableClasses('name')}
            style={{width: ImageNameWidth}}
          >
            Image Name
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('instanceID')}
            className={this.sortableClasses('instanceID')}
            style={{width: IpAddressWidth}}
          >
            IP Address
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('instanceState')}
            className={this.sortableClasses('instanceState')}
            style={{width: FlavorWidth}}
          >
            Flavor
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('instanceType')}
            className={this.sortableClasses('instanceType')}
            style={{width: KeyPairWidth}}
          >
            Key Pair
            <span className="icon caret-up" />
          </div>
          <div
            className={this.sortableClasses('status')}
            onClick={this.updateSort('status')}
            style={{width: StatusWidth}}
          >
            Status
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('availabilityZone')}
            className={this.sortableClasses('availabilityZone')}
            style={{width: AvailabilityZoneWidth}}
          >
            Availability Zone
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('task')}
            className={this.sortableClasses('task')}
            style={{width: TaskWidth}}
          >
            Task
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('powerState')}
            className={this.sortableClasses('powerState')}
            style={{width: PowerStateWidth}}
          >
            Power State
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort('age')}
            className={this.sortableClasses('age')}
            style={{width: AgeWidth}}
          >
            Age
            <span className="icon caret-up" />
          </div>
        </div>
      </div>
    )
  }

  private onMouseOver = ({target}) => {
    const {width, top, right, left} = target.getBoundingClientRect()

    this.setState({
      isToolipActive: true,
      targetPosition: {width, top, right, left},
      tooltipNode: {
        id: target.getAttribute('data-instance-id'),
        vcpus: parseInt(target.getAttribute('data-vcpus')),
        ram: parseInt(target.getAttribute('data-ram')),
        size: parseInt(target.getAttribute('data-size')),
        flavor: target.getAttribute('data-flavor'),
      },
    })
  }

  private onMouseLeave = () => {
    this.setState({
      isToolipActive: false,
      targetPosition: {top: null, right: null, left: null, width: null},
    })
  }

  private get tooltip() {
    const {isToolipActive, targetPosition, tooltipNode} = this.state
    if (isToolipActive) {
      return (
        <OpenStackTooltip
          targetPosition={targetPosition}
          tooltipNode={tooltipNode}
        />
      )
    }
  }
}

export default OpenStackPageInstanceTable
