// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'
import {getDeep} from 'src/utils/wrappers'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'

// Components
import LayoutComponent from 'src/shared/components/Layout'
import BuiltinCellRenderer from 'src/shared/components/BuiltinCellRenderer'
import {
  isBuiltinCell,
  getBuiltinCellComponent,
} from 'src/shared/components/BuiltinCellRegistry'
import {HostTableCellContainerProps} from 'src/shared/components/builtinCells/HostTableCell'
import {ManualRefreshProps} from 'src/shared/components/ManualRefresh'
import {initHostTableCell} from 'src/shared/components/builtinCells/HostTableCell'
import {Page, OverlayTechnology, Button, IconFont} from 'src/reusable_ui'
import {ErrorHandling} from 'src/shared/decorators/errors'
import CellEditorOverlay from 'src/dashboards/components/CellEditorOverlay'

const GridLayout = WidthProvider(ReactGridLayout)

// APIs
import {
  getCpuAndLoadForHosts,
  getLayouts,
  getAppsForHosts,
  getAppsForHost,
  getMeasurementsForHost,
} from 'src/hosts/apis'
import {getEnv} from 'src/shared/apis/env'
import {
  getBuiltinDashboard,
  updateDashboard,
  getBuiltinDashboardTemplate,
  createDashboard,
} from 'src/dashboards/apis'

// Actions
import {
  setAutoRefresh,
  delayEnablePresentationMode,
} from 'src/shared/actions/app'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {loadCloudServiceProvidersAsync} from 'src/hosts/actions'
import * as dashboardActions from 'src/dashboards/actions'
import * as cellEditorOverlayActions from 'src/dashboards/actions/cellEditorOverlay'

// Utils
import {generateForHosts} from 'src/utils/tempVars'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

// Constants
import {
  notifyUnableToGetHosts,
  notifyUnableToGetApps,
  defaultErrorNotification,
  defaultSuccessNotification,
} from 'src/shared/copy/notifications'
import {notIncludeApps} from 'src/hosts/constants/apps'
import {DASHBOARD_LAYOUT_ROW_HEIGHT, LAYOUT_MARGIN} from 'src/shared/constants'

// Types
import {
  Source,
  Links,
  NotificationAction,
  RemoteDataState,
  Host,
  Layout,
  TimeRange,
  RefreshRate,
  Me,
  Cell,
  CellType,
  Template,
} from 'src/types'
import {NoteVisibility, Dashboard} from 'src/types/dashboards'
import * as QueriesModels from 'src/types/queries'
import * as AppActions from 'src/types/actions/app'
import {CloudAutoRefresh} from 'src/clouds/types/type'
import {DashboardItem, NewDefaultCell} from 'src/types/dashboards'
import {Links as FluxLinks} from 'src/types/flux'
import * as SourcesModels from 'src/types/sources'
import {EDITOR_ROLE, isUserAuthorized} from 'src/auth/Authorized'

interface Auth {
  me: Me
}

export interface Props extends ManualRefreshProps {
  source: Source
  links: Links
  autoRefresh: number
  cloudAutoRefresh: CloudAutoRefresh
  inPresentationMode: boolean
  timeRange: TimeRange
  auth: Auth
  onChooseAutoRefresh: (milliseconds: RefreshRate) => void
  handleClearTimeout: (key: string) => void
  notify: NotificationAction
  handleChooseTimeRange: (timeRange: QueriesModels.TimeRange) => void
  handleChooseAutoRefresh: AppActions.SetAutoRefreshActionCreator
  handleClickPresentationButton: AppActions.DelayEnablePresentationModeDispatcher
  handleClickTableRow: () => void
  tableTitle: () => JSX.Element
  templates?: Template[]
  onAddCellsFromLibrary?: DashboardItem[]
  onCellsAdded?: () => void
  fluxLinks: FluxLinks
  sources: SourcesModels.Source[]
  isUsingAuth: boolean
  editCellQueryStatus: typeof dashboardActions.editCellQueryStatus
  handleClearCEO: typeof cellEditorOverlayActions.clearCEO
  cellQueryStatus: QueriesModels.QueryStatus
}

interface State {
  hostsObject: {[x: string]: Host}
  layouts: Layout[]
  filteredLayouts: Layout[]
  focusedHost: string
  activeCspTab: string
  hostPageStatus: RemoteDataState
  cellsLayout: Cell[] // 셀 레이아웃 저장
  showCellEditorOverlay: boolean
  selectedCell: Cell | NewDefaultCell | null
  builtinDashboard: Dashboard | null // Store에 저장된 builtin dashboard 인스턴스
}

@ErrorHandling
export class HostsPageHostTab extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    manualRefresh: 0,
  }
  public intervalID: number
  private isComponentMounted: boolean = true

  constructor(props: Props) {
    super(props)

    this.setState = (args, callback) => {
      if (!this.isComponentMounted) return
      PureComponent.prototype.setState.bind(this)(args, callback)
    }

    // Initialize builtin cell components used in this container
    initHostTableCell()

    this.state = {
      hostsObject: {},
      layouts: [],
      filteredLayouts: [],
      focusedHost: '',
      activeCspTab: 'Host',
      hostPageStatus: RemoteDataState.NotStarted,
      cellsLayout: [],
      showCellEditorOverlay: false,
      selectedCell: null,
      builtinDashboard: null,
    }
  }

  public async componentDidMount() {
    const {notify, cloudAutoRefresh} = this.props

    // Store에 저장된 builtin dashboard 인스턴스 로드
    const builtinDashboard = await getBuiltinDashboard.hostPage()

    if (builtinDashboard) {
      this.setState({builtinDashboard})
    }
    console.log(builtinDashboard)

    const layoutResults = await getLayouts()

    const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

    if (!layouts) {
      notify(notifyUnableToGetApps())
      this.setState({
        hostPageStatus: RemoteDataState.Error,
        layouts,
      })
      return
    }

    const filterLayouts = _.filter(
      layouts,
      m => !_.includes(notIncludeApps, m.app)
    )

    const defaultState = {
      focusedHost: '',
      focusedInstance: null,
      selectedAgent: 'ALL',
      selectedNamespace: 'ALL',
      activeCspTab: 'Host',
    }
    const hostsPage = defaultState

    if (cloudAutoRefresh.host) {
      clearInterval(this.intervalID)
      this.intervalID = window.setInterval(
        () => this.fetchHostsData(filterLayouts),
        cloudAutoRefresh.host
      )
    }

    GlobalAutoRefresher.poll(cloudAutoRefresh.host)

    const hostID = hostsPage.focusedHost
    if (hostID === '') {
      await this.fetchHostsData(filterLayouts)
      const {filteredLayouts} = await this.getLayoutsforHost(
        filterLayouts,
        this.state.focusedHost
      )
      this.setState({filteredLayouts})
    } else {
      this.setState({
        layouts: filterLayouts,
        focusedHost: hostID,
      })
    }
  }

  public async componentDidUpdate(prevProps: Props, prevState: State) {
    // Dashboard Items이 선택되었을 때 cell들 추가
    if (
      this.props.onAddCellsFromLibrary &&
      this.props.onAddCellsFromLibrary !== prevProps.onAddCellsFromLibrary &&
      this.props.onAddCellsFromLibrary.length > 0
    ) {
      this.addCellsFromLibrary(this.props.onAddCellsFromLibrary)
    }
    const {cloudAutoRefresh} = this.props
    const {layouts, focusedHost} = this.state

    if (layouts) {
      if (prevState.focusedHost !== focusedHost) {
        this.fetchHostsData(layouts)
        const {filteredLayouts} = await this.getLayoutsforHost(
          layouts,
          focusedHost
        )
        this.setState({filteredLayouts})
      }

      if (prevProps.cloudAutoRefresh.host !== cloudAutoRefresh.host) {
        GlobalAutoRefresher.poll(cloudAutoRefresh.host)
      }
    }
  }

  public async UNSAFE_componentWillReceiveProps(nextProps: Props) {
    const {layouts, focusedHost} = this.state

    if (layouts) {
      if (this.props.manualRefresh !== nextProps.manualRefresh) {
        await this.fetchHostsData(layouts)
        const {filteredLayouts} = await this.getLayoutsforHost(
          layouts,
          focusedHost
        )
        this.setState({filteredLayouts})
      }

      if (
        this.props.cloudAutoRefresh.host !== nextProps.cloudAutoRefresh.host
      ) {
        clearInterval(this.intervalID)
        GlobalAutoRefresher.poll(nextProps.cloudAutoRefresh.host)

        if (nextProps.cloudAutoRefresh.host) {
          this.intervalID = window.setInterval(
            () => this.fetchHostsData(layouts),
            nextProps.cloudAutoRefresh.host
          )
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
    const {
      source,
      manualRefresh,
      timeRange,
      templates,
      fluxLinks,
      sources,
      auth,
      isUsingAuth,
      notify,
      editCellQueryStatus,

      cellQueryStatus,
      autoRefresh,
    } = this.props
    const {
      focusedHost,
      hostsObject,
      hostPageStatus,
      showCellEditorOverlay,
      selectedCell,
    } = this.state

    // templates prop이 있으면 사용, 없으면 기본값 사용
    const tempVars = templates || generateForHosts(source)

    // getAllCells()를 사용하여 builtin dashboard의 cells 포함하여 모든 셀 가져오기
    const allCells = this.getAllCells()

    // 권한 체크 (에디터 이상)
    const isEditorOrAbove =
      auth.me &&
      auth.me.roles &&
      auth.me.roles.some(r => isUserAuthorized(r.name, EDITOR_ROLE))

    return (
      <Page.Contents fullWidth={true}>
        {isEditorOrAbove && (
          <div
            style={{
              padding: '10px',
              display: 'flex',
              justifyContent: 'flex-end',
              borderBottom: '1px solid #e0e0e0',
            }}
          >
            <Button
              text="Reset to Default"
              icon={IconFont.Refresh}
              onClick={this.handleResetToDefault}
              titleText="Reset dashboard to original JSON template"
            />
          </div>
        )}
        <OverlayTechnology visible={showCellEditorOverlay}>
          {selectedCell && (
            <CellEditorOverlay
              source={source}
              sources={sources}
              me={auth.me}
              isUsingAuth={isUsingAuth}
              notify={notify}
              fluxLinks={fluxLinks}
              cell={selectedCell}
              dashboardID="hosts-page"
              queryStatus={cellQueryStatus}
              onSave={this.handleSaveEditedCell}
              onCancel={this.handleHideCellEditorOverlay}
              dashboardTemplates={templates || []}
              editQueryStatus={editCellQueryStatus}
              dashboardTimeRange={timeRange}
              dashboardRefresh={autoRefresh}
            />
          )}
        </OverlayTechnology>
        <div className="dashboard container-fluid full-width">
          {allCells.length > 0 && (
            <GridLayout
              className="layout"
              layout={allCells}
              cols={96}
              rowHeight={DASHBOARD_LAYOUT_ROW_HEIGHT}
              margin={[LAYOUT_MARGIN, LAYOUT_MARGIN]}
              containerPadding={[0, 0]}
              draggableHandle={null}
              onLayoutChange={this.handleLayoutChange}
              useCSSTransforms={false}
              isDraggable={true}
              isResizable={true}
              onResizeStop={(_, __, ___, ____, _____, resizeHandle) => {
                const parentElement = resizeHandle?.parentElement
                if (parentElement?.classList.contains('resizing')) {
                  parentElement.classList.remove('resizing')
                }
              }}
            >
              {allCells.map(cell => (
                <div key={cell.i}>
                  {this.renderCell(cell, {
                    source,
                    manualRefresh,
                    timeRange,
                    tempVars,
                    focusedHost,
                    hostsObject,
                    hostPageStatus,
                  })}
                </div>
              ))}
            </GridLayout>
          )}
        </div>
      </Page.Contents>
    )
  }

  private handleLayoutChange = async (layout: any[]) => {
    const newCells = this.getAllCells().map(cell => {
      const l = layout.find(ly => ly.i === cell.i)
      if (!l) return cell

      return {
        ...cell,
        x: l.x,
        y: l.y,
        h: l.h,
        w: l.w,
      }
    })

    this.setState({cellsLayout: newCells})

    // 권한 체크 (에디터 이상)
    const {auth} = this.props
    const isEditorOrAbove =
      auth.me &&
      auth.me.roles &&
      auth.me.roles.some(r => isUserAuthorized(r.name, EDITOR_ROLE))

    if (isEditorOrAbove && this.state.builtinDashboard) {
      // 에디터 이상: Store에 저장된 builtin dashboard 인스턴스 업데이트
      try {
        const updatedDashboard = {
          ...this.state.builtinDashboard,
          cells: newCells,
        }
        await updateDashboard(updatedDashboard)
        // 업데이트 후 다시 로드하여 최신 상태 유지
        const reloaded = await getBuiltinDashboard.hostPage()
        if (reloaded) {
          this.setState({builtinDashboard: reloaded})
        }
      } catch (error) {
        console.error('Failed to update builtin dashboard:', error)
      }
    }
  }

  private addCellsFromLibrary = (dashboardItems: DashboardItem[]) => {
    const {cellsLayout} = this.state
    const cols = 96 // Total columns

    let updatedCellsLayout = [...cellsLayout]

    // host-table-cell의 높이 확인 (Ceiling)
    const hostTableCell = updatedCellsLayout.find(
      c => c.i === 'host-table-cell'
    )
    const hostTableHeight = hostTableCell ? hostTableCell.h : 25

    // Helper to check collision
    const isColliding = (
      x: number,
      y: number,
      w: number,
      h: number,
      cells: Cell[]
    ) => {
      for (const cell of cells) {
        if (cell.i === 'host-table-cell') continue // host table is usually at 0,0 but we treat it as ceiling

        // Simple AABB collision
        if (
          x < cell.x + cell.w &&
          x + w > cell.x &&
          y < cell.y + cell.h &&
          y + h > cell.y
        ) {
          return true
        }
      }
      return false
    }

    dashboardItems.forEach((item, index) => {
      // Dashboard Item의 content를 가져옴
      const itemCell = item.content
      const cellW = itemCell.w || 24
      const cellH = itemCell.h || 20

      // 새로운 고유 ID 생성
      const newCellId = `library-cell-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 5)}-${index}`

      // 1. Find the last cell to determine starting point candidates
      // Sort by Y then X to find the visual "end"
      const sortedCells = [...updatedCellsLayout].sort((a, b) => {
        if (a.y === b.y) return a.x - b.x
        return a.y - b.y
      })

      const lastCell = sortedCells[sortedCells.length - 1]

      let candidateX = 0
      let candidateY = hostTableHeight

      if (lastCell) {
        // Try placing to the right of the last cell
        if (lastCell.x + lastCell.w + cellW <= cols) {
          candidateX = lastCell.x + lastCell.w
          candidateY = lastCell.y
        } else {
          // Should wrap to next line
          // But simply lastCell.y + lastCell.h might not be the true bottom if there are taller cells?
          // Safe bet: find max bottom
        }
      }

      // If 'Append Right' is invalid (collision or OOB), default to 'New Line'
      // To be robust, let's just calculation MaxY for new line fallback
      const maxY = updatedCellsLayout.reduce(
        (max, cell) => Math.max(max, cell.y + cell.h),
        hostTableHeight
      )

      // Verify the 'Append Right' candidate
      let finalX = 0
      let finalY = maxY

      if (lastCell && candidateX > 0) {
        // candidateX > 0 implies we moved right
        // Check collision at candidate position
        if (
          !isColliding(candidateX, candidateY, cellW, cellH, updatedCellsLayout)
        ) {
          finalX = candidateX
          finalY = candidateY
        }
      }

      // 새로운 cell 생성
      const newCell: Cell = {
        ...itemCell,
        i: newCellId,
        x: finalX,
        y: finalY,
        w: cellW,
        h: cellH,
        name: item.name,
      }

      updatedCellsLayout.push(newCell)
    })

    this.setState({cellsLayout: updatedCellsLayout})

    // Infrastructure에서 상태 초기화를 위해 부모에게 알림
    if (this.props.onCellsAdded) {
      this.props.onCellsAdded()
    }
  }

  private getAllCells = (): Cell[] => {
    const {cellsLayout, builtinDashboard} = this.state

    // builtin 대시보드 기준 셀 목록 확보
    const baseBuiltinCells = builtinDashboard?.cells || []

    // host-table-cell 우선 확보 (builtin에 없으면 기본값 생성)
    let finalHostTableCell =
      baseBuiltinCells.find(c => c.i === 'host-table-cell') || null

    // builtin 셀에 대해 cellsLayout 오버라이드 적용
    const builtinCellsWithOverrides = baseBuiltinCells.map(cell => {
      const override = cellsLayout.find(c => c.i === cell.i)
      return override ? {...cell, ...override} : cell
    })

    // host-table-cell 제외한 builtin 셀
    const builtinCells = builtinCellsWithOverrides.filter(
      c => !finalHostTableCell || c.i !== finalHostTableCell.i
    )

    // 커스텀 셀: builtin에 없는 cellsLayout 항목
    const builtinIds = new Set([
      ...builtinCellsWithOverrides.map(c => c.i),
      ...(finalHostTableCell ? [finalHostTableCell.i] : []),
    ])
    const customCells = cellsLayout.filter(cell => !builtinIds.has(cell.i))

    // 병합 및 중복 제거
    const merged = [
      ...(finalHostTableCell ? [finalHostTableCell] : []),
      ...builtinCells,
      ...customCells,
    ]
    const seen = new Set<string>()
    return merged.filter(cell => {
      if (!cell || !cell.i || seen.has(cell.i)) return false
      seen.add(cell.i)
      return true
    })
  }

  private renderCell = (
    cell: Cell,
    props: {
      source: Source
      manualRefresh: number
      timeRange: TimeRange
      tempVars: any[]
      focusedHost: string
      hostsObject: {[x: string]: Host}
      hostPageStatus: RemoteDataState
    }
  ) => {
    if (isBuiltinCell(cell)) {
      const registryEntry = getBuiltinCellComponent(cell)
      if (!registryEntry) {
        return null
      }

      const containerProps: HostTableCellContainerProps = {
        hostsObject: props.hostsObject,
        hostPageStatus: props.hostPageStatus,
        onClickTableRow: this.handleClickTableRow,
        tableTitle: this.props.tableTitle,
        focusedHost: props.focusedHost,
      }

      const cellSpecificProps = registryEntry.getProps
        ? registryEntry.getProps(containerProps)
        : {}

      return (
        <BuiltinCellRenderer
          cell={cell}
          source={props.source}
          timeRange={props.timeRange}
          {...cellSpecificProps}
        />
      )
    }

    // 일반 그래프 셀인 경우 - 기존 Layout 컴포넌트 사용
    // isEditable을 true로 설정하여 드래그 핸들이 표시되도록 함
    return (
      <LayoutComponent
        key={cell.i}
        cell={cell}
        source={props.source}
        sources={[props.source]}
        templates={props.tempVars}
        timeRange={props.timeRange}
        isEditable={true}
        manualRefresh={props.manualRefresh}
        host={props.focusedHost}
        instance={null}
        onZoom={undefined}
        onDeleteCell={() => this.handleDeleteCell(cell)}
        onCloneCell={undefined}
        onSummonOverlayTechnologies={() =>
          this.handleShowCellEditorOverlay(cell)
        }
      />
    )
  }

  private handleDeleteCell = async (cell: Cell) => {
    const {builtinDashboard} = this.state
    const {auth} = this.props

    // 현재 화면에 반영된 모든 셀 기준으로 삭제 수행
    const mergedCells = this.getAllCells().filter(c => c.i !== cell.i)

    // 권한 체크 (에디터 이상)
    const isEditorOrAbove =
      auth.me &&
      auth.me.roles &&
      auth.me.roles.some(r => isUserAuthorized(r.name, EDITOR_ROLE))

    // 대시보드 인스턴스가 있다면 함께 업데이트
    if (builtinDashboard) {
      const updatedDashboard = {
        ...builtinDashboard,
        cells: mergedCells,
      }

      this.setState({
        cellsLayout: mergedCells,
        builtinDashboard: updatedDashboard,
      })

      if (isEditorOrAbove) {
        try {
          await updateDashboard(updatedDashboard)
          return
        } catch (error) {
          console.error('Failed to delete cell on builtin dashboard:', error)
        }
      }
    }

    // fallback: 로컬 상태/스토리지만 갱신
    this.setState({cellsLayout: mergedCells})
  }

  private handleShowCellEditorOverlay = (cell: Cell): void => {
    this.setState({selectedCell: cell, showCellEditorOverlay: true})
  }

  private handleHideCellEditorOverlay = () => {
    const {handleClearCEO} = this.props
    const WAIT_FOR_ANIMATION = 400

    this.setState({showCellEditorOverlay: false})
    window.setTimeout(() => {
      handleClearCEO()
    }, WAIT_FOR_ANIMATION)
  }

  private handleSaveEditedCell = async (
    newCell: Cell | NewDefaultCell
  ): Promise<void> => {
    const {builtinDashboard} = this.state
    const {auth} = this.props

    // 현재 화면 기준의 전체 셀 목록을 기반으로 업데이트
    const currentCells = this.getAllCells()
    const cellId = (newCell as Cell).i

    let updatedCells: Cell[]
    if (cellId) {
      updatedCells = currentCells.map(cell =>
        cell.i === cellId ? (newCell as Cell) : cell
      )
    } else {
      updatedCells = [...currentCells, newCell as Cell]
    }

    // 권한 체크 (에디터 이상)
    const isEditorOrAbove =
      auth.me &&
      auth.me.roles &&
      auth.me.roles.some(r => isUserAuthorized(r.name, EDITOR_ROLE))

    if (isEditorOrAbove && builtinDashboard) {
      try {
        const updatedDashboard = {
          ...builtinDashboard,
          cells: updatedCells,
        }
        await updateDashboard(updatedDashboard)
        this.setState({
          cellsLayout: updatedCells,
          builtinDashboard: updatedDashboard,
        })
        this.handleHideCellEditorOverlay()
        return
      } catch (error) {
        console.error('Failed to update builtin dashboard:', error)
      }
    }

    // fallback: 로컬 상태만 업데이트
    this.setState({cellsLayout: updatedCells})
    this.handleHideCellEditorOverlay()
  }

  private async getLayoutsforHost(layouts: Layout[], hostID: string) {
    const {host, measurements} = await this.fetchHostsAndMeasurements(
      layouts,
      hostID
    )

    const layoutsWithinHost = layouts.filter(layout => {
      return (
        host.apps &&
        host.apps.includes(layout.app) &&
        measurements.includes(layout.measurement)
      )
    })
    const filteredLayouts = layoutsWithinHost
      .filter(layout => {
        return layout.app === 'system' || layout.app === 'win_system'
      })
      .sort((x, y) => {
        return x.measurement < y.measurement
          ? -1
          : x.measurement > y.measurement
          ? 1
          : 0
      })

    return {filteredLayouts}
  }

  private async fetchHostsData(
    layouts: Layout[]
  ): Promise<{[host: string]: Host}> {
    const {source, links, notify, auth} = this.props
    const {focusedHost} = this.state
    const envVars = await getEnv(links.environment)
    const telegrafSystemInterval = getDeep<string>(
      envVars,
      'telegrafSystemInterval',
      ''
    )

    const hostsError = notifyUnableToGetHosts().message
    const tempVars = generateForHosts(source)
    const meRole = _.get(auth, 'me.role', '')

    try {
      const hostsObject = await getCpuAndLoadForHosts(
        source.links.proxy,
        source.telegraf,
        telegrafSystemInterval,
        tempVars,
        meRole
      )
      if (!hostsObject) {
        throw new Error(hostsError)
      }
      const newHosts = await getAppsForHosts(
        source.links.proxy,
        hostsObject,
        layouts,
        source.telegraf,
        tempVars
      )

      if (_.isEmpty(focusedHost)) {
        this.setState({
          focusedHost: this.getFirstHost(newHosts),
          hostsObject: newHosts,
          layouts: layouts,
          hostPageStatus: RemoteDataState.Done,
        })
      } else {
        if (!_.includes(_.keys(newHosts), focusedHost)) {
          this.setState({
            focusedHost: this.getFirstHost(newHosts),
            hostsObject: newHosts,
            hostPageStatus: RemoteDataState.Done,
          })
        } else {
          this.setState({
            hostsObject: newHosts,
            hostPageStatus: RemoteDataState.Done,
          })
        }
      }

      return newHosts
    } catch (error) {
      console.error(error)
      notify(notifyUnableToGetHosts())
      this.setState({
        hostPageStatus: RemoteDataState.Error,
      })
    }
  }

  private async fetchHostsAndMeasurements(layouts: Layout[], hostID: string) {
    const {source} = this.props

    const tempVars = generateForHosts(source)

    const fetchMeasurements = getMeasurementsForHost(source, hostID)
    const fetchHosts = getAppsForHost(
      source.links.proxy,
      hostID,
      layouts,
      source.telegraf,
      tempVars
    )

    const [host, measurements] = await Promise.all([
      fetchHosts,
      fetchMeasurements,
    ])

    return {host, measurements}
  }

  private getFirstHost = (hostsObject: {[x: string]: Host}): string => {
    const hostsArray = _.values(hostsObject)
    return hostsArray.length > 0 ? hostsArray[0].name : null
  }

  private handleClickTableRow = (hostName: string) => () => {
    this.setState({focusedHost: hostName})
  }

  /**
   * Reset builtin dashboard to original JSON template
   */
  private handleResetToDefault = async () => {
    const {notify, auth} = this.props

    // 권한 체크 (에디터 이상)
    const isEditorOrAbove =
      auth.me &&
      auth.me.roles &&
      auth.me.roles.some(r => isUserAuthorized(r.name, EDITOR_ROLE))

    if (!isEditorOrAbove) {
      notify({
        ...defaultErrorNotification,
        message: 'Permission denied. Editor role required.',
      })
      return
    }

    try {
      // 백엔드에서 원본 템플릿 가져오기
      const template = await getBuiltinDashboardTemplate.hostPage()
      if (!template) {
        notify({
          ...defaultErrorNotification,
          message: 'Failed to load original template',
        })
        return
      }

      // 기존 builtin dashboard 찾기 (없을 수도 있음)
      const existingDashboard = await getBuiltinDashboard.hostPage()

      let resetDashboard: Dashboard

      if (existingDashboard) {
        // 기존 대시보드가 있으면 업데이트 (id, organization, links 유지)
        resetDashboard = {
          ...template,
          id: existingDashboard.id,
          organization: existingDashboard.organization,
          type: 'builtin',
          links: existingDashboard.links, // links 유지 (updateDashboard에서 필요)
        }
        await updateDashboard(resetDashboard)
      } else {
        // 기존 대시보드가 없으면 새로 생성
        resetDashboard = {
          ...template,
          type: 'builtin',
        }
        const {data} = await createDashboard(resetDashboard)
        resetDashboard = data
      }

      // 성공 시 상태 업데이트
      this.setState({
        builtinDashboard: resetDashboard,
        cellsLayout: [],
      })
      notify({
        ...defaultSuccessNotification,
        message: 'Dashboard reset to default successfully',
      })
    } catch (error) {
      console.error('Failed to reset dashboard:', error)
      notify({
        ...defaultErrorNotification,
        message: 'Failed to reset dashboard',
      })
    }
  }
}

const mstp = state => {
  const {
    app: {
      persisted: {cloudAutoRefresh},
      ephemeral: {inPresentationMode},
    },
    links,
    auth,
    sources,
    dashboardUI: {cellQueryStatus},
  } = state
  return {
    links,
    cloudAutoRefresh,
    inPresentationMode,
    auth,
    fluxLinks: links.flux || {},
    sources: sources || [],
    isUsingAuth: auth.isUsingAuth || false,
    cellQueryStatus: cellQueryStatus || {queryID: '', status: ''},
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
  editCellQueryStatus: bindActionCreators(
    dashboardActions.editCellQueryStatus,
    dispatch
  ),
  handleClearCEO: bindActionCreators(
    cellEditorOverlayActions.clearCEO,
    dispatch
  ),
})

export default connect(mstp, mdtp, null)(HostsPageHostTab)
