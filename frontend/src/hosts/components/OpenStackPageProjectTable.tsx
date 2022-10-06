// libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'

// components
import SearchBar from 'src/hosts/components/SearchBar'
import PageSpinner from 'src/shared/components/PageSpinner'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import OpenStackPageProjectTableRow from 'src/hosts/components/OpenStackPageProjectTableRow'
import {OpenStackPage} from 'src/hosts/containers/OpenStackPage'
import {OpenStackProject} from 'src/hosts/types/openstack'
import OpenStackPageHeader from 'src/hosts/components//OpenStackPageHeader'

// types
import {Source, RemoteDataState} from 'src/types'

// errorHandler
import {ErrorHandling} from 'src/shared/decorators/errors'

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
  projects: OpenStackProject[]
  source: Source
  openStackPageStatus: RemoteDataState
  resourceTableOrder?: string[]
  focusedProject: Partial<OpenStackProject>
  onClickTableRow: OpenStackPage['handleClickProjectTableRow']
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
  activeEditorTab: string
  targetPosition: {width: number; top: number; right: number; left: number}
}

@ErrorHandling
class OpenStackPageProjectTable extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    resourceTableOrder: [
      'Instances',
      'VCPUs',
      'RAM',
      'Volumes',
      'Volume Snapshots',
      'Volume Storage',
      'Floating IPs',
      'Security Groups',
      'Security Group Rules',
      'Networks',
      'Ports',
      'Routers',
    ],
  }

  public getSortedProjects = memoize(
    (
      projects,
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ) => {
      return this.sort(
        this.filter(projects, searchTerm),
        sortKey.toLowerCase(),
        sortDirection
      )
    }
  )

  constructor(props: Props) {
    super(props)
    this.state = {
      searchTerm: '',
      sortDirection: SortDirection.ASC,
      sortKey: 'projectname',
      activeEditorTab: 'snet',
      targetPosition: {width: 0, top: 0, right: 0, left: 0},
    }
  }

  public filter(
    allProjects: OpenStackProject[],
    searchTerm: string
  ): OpenStackProject[] {
    const filterText = searchTerm.toLowerCase()

    return allProjects?.filter(h => {
      const projectName = h.projectData.projectName as string

      return projectName.toLowerCase().includes(filterText)
    })
  }

  public sort(
    projects: OpenStackProject[],
    key: string,
    direction: SortDirection
  ): OpenStackProject[] {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy<OpenStackProject>(projects, e => {
          const projectData = Object.keys(e?.projectData.row).reduce(
            (accumulator, _key) => {
              accumulator[_key.toLowerCase()] = e?.projectData.row[_key]
              return accumulator
            },
            {}
          )

          if (typeof projectData[key] === 'string') {
            return projectData[key]
          }
          return projectData[key]['gaugePosition']
        })
      case SortDirection.DESC:
        return _.sortBy<OpenStackProject>(projects, e => {
          const projectData = Object.keys(e?.projectData.row).reduce(
            (accumulator, _key) => {
              accumulator[_key.toLowerCase()] = e?.projectData.row[_key]
              return accumulator
            },
            {}
          )
          if (typeof projectData[key] === 'string') {
            return projectData[key]
          }
          return projectData[key]['gaugePosition']
        }).reverse()
      default:
        return projects
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
      <div className="panel">
        <OpenStackPageHeader
          cellName={`Limit Summary (${
            focusedProject?.projectData.projectName || ''
          })`}
          cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
          cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        >
          <div
            className="dash-grah"
            style={{display: 'flex', zIndex: 4, marginRight: '10px'}}
          >
            <SearchBar
              placeholder="Filter by Name..."
              onSearch={this.updateSearchTerm}
            />
          </div>
        </OpenStackPageHeader>
        ​
        <div style={{height: 'calc(100% - 40px)'}} className="panel-body">
          {this.CloudTableContents}
        </div>
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
    const {projects, openStackPageStatus} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state
    const sortedProjects = this.getSortedProjects(
      projects,
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

    if (_.isEmpty(projects)) {
      return this.NoProjectState
    }

    if (sortedProjects.length === 0) {
      return this.NoSortedProjectState
    }

    return this.CloudTableWithHosts
  }

  private get CloudTableWithHosts(): JSX.Element {
    return (
      <div className="hosts-table">
        {this.CloudHostsTableHeader}
        <FancyScrollbar
          children={this.OpenStackPageTableBody}
          className="hosts-table--tbody"
        />
      </div>
    )
  }

  private get OpenStackPageTableBody() {
    const {
      projects,
      resourceTableOrder,
      onClickTableRow,
      focusedProject,
    } = this.props
    const {searchTerm, sortKey, sortDirection} = this.state

    const sortedProjects: OpenStackProject[] = this.getSortedProjects(
      projects,
      searchTerm,
      sortKey,
      sortDirection
    )

    return sortedProjects.map(project => {
      const {projectName} = project?.projectData
      const currentFocusedProject =
        project?.projectName == focusedProject.projectName ? focusedProject : {}

      return (
        <OpenStackPageProjectTableRow
          key={`osp-${projectName}`}
          project={project}
          tableOrder={resourceTableOrder}
          onClickTableRow={onClickTableRow}
          focusedProject={currentFocusedProject}
        />
      )
    })
  }

  private get LoadingState(): JSX.Element {
    return <PageSpinner />
  }

  private get ErrorState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>
          There was a problem loading OpenStackPage
        </h4>
      </div>
    )
  }

  private get NoProjectState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>No Project found</h4>
      </div>
    )
  }

  private get NoSortedProjectState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>
          There are no Projects that match the search criteria
        </h4>
      </div>
    )
  }

  private get CloudHostsTableHeader(): JSX.Element {
    const {resourceTableOrder} = this.props
    const projectRowWiddth = (100 / resourceTableOrder.length) * 2
    const resourceRowWidth = 100 / resourceTableOrder.length

    return (
      <div className="hosts-table--thead">
        <div className="hosts-table--tr">
          <div
            onClick={this.updateSort('projectname')}
            className={this.sortableClasses('projectname')}
            style={{
              width: `${projectRowWiddth}%`,
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <span style={{width: '80%'}}>Project</span>
            <span className="icon caret-up" />
          </div>

          {resourceTableOrder.map(resource => {
            const _resource = resource.replace(/ /g, '')

            return (
              <div
                key={resource}
                onClick={this.updateSort(_resource)}
                className={this.sortableClasses(_resource)}
                style={{
                  width: `${resourceRowWidth}%`,
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
              >
                <span style={{width: '80%'}}>{resource}</span>
                <span className="icon caret-up" />
              </div>
            )
          })}
        </div>
      </div>
    )
  }
}
export default OpenStackPageProjectTable
