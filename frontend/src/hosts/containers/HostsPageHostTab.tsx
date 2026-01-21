// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'
import {getDeep} from 'src/utils/wrappers'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'

// Components
import HostTable from 'src/hosts/components/HostsTable'
import LayoutComponent from 'src/shared/components/Layout'
import {ManualRefreshProps} from 'src/shared/components/ManualRefresh'
import {Page, OverlayTechnology} from 'src/reusable_ui'
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

// Actions
import {
  setAutoRefresh,
  delayEnablePresentationMode,
} from 'src/shared/actions/app'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {loadCloudServiceProvidersAsync} from 'src/hosts/actions'
import * as dashboardActions from 'src/dashboards/actions'
import * as cellEditorOverlayActions from 'src/dashboards/actions/cellEditorOverlay'

//Middleware
import {
  setLocalStorage,
  getLocalStorage,
} from 'src/shared/middleware/localStorage'

// Utils
import {generateForHosts} from 'src/utils/tempVars'
import {getCells} from 'src/hosts/utils/getCells'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

// Constants
import {
  notifyUnableToGetHosts,
  notifyUnableToGetApps,
} from 'src/shared/copy/notifications'
import {notIncludeApps} from 'src/hosts/constants/apps'
import {DASHBOARD_LAYOUT_ROW_HEIGHT, LAYOUT_MARGIN} from 'src/shared/constants'
import {NEW_DEFAULT_DASHBOARD_CELL} from 'src/dashboards/constants'
import {DEFAULT_AXIS} from 'src/dashboards/constants/cellEditor'
import {DEFAULT_LINE_COLORS} from 'src/shared/constants/graphColorPalettes'

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
  Axes,
  Template,
} from 'src/types'
import {NoteVisibility} from 'src/types/dashboards'
import * as QueriesModels from 'src/types/queries'
import * as AppActions from 'src/types/actions/app'
import {CloudAutoRefresh} from 'src/clouds/types/type'
import {DashboardItem, NewDefaultCell} from 'src/types/dashboards'
import {Links as FluxLinks} from 'src/types/flux'
import * as SourcesModels from 'src/types/sources'

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

    // 로컬 스토리지에서 셀 레이아웃 복원
    // 단, host-table-cell의 h 값이 너무 크면(50 이상) 초기화
    const savedLayout = getLocalStorage('hostsPageCellsLayout')
    let initialCellsLayout = []
    if (savedLayout && savedLayout.cellsLayout) {
      initialCellsLayout = savedLayout.cellsLayout.map(cell => {
        return cell
      })
    }

    this.state = {
      hostsObject: {},
      layouts: [],
      filteredLayouts: [],
      focusedHost: '',
      activeCspTab: 'Host',
      hostPageStatus: RemoteDataState.NotStarted,
      cellsLayout: initialCellsLayout,
      showCellEditorOverlay: false,
      selectedCell: null,
    }
  }

  public async componentDidMount() {
    const {notify, cloudAutoRefresh} = this.props

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

    const getLocalStorageInfrastructure = getLocalStorage('infrastructure')

    const defaultState = {
      focusedHost: '',
      focusedInstance: null,
      selectedAgent: 'ALL',
      selectedNamespace: 'ALL',
      activeCspTab: 'Host',
    }
    let hostsPage = _.get(
      getLocalStorageInfrastructure,
      'hostsPage',
      defaultState
    )
    const isEqualActiveCspTab =
      !_.isEmpty(hostsPage) &&
      hostsPage.activeCspTab === this.state.activeCspTab

    if (!isEqualActiveCspTab) {
      hostsPage = defaultState
    }

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

    const {activeCspTab, focusedHost} = this.state
    const getHostsPage = {
      hostsPage: {
        selectedAgent: 'ALL',
        selectedNamespace: 'ALL',
        activeCspTab: activeCspTab,
        focusedInstance: null,
        focusedHost: focusedHost,
      },
    }
    setLocalStorage('infrastructure', getHostsPage)

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
      handleClearCEO,
      cellQueryStatus,
      autoRefresh,
    } = this.props
    const {
      filteredLayouts,
      focusedHost,
      hostsObject,
      hostPageStatus,
      cellsLayout,
      showCellEditorOverlay,
      selectedCell,
    } = this.state

    // templates prop이 있으면 사용, 없으면 기본값 사용
    const tempVars = templates || generateForHosts(source)

    // 그래프 셀들 생성
    const graphCells = getCells(filteredLayouts, source)

    // HostTable을 위한 커스텀 셀 생성
    const hostTableCell: Cell = {
      ...NEW_DEFAULT_DASHBOARD_CELL,
      i: 'host-table-cell',
      x: 0,
      y: 0,
      w: 96, // 전체 너비
      h: 25, // 적절한 높이 (약 265px = 25 * 10.6)
      minW: 30,
      minH: 15,
      name: 'Host List',
      queries: [],
      type: CellType.Note,
      axes: {
        x: DEFAULT_AXIS,
        y: DEFAULT_AXIS,
      } as Axes,
      colors: DEFAULT_LINE_COLORS,
      tableOptions: {
        verticalTimeAxis: false,
        sortBy: {
          internalName: '',
          displayName: '',
          visible: true,
          direction: 'asc',
        },
        wrapping: '',
        fixFirstColumn: false,
      },
      fieldOptions: [],
      timeFormat: '',
      decimalPlaces: {isEnforced: false, digits: 2},
      legend: {},
      inView: true,
      note: '',
      noteVisibility: NoteVisibility.Default,
      links: {self: ''},
    }

    // 그래프 셀들의 y 위치를 hostTableCell 아래로 조정
    // 한 줄에 4개씩 배치되도록 w를 24로 고정 (24 * 4 = 96)
    const adjustedGraphCells = graphCells.map((cell, index) => {
      // 저장된 레이아웃이 있으면 사용, 없으면 기본 위치
      const savedCell = cellsLayout.find(c => c.i === cell.i)
      if (savedCell) {
        return {
          ...cell,
          x: savedCell.x,
          y: savedCell.y,
          w: savedCell.w || 24, // 저장된 값이 없으면 24 사용
          h: savedCell.h || 20,
        }
      }
      // 기본 위치: hostTableCell 아래에 배치
      const colsPerRow = 4
      const cellWidth = 24 // 한 줄에 4개씩 배치 (24 * 4 = 96)
      const row = Math.floor(index / colsPerRow)
      const col = index % colsPerRow
      return {
        ...cell,
        x: col * cellWidth, // 각 셀은 24 너비
        y: hostTableCell.h + row * 20, // hostTableCell 높이 아래부터 (h: 25)
        w: cellWidth, // 항상 24로 고정
        h: cell.h || 20,
      }
    })

    // 저장된 hostTableCell 레이아웃이 있으면 사용
    // 단, h 값이 너무 크면(40 이상) 기본값 사용하여 h 값이 무시되지 않도록 함
    const savedHostTableCell = cellsLayout.find(c => c.i === 'host-table-cell')
    const finalHostTableCell =
      savedHostTableCell && savedHostTableCell.h <= 40
        ? {...hostTableCell, ...savedHostTableCell}
        : hostTableCell

    // 모든 셀 합치기
    // 1. System Graph Cells (adjusted) is already defined above

    // 2. Custom Cells (Imported)
    // Filter cells from cellsLayout that are NOT in graphCells AND NOT host-table-cell
    const systemCellIds = new Set(graphCells.map(c => c.i))
    systemCellIds.add('host-table-cell')

    const customCells = cellsLayout.filter(cell => !systemCellIds.has(cell.i))

    const allCells = [finalHostTableCell, ...adjustedGraphCells, ...customCells]

    return (
      <Page.Contents fullWidth={true}>
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
              dashboardID="hosts-page" // hosts 페이지는 고정 ID 사용
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

  private handleLayoutChange = (layout: any[]) => {
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
    setLocalStorage('hostsPageCellsLayout', {
      cellsLayout: newCells,
    })
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

    // 로컬 스토리지에 저장
    setLocalStorage('hostsPageCellsLayout', {
      cellsLayout: updatedCellsLayout,
    })

    // Infrastructure에서 상태 초기화를 위해 부모에게 알림
    if (this.props.onCellsAdded) {
      this.props.onCellsAdded()
    }
  }

  private getAllCells = (): Cell[] => {
    const {filteredLayouts, cellsLayout} = this.state
    const {source} = this.props

    const graphCells = getCells(filteredLayouts, source)

    const hostTableCell: Cell = {
      ...NEW_DEFAULT_DASHBOARD_CELL,
      i: 'host-table-cell',
      x: 0,
      y: 0,
      w: 96,
      h: 25,
      minW: 30,
      minH: 15,
      name: 'Host List',
      queries: [],
      type: CellType.Note,
      axes: {
        x: DEFAULT_AXIS,
        y: DEFAULT_AXIS,
      },
      colors: DEFAULT_LINE_COLORS,
      tableOptions: {
        verticalTimeAxis: false,
        sortBy: {
          internalName: '',
          displayName: '',
          visible: true,
          direction: 'asc',
        },
        wrapping: '',
        fixFirstColumn: false,
      },
      fieldOptions: [],
      timeFormat: '',
      decimalPlaces: {isEnforced: false, digits: 2},
      legend: {},
      inView: true,
      note: '',
      noteVisibility: NoteVisibility.Default,
      links: {self: ''},
    }

    const savedHostTableCell = cellsLayout.find(c => c.i === 'host-table-cell')
    const finalHostTableCell = savedHostTableCell
      ? {...hostTableCell, ...savedHostTableCell}
      : hostTableCell

    // 1. System Graph Cells (Layouts)
    const cellWidth = 24
    const colsPerRow = 4
    const adjustedGraphCells = graphCells.map((cell, index) => {
      const savedCell = cellsLayout.find(c => c.i === cell.i)
      if (savedCell) {
        return {
          ...cell,
          x: savedCell.x,
          y: savedCell.y,
          w: savedCell.w || cellWidth, // 저장된 값이 없으면 24 사용
          h: savedCell.h || 20,
        }
      }
      // 저장된 레이아웃이 없으면 기본 위치 계산
      const row = Math.floor(index / colsPerRow)
      const col = index % colsPerRow
      return {
        ...cell,
        x: col * cellWidth,
        y: finalHostTableCell.h + row * 20,
        w: cellWidth, // 항상 24로 고정
        h: cell.h || 20,
      }
    })

    // 2. Custom Cells (Imported from Library)
    // Filter cells from cellsLayout that are NOT in graphCells AND NOT host-table-cell
    const systemCellIds = new Set(graphCells.map(c => c.i))
    systemCellIds.add('host-table-cell')

    const customCells = cellsLayout.filter(cell => !systemCellIds.has(cell.i))

    return [finalHostTableCell, ...adjustedGraphCells, ...customCells]
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
    // HostTable 셀인 경우
    if (cell.i === 'host-table-cell') {
      return (
        <div className="dash-graph" style={{height: '100%'}}>
          <div
            className="dash-graph--draggable"
            style={{cursor: 'move', height: '100%'}}
          >
            <div
              className="dash-graph--container"
              style={{height: '100%', overflow: 'hidden'}}
            >
              <HostTable
                source={props.source}
                hosts={_.values(props.hostsObject)}
                hostPageStatus={props.hostPageStatus}
                focusedHost={props.focusedHost}
                onClickTableRow={this.handleClickTableRow}
                tableTitle={this.props.tableTitle}
              />
            </div>
          </div>
        </div>
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
        onSummonOverlayTechnologies={() => this.handleShowCellEditorOverlay(cell)}
      />
    )
  }

  private handleDeleteCell = (cell: Cell) => {
    const {cellsLayout} = this.state
    const newCellsLayout = cellsLayout.filter(c => c.i !== cell.i)

    this.setState({cellsLayout: newCellsLayout})
    setLocalStorage('hostsPageCellsLayout', {
      cellsLayout: newCellsLayout,
    })
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

  private handleSaveEditedCell = (newCell: Cell | NewDefaultCell): void => {
    const {cellsLayout} = this.state

    // 셀 업데이트
    const cellId = (newCell as Cell).i
    if (cellId) {
      const updatedCellsLayout = cellsLayout.map(cell =>
        cell.i === cellId ? (newCell as Cell) : cell
      )

      this.setState({cellsLayout: updatedCellsLayout})
      setLocalStorage('hostsPageCellsLayout', {
        cellsLayout: updatedCellsLayout,
      })
    } else {
      // 새 셀인 경우 (일반적으로는 발생하지 않지만 안전을 위해)
      const updatedCellsLayout = [...cellsLayout, newCell as Cell]
      this.setState({cellsLayout: updatedCellsLayout})
      setLocalStorage('hostsPageCellsLayout', {
        cellsLayout: updatedCellsLayout,
      })
    }

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
    const hostsTableState = getLocalStorage('hostsTableState')
    hostsTableState.focusedHost = hostName
    setLocalStorage('hostsTableState', hostsTableState)
    this.setState({focusedHost: hostName})
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
