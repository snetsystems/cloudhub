// libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import {bindActionCreators} from 'redux'
import ReactObserver from 'react-resize-observer'

// middleware
const GridLayout = WidthProvider(ReactGridLayout)
import {
  getLocalStorage,
  setLocalStorage,
} from 'src/shared/middleware/localStorage'

// constants
import {notifyUnableToGetProjects} from 'src/shared/copy/notifications'

// actions
import {notify, notify as notifyAction} from 'src/shared/actions/notifications'

// types
import {
  Source,
  Links,
  Layout,
  TimeRange,
  RemoteDataState,
  NotificationAction,
} from 'src/types'
import {
  FocusedInstance,
  FocusedProject,
  OpenStackLayoutCell,
  OpenStackProject,
} from 'src/clouds/types/openstack'
import {loadCloudServiceProvidersAsync} from 'src/hosts/actions'

// Components
import {ManualRefreshProps} from 'src/shared/components/ManualRefresh'
import {ErrorHandling} from 'src/shared/decorators/errors'
import PageSpinner from 'src/shared/components/PageSpinner'
import {AddonType, LAYOUT_MARGIN} from 'src/shared/constants'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import OpenStackPageInstanceOverview from 'src/clouds/components/OpenStackPageInstanceOverview'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import OpenStackPageInstanceTable from 'src/clouds/components/OpenStackPageInstanceTable'
import OpenStackProjectGaugeChartLayout from 'src/clouds/components/OpenStackProjectGaugeChartLayout'
import OpenStackPageProjectTable from 'src/clouds/components/OpenStackPageProjectTable'
import OpenStackPageHeader from 'src/clouds/components/OpenStackPageHeader'

// utils
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {getCells} from 'src/hosts/utils/getCells'
import {generateForHosts} from 'src/utils/tempVars'
import {getDeep} from 'src/utils/wrappers'
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'

// api
import {
  getAppsForInstance,
  getLayouts,
  getMeasurementsForInstance,
} from 'src/hosts/apis'
import {adminSaltCall, superAdminSaltCall} from 'src/clouds/apis/openstack'

// constants
import {getOpenStackPageLayouts} from 'src/clouds/constants/layout'
import {notIncludeAppsOsp} from 'src/hosts/constants/apps'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
  GRAPH_BG_COLOR,
} from 'src/dashboards/constants'
import {SUPERADMIN_ROLE} from 'src/auth/Authorized'

interface Props extends ManualRefreshProps {
  meRole: string
  meCurrentOrganization: {id: string; name: string}
  meOrganizations: [{id: string; name: string}]
  source: Source
  links: Links
  autoRefresh: number
  timeRange: TimeRange
  notify: NotificationAction
  handleLoadCspsAsync: () => Promise<any>
}

interface State {
  focusedInstance: Partial<FocusedInstance>
  focusedProject: FocusedProject
  layouts: Layout[]
  filteredLayouts: Layout[]
  projects: Partial<OpenStackProject[]>
  openStackPageStatus: RemoteDataState
  saltRemoteDataState: RemoteDataState
  openStackLayouts: OpenStackLayoutCell[]
}

@ErrorHandling
export class OpenStackPage extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    manualRefresh: 0,
  }

  private isComponentMounted: boolean = true
  public intervalID: number

  private salt = _.find(
    this.props.links.addons,
    addon => addon.name === AddonType.salt
  )
  private adminProvider = this.props.links.osp['admin-provider']
  constructor(props: Props) {
    super(props)

    this.setState = (args, callback) => {
      if (!this.isComponentMounted) return
      PureComponent.prototype.setState.bind(this)(args, callback)
    }

    this.state = {
      focusedInstance: {},
      focusedProject: null,
      layouts: [],
      filteredLayouts: [],
      projects: [],
      openStackPageStatus: RemoteDataState.NotStarted,
      saltRemoteDataState: RemoteDataState.NotStarted,
      openStackLayouts: [],
    }
  }

  public async componentDidMount() {
    const {autoRefresh, meRole} = this.props

    const layoutResults = await getLayouts()
    const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

    if (!layouts) {
      notify(notifyUnableToGetProjects())
      this.setState({
        openStackPageStatus: RemoteDataState.Error,
        layouts,
      })
      return
    }

    const openstackLayoutsByRole =
      getOpenStackPageLayouts[
        meRole == SUPERADMIN_ROLE ? SUPERADMIN_ROLE : 'other'
      ]

    try {
      await this.fetchOpenStackData()

      const {openStackLayouts: layoutsByStorage} =
        getLocalStorage('openStackLayouts') || openstackLayoutsByRole
      const ospLayouts = layoutsByStorage || openstackLayoutsByRole
      let storageOpenStackLayouts = Array.isArray(ospLayouts)
        ? ospLayouts
        : ospLayouts.split(',').map(v => Number(v))

      if (openstackLayoutsByRole.length !== storageOpenStackLayouts.length) {
        storageOpenStackLayouts = openstackLayoutsByRole
      }

      this.onSetFocusedProject()
      this.onSetFocusedInstance()

      let focusedLayout = []

      if (!_.isEmpty(this.state.focusedInstance)) {
        const {filteredLayouts} = await this.getLayoutsforInstance(
          layouts,
          this.state.focusedInstance
        )
        focusedLayout = filteredLayouts
      }

      if (autoRefresh) {
        clearInterval(this.intervalID)
        this.intervalID = window.setInterval(
          () => this.fetchOpenStackData(),
          autoRefresh
        )
      }

      GlobalAutoRefresher.poll(autoRefresh)

      this.setState(state => {
        return {
          ...state,
          layouts,
          filteredLayouts: focusedLayout,
          openStackPageStatus: RemoteDataState.Done,
          openStackLayouts: storageOpenStackLayouts,
        }
      })
    } catch (error) {
      this.setState({
        openStackPageStatus: RemoteDataState.Done,
        saltRemoteDataState: RemoteDataState.Done,
        openStackLayouts: openstackLayoutsByRole,
      })
    }
  }

  public async componentDidUpdate(
    prevProps: Readonly<Props>,
    prevState: Readonly<State>
  ): Promise<void> {
    const {
      focusedProject: preFocusedProject,
      focusedInstance: preFocusedInstance,
    } = prevState
    const {autoRefresh} = this.props
    const {focusedInstance, layouts} = this.state

    if (layouts.length && preFocusedProject) {
      if (preFocusedInstance.instanceName !== focusedInstance.instanceName) {
        const {filteredLayouts} = await this.getLayoutsforInstance(
          layouts,
          focusedInstance
        )
        this.setState({filteredLayouts})
      }

      if (prevProps.autoRefresh !== autoRefresh) {
        GlobalAutoRefresher.poll(autoRefresh)
      }
    }
  }
  public async UNSAFE_componentWillReceiveProps(nextProps: Props) {
    const {layouts, focusedInstance} = this.state
    if (layouts.length) {
      if (this.props.manualRefresh !== nextProps.manualRefresh) {
        await this.fetchOpenStackData()
        const {filteredLayouts} = await this.getLayoutsforInstance(
          layouts,
          focusedInstance
        )
        this.setState({filteredLayouts})
      }

      if (this.props.autoRefresh !== nextProps.autoRefresh) {
        clearInterval(this.intervalID)
        GlobalAutoRefresher.poll(nextProps.autoRefresh)

        if (nextProps.autoRefresh) {
          this.intervalID = window.setInterval(
            () => this.fetchOpenStackData(),
            nextProps.autoRefresh
          )
        }
      }
    }
  }

  public componentWillUnmount() {
    const {meRole} = this.props
    const {openStackLayouts} = this.state

    clearInterval(this.intervalID)
    this.intervalID = null
    GlobalAutoRefresher.stopPolling()

    const saveLayouts = _.isEmpty(openStackLayouts)
      ? getOpenStackPageLayouts[
          meRole == SUPERADMIN_ROLE ? SUPERADMIN_ROLE : 'other'
        ]
      : openStackLayouts

    setLocalStorage('openStackLayouts', {
      openStackLayouts: saveLayouts,
    })

    this.isComponentMounted = false
  }

  public render() {
    const {openStackPageStatus, openStackLayouts} = this.state

    if (
      openStackPageStatus === RemoteDataState.Loading ||
      openStackPageStatus === RemoteDataState.NotStarted
    ) {
      return this.LoadingState
    }

    return (
      <FancyScrollbar autoHide={false}>
        <GridLayout
          className="layout"
          layout={openStackLayouts}
          cols={20}
          rowHeight={50}
          margin={[LAYOUT_MARGIN, LAYOUT_MARGIN]}
          containerPadding={[20, 10]}
          draggableHandle={'.openstacck-dash-graph--draggable'}
          onLayoutChange={this.handleLayoutChange}
          useCSSTransforms={false}
          isDraggable={true}
          isResizable={true}
        >
          {_.map(openStackLayouts, layout => {
            return <div key={layout.i}>{this.openStackPageRender(layout)}</div>
          })}
        </GridLayout>
      </FancyScrollbar>
    )
  }
  private openStackPageRender(layout: OpenStackLayoutCell): JSX.Element {
    const {
      openStackPageStatus,
      projects,
      focusedProject,
      focusedInstance,
      filteredLayouts,
      saltRemoteDataState,
    } = this.state
    const {source, manualRefresh, timeRange} = this.props

    const updateFocusedProject = _.filter(
      projects,
      project => project?.projectData.projectName === focusedProject
    )[0]

    const updateInstance = _.filter(
      updateFocusedProject?.instances,
      instance => instance.instanceId === focusedInstance.instanceId
    )[0]

    switch (layout.i) {
      case 'projectTable': {
        return (
          <OpenStackPageProjectTable
            projects={projects}
            focusedProject={focusedProject}
            openStackPageStatus={openStackPageStatus}
            source={source}
            onClickTableRow={this.handleClickProjectTableRow}
            saltRemoteDataState={saltRemoteDataState}
          />
        )
      }

      case 'projectDetail': {
        return (
          <OpenStackProjectGaugeChartLayout
            gaugeChartState={openStackPageStatus}
            focusedProject={focusedProject}
            projectData={updateFocusedProject?.projectData?.chart}
            saltRemoteDataState={saltRemoteDataState}
          />
        )
      }

      case 'instanceDetail': {
        return (
          <OpenStackPageInstanceOverview
            focusedInstance={focusedInstance}
            focusedInstanceData={updateInstance}
            saltRemoteDataState={saltRemoteDataState}
          />
        )
      }

      case 'instanceTable': {
        return (
          <OpenStackPageInstanceTable
            openStackPageStatus={openStackPageStatus}
            source={source}
            focusedInstance={focusedInstance}
            focusedProject={focusedProject}
            focusedProjectData={updateFocusedProject}
            onClickTableRow={this.handleClickInstanceTableRow}
            saltRemoteDataState={saltRemoteDataState}
          />
        )
      }

      case 'instanceGraph': {
        const layoutCells = getCells(filteredLayouts, source)
        const tempVars = generateForHosts(source)
        const instance = {
          instancename: updateInstance?.instanceName,
          instanceid: updateInstance?.instanceId,
          namespace: updateInstance?.projectName,
        }
        const debouncedFit = _.debounce(() => {
          WindowResizeEventTrigger()
        }, 150)
        const handleOnResize = (): void => {
          debouncedFit()
        }

        return (
          <div
            className="panel"
            style={{backgroundColor: DEFAULT_CELL_BG_COLOR}}
          >
            <OpenStackPageHeader
              cellName={`Monitoring (${focusedInstance.instanceName || ''})`}
              cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
              cellTextColor={DEFAULT_CELL_TEXT_COLOR}
            ></OpenStackPageHeader>
            {_.isEmpty(updateInstance) ? (
              <div className="panel-body">
                <div className="generic-empty-state">
                  <h4 style={{margin: '90px 0'}}>No Instances found</h4>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="panel-body"
                  style={{backgroundColor: GRAPH_BG_COLOR}}
                >
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    <ReactObserver onResize={handleOnResize} />
                    <LayoutRenderer
                      source={source}
                      sources={[source]}
                      isStatusPage={false}
                      isStaticPage={true}
                      isEditable={false}
                      cells={layoutCells}
                      templates={tempVars}
                      timeRange={timeRange}
                      manualRefresh={manualRefresh}
                      instance={instance}
                      host={''}
                    />
                  </div>
                </div>
                <div className="dash-graph--gradient-border">
                  <div className="dash-graph--gradient-top-left" />
                  <div className="dash-graph--gradient-top-right" />
                  <div className="dash-graph--gradient-bottom-left" />
                  <div className="dash-graph--gradient-bottom-right" />
                </div>
              </>
            )}
          </div>
        )
      }
    }
  }

  private get LoadingState(): JSX.Element {
    return <PageSpinner />
  }

  private handleLayoutChange = layout => {
    const {openStackLayouts} = this.state

    let changed = false
    const newCells = openStackLayouts.map(cell => {
      const l = layout.find(ly => ly.i === cell.i)

      if (
        cell.x !== l.x ||
        cell.y !== l.y ||
        cell.h !== l.h ||
        cell.w !== l.w
      ) {
        changed = true
      }

      const newLayout = {
        x: l.x,
        y: l.y,
        h: l.h,
        w: l.w,
        minW: l.minW,
        minH: l.minH,
      }

      return {
        ...cell,
        ...newLayout,
      }
    })

    if (changed) {
      this.setState({openStackLayouts: newCells})
    }
  }

  private async fetchOpenStackData() {
    const {handleLoadCspsAsync, notify, meRole} = this.props

    try {
      const accessInfo = {
        url: this.salt.url,
        token: this.salt.token,
        adminProvider: this.adminProvider,
      }
      this.setState(prevState => ({
        ...prevState,
        saltRemoteDataState: RemoteDataState.Loading,
      }))
      const ospProjects =
        meRole == SUPERADMIN_ROLE
          ? await superAdminSaltCall(accessInfo)
          : await adminSaltCall(handleLoadCspsAsync, accessInfo)

      this.setState(prevState => ({
        ...prevState,
        projects: ospProjects,
        saltRemoteDataState: RemoteDataState.Done,
      }))
      return ospProjects
    } catch (error) {
      notify(notifyUnableToGetProjects())
      throw error
    }
  }

  private async getLayoutsforInstance(
    layouts: Layout[],
    pInstance: Partial<FocusedInstance>
  ) {
    const {instance, measurements} = await this.fetchInstancesAndMeasurements(
      layouts,
      pInstance
    )

    const layoutsWithinInstance = layouts.filter(layout => {
      return (
        instance.apps &&
        instance.apps.includes(layout.app) &&
        measurements.includes(layout.measurement)
      )
    })

    const filteredLayouts = layoutsWithinInstance
      .filter(layout => {
        return layout.app === 'openstack'
      })
      .sort((x, y) => {
        return x.measurement < y.measurement
          ? -1
          : x.measurement > y.measurement
          ? 1
          : 0
      })

    return {instance, filteredLayouts}
  }

  private async fetchInstancesAndMeasurements(
    layouts: Layout[],
    focusedInstance: Partial<FocusedInstance>
  ) {
    const {source} = this.props

    const tempVars = generateForHosts(source)
    const pInstance = {
      instancename: focusedInstance.instanceName,
      instanceid: focusedInstance.instanceId,
      namespace: focusedInstance.projectName,
    }
    const getFrom = 'OpenStack'

    const fetchMeasurements = getMeasurementsForInstance(
      source,
      pInstance,
      getFrom
    )

    const filterLayouts = _.filter(
      layouts,
      m => !_.includes(notIncludeAppsOsp, m.app)
    )

    const fetchInstances = getAppsForInstance(
      source.links.proxy,
      pInstance,
      filterLayouts,
      source.telegraf,
      tempVars,
      getFrom
    )

    const [instance, measurements] = await Promise.all([
      fetchInstances,
      fetchMeasurements,
    ])

    return {instance, measurements}
  }

  private handleClickInstanceTableRow = (instance: FocusedInstance) => () => {
    const {focusedProject} = this.state

    this.onSetFocusedInstance({focusedInstance: instance, focusedProject})
  }

  private handleClickProjectTableRow = (
    focusedProject: FocusedProject
  ) => () => {
    this.onSetFocusedProject(focusedProject)
    this.onSetFocusedInstance({focusedProject})
  }

  private onSetFocusedProject = (focusedProject?: FocusedProject | null) => {
    const {projects} = this.state

    if (_.isEmpty(focusedProject) && !_.isEmpty(projects)) {
      this.setState(prevState => ({
        ...prevState,
        focusedProject: projects[0].projectData.projectName,
      }))
    } else {
      this.setState(prevState => ({
        ...prevState,
        focusedProject: focusedProject,
      }))
    }
  }

  private onSetFocusedInstance = ({
    focusedInstance = {} as Partial<FocusedInstance>,
    focusedProject = null as FocusedProject,
  } = {}): void => {
    const {projects} = this.state

    if (_.isEmpty(focusedProject) && _.isEmpty(focusedInstance)) {
      const selectedProject = projects[0]
      if (!_.isEmpty(selectedProject.instances)) {
        const selectedInstance = selectedProject.instances[0]
        this.setState(prevState => ({
          ...prevState,
          focusedInstance: {
            instanceName: selectedInstance.instanceName,
            instanceId: selectedInstance.instanceId,
            projectName: selectedInstance.projectName,
          },
        }))
      }
    } else {
      const selectedProject = _.filter(
        projects,
        project => project.projectData.projectName === focusedProject
      )[0]

      let selectedInstance = {} as FocusedInstance
      if (_.isEmpty(focusedInstance)) {
        selectedInstance =
          selectedProject.instances?.[0] || ({} as FocusedInstance)
      } else {
        selectedInstance = _.filter(
          selectedProject.instances,
          instnace => instnace.instanceId === focusedInstance.instanceId
        )[0]
      }

      this.setState({
        focusedInstance: {
          instanceName: selectedInstance.instanceName,
          instanceId: selectedInstance.instanceId,
          projectName: selectedInstance.projectName,
        },
      })
    }
  }
}

const mstp = state => {
  const {
    app: {
      persisted: {autoRefresh},
    },
    links,
    auth: {me},
  } = state

  const meRole = _.get(me, 'role', null)
  const meCurrentOrganization = me.currentOrganization
  const meOrganizations = me.organizations

  return {
    meRole,
    meCurrentOrganization,
    meOrganizations,
    links,
    autoRefresh,
  }
}

const mdtp = dispatch => ({
  notify: bindActionCreators(notifyAction, dispatch),
  handleLoadCspsAsync: bindActionCreators(
    loadCloudServiceProvidersAsync,
    dispatch
  ),
})

export default connect(mstp, mdtp, null)(OpenStackPage)
