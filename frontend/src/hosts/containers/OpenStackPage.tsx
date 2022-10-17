// libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import {bindActionCreators} from 'redux'

// middleware
const GridLayout = WidthProvider(ReactGridLayout)

// constants
import {
  notifyUnableToGetApps,
  notifyUnableToGetHosts,
} from 'src/shared/copy/notifications'

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
  RefreshRate,
} from 'src/types'
import {
  OpenStackInstance,
  OpenStackLayoutCell,
  OpenStackProject,
} from 'src/hosts/types/openstack'
import {loadCloudServiceProvidersAsync} from 'src/hosts/actions'
import {
  delayEnablePresentationMode,
  setAutoRefresh,
} from 'src/shared/actions/app'
import * as QueriesModels from 'src/types/queries'
import * as AppActions from 'src/types/actions/app'

// Components
import {ManualRefreshProps} from 'src/shared/components/ManualRefresh'
import {ErrorHandling} from 'src/shared/decorators/errors'
import PageSpinner from 'src/shared/components/PageSpinner'
import {AddonType, LAYOUT_MARGIN} from 'src/shared/constants'
import {Page} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import OpenStackPageInstanceOverview from 'src/hosts/components/OpenStackPageInstanceOverview'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import OpenStackPageInstanceTable from 'src/hosts/components/OpenStackPageInstanceTable'
import OpenStackProjectGaugeChartLayout from 'src/hosts/components/OpenStackProjectGaugeChartLayout'
import OpenStackPageProjectTable from 'src/hosts/components/OpenStackPageProjectTable'

// utils
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {getCells} from 'src/hosts/utils/getCells'
import {generateForHosts} from 'src/utils/tempVars'
import {getDeep} from 'src/utils/wrappers'

// api
import {getLayouts} from 'src/hosts/apis'
import {getOpenStackProjectsAsync} from 'src/hosts/actions/inventoryTopology'

// constants
import Authorized, {ADMIN_ROLE} from 'src/auth/Authorized'
import {getOpenStackPageLayoutsByRole} from 'src/hosts/constants/layout'

interface Props extends ManualRefreshProps {
  meRole: string
  source: Source
  links: Links
  autoRefresh: number
  timeRange: TimeRange
  inPresentationMode: boolean
  notify: NotificationAction
  onChooseAutoRefresh: (milliseconds: RefreshRate) => void
  handleClearTimeout: (key: string) => void
  handleChooseTimeRange: (timeRange: QueriesModels.TimeRange) => void
  handleChooseAutoRefresh: AppActions.SetAutoRefreshActionCreator
  handleClickPresentationButton: AppActions.DelayEnablePresentationModeDispatcher
  handleLoadCspsAsync: () => Promise<any>
  handleGetOpenStackProjectsAsync: (
    saltMasterUrl: string,
    saltMasterToken: string,
    pCsp: any[]
  ) => Promise<any>
}

interface CloudObject {
  [projectName: string]: OpenStackInstance
}

interface State {
  focusedInstance: Partial<OpenStackInstance>
  focusedProject: Partial<OpenStackProject>
  layouts: Layout[]
  filteredLayouts: Layout[]
  projects: Partial<OpenStackProject[]>
  cloudAccessInfos: any[]
  cloudObject: CloudObject
  openStackPageStatus: RemoteDataState
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
  constructor(props: Props) {
    super(props)

    this.setState = (args, callback) => {
      if (!this.isComponentMounted) return
      PureComponent.prototype.setState.bind(this)(args, callback)
    }

    this.state = {
      focusedInstance: {},
      focusedProject: {},
      layouts: [],
      filteredLayouts: [],
      openStackPageStatus: RemoteDataState.NotStarted,
      cloudAccessInfos: [],
      cloudObject: {},
      projects: [],
      openStackLayouts: [],
    }
  }

  public async componentDidMount() {
    const convertOpenStackLayouts = getOpenStackPageLayoutsByRole
    const layoutResults = await getLayouts()

    const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

    if (!layouts) {
      notify(notifyUnableToGetApps())
      this.setState({
        openStackPageStatus: RemoteDataState.Error,
        layouts,
      })
      return
    }
    try {
      await this.fetchOpenStackData(layouts)
      this.onSetFocusedProject()
      this.onSetFocusedInstance()

      this.setState(state => {
        return {
          ...state,
          openStackPageStatus: RemoteDataState.Done,
          openStackLayouts: convertOpenStackLayouts,
        }
      })
    } catch (error) {
      this.setState({
        openStackPageStatus: RemoteDataState.Done,
        openStackLayouts: convertOpenStackLayouts,
      })
    }
  }

  componentDidUpdate(_, prevState: Readonly<State>): void {
    const {focusedProject} = this.state
    const {focusedProject: preFocusedProject} = prevState
  }
  public async UNSAFE_componentWillReceiveProps(nextProps: Props) {
    const {layouts, focusedInstance} = this.state

    if (layouts) {
      if (this.props.manualRefresh !== nextProps.manualRefresh) {
        this.fetchOpenStackData(layouts)
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
          this.intervalID = window.setInterval(() => {
            this.fetchOpenStackData(layouts)
          }, nextProps.autoRefresh)
        }
      }
    }
  }

  public componentWillUnmount() {
    clearInterval(this.intervalID)
    this.intervalID = null
    GlobalAutoRefresher.stopPolling()

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
          draggableHandle={'.dash-graph--draggable'}
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
  private openStackPageRender(layout): JSX.Element {
    const {focusedProject, openStackPageStatus} = this.state
    switch (layout.i) {
      case 'projectTable': {
        const {projects, focusedProject} = this.state
        const {source} = this.props

        return (
          <Authorized requiredRole={ADMIN_ROLE}>
            <OpenStackPageProjectTable
              projects={projects}
              openStackPageStatus={openStackPageStatus}
              source={source}
              focusedProject={focusedProject}
              onClickTableRow={this.handleClickProjectTableRow}
            />
          </Authorized>
        )
      }

      case 'projectDetail': {
        return (
          <OpenStackProjectGaugeChartLayout
            gaugeChartState={openStackPageStatus}
            projectName={focusedProject?.projectData.projectName || ''}
            projectData={focusedProject?.projectData.chart}
          />
        )
      }

      case 'instanceDetail': {
        const {focusedInstance} = this.state

        return (
          <OpenStackPageInstanceOverview focusedInstance={focusedInstance} />
        )
      }

      case 'instanceTable': {
        const {
          focusedProject,
          openStackPageStatus,
          focusedInstance,
        } = this.state
        const {source} = this.props

        return (
          <OpenStackPageInstanceTable
            openStackPageStatus={openStackPageStatus}
            source={source}
            focusedProject={focusedProject}
            focusedInstance={focusedInstance}
            onClickTableRow={this.handleClickInstanceTableRow}
          />
        )
      }

      case 'instanceGraph': {
        const {source, manualRefresh, timeRange} = this.props
        const {filteredLayouts, focusedInstance} = this.state
        const layoutCells = getCells(filteredLayouts, source)
        const tempVars = generateForHosts(source)

        return (
          <>
            <Page.Contents>
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
                instance={focusedInstance}
                host={''}
              />
            </Page.Contents>
          </>
        )
      }
    }
  }

  private get LoadingState(): JSX.Element {
    return <PageSpinner />
  }

  private handleLayoutChange = layout => {
    let changed = false
    const {openStackLayouts} = this.state
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

  private async fetchOpenStackData(layouts) {
    const {
      handleLoadCspsAsync,
      source,
      handleGetOpenStackProjectsAsync,
      notify,
      meRole,
    } = this.props

    try {
      const namespace = []
      let resProjects = await handleGetOpenStackProjectsAsync(
        this.salt.url,
        this.salt.token,
        namespace
      )

      const dbResp = []
      this.setState({
        cloudAccessInfos: dbResp,
        projects: resProjects,
      })
    } catch (error) {
      console.error(error)
      notify(notifyUnableToGetHosts())
    }
  }

  private async getLayoutsforInstance(layouts, focusedInstance) {
    const instance = {}
    const filteredLayouts = []
    return {instance, filteredLayouts}
  }

  private handleClickInstanceTableRow = (instance: OpenStackInstance) => () => {
    const {focusedProject} = this.state
    this.onSetFocusedInstance({focusedInstance: instance, focusedProject})
  }

  private handleClickProjectTableRow = (
    focusedProject: OpenStackProject
  ) => () => {
    this.onSetFocusedProject(focusedProject)
    this.onSetFocusedInstance({focusedProject})
  }

  private onSetFocusedProject = (focusedProject?) => {
    const {projects} = this.state

    if (_.isEmpty(focusedProject) && !_.isEmpty(projects)) {
      this.setState({
        focusedProject: projects[0],
      })
    } else {
      this.setState({
        focusedProject: focusedProject,
      })
    }
  }

  private onSetFocusedInstance = ({
    focusedInstance = {},
    focusedProject = {} as Partial<OpenStackProject>,
  } = {}): void => {
    const {projects} = this.state
    const project = _.isEmpty(focusedProject) ? projects[0] : focusedProject

    this.setState({
      focusedInstance: _.isEmpty(focusedInstance)
        ? project.instances[0]
        : focusedInstance,
    })
  }
}

const mstp = state => {
  const {
    app: {
      persisted: {autoRefresh},
      ephemeral: {inPresentationMode},
    },
    links,
    auth: {me},
  } = state

  const meRole = _.get(me, 'role', null)
  return {
    meRole,
    links,
    autoRefresh,
    inPresentationMode,
  }
}

const mdtp = dispatch => ({
  onChooseAutoRefresh: bindActionCreators(setAutoRefresh, dispatch),
  handleClickPresentationButton: bindActionCreators(
    delayEnablePresentationMode,
    dispatch
  ),
  notify: bindActionCreators(notifyAction, dispatch),
  handleLoadCspsAsync: bindActionCreators(
    loadCloudServiceProvidersAsync,
    dispatch
  ),
  handleGetOpenStackProjectsAsync: bindActionCreators(
    getOpenStackProjectsAsync,
    dispatch
  ),
})

export default connect(mstp, mdtp, null)(OpenStackPage)
