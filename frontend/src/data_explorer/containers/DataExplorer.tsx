// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {withRouter, InjectedRouter, WithRouterProps} from 'react-router'
import {Location} from 'history'
import qs from 'qs'
import uuid from 'uuid'
import _ from 'lodash'

// Utils
import {stripPrefix} from 'src/utils/basepath'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {getConfig, getNewDashboardCell} from 'src/dashboards/utils/cellGetters'
import {defaultQueryDraft, initialStateFromCell} from 'src/shared/utils/timeMachine'
import {
  TimeMachineContainer,
  TimeMachineContextConsumer,
} from 'src/shared/utils/TimeMachineContext'

// Components
import WriteDataForm from 'src/data_explorer/components/WriteDataForm'
import OverlayTechnology from 'src/reusable_ui/components/overlays/OverlayTechnology'
import SendToDashboardOverlay from 'src/data_explorer/components/SendToDashboardOverlay'
import SaveCellOverlay from 'src/data_explorer/components/SaveCellOverlay'
import CellListOverlay from 'src/data_explorer/components/CellListOverlay'
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import TimeMachine from 'src/shared/components/TimeMachine/TimeMachine'
import DEHeader from 'src/data_explorer/components/DEHeader'
import PageSpinner from 'src/shared/components/PageSpinner'

// Actions
import {errorThrown} from 'src/shared/actions/errors'
import {setAutoRefresh} from 'src/shared/actions/app'
import {
  getDashboardsAsync,
  sendDashboardCellAsync,
} from 'src/dashboards/actions'
import {writeLineProtocolAsync} from 'src/data_explorer/actions/view/write'
import {updateSourceLink as updateSourceLinkAction} from 'src/data_explorer/actions/queries'
import {editQueryStatus as editQueryStatusAction} from 'src/data_explorer/actions/queries'
import {setTimeZone as setTimeZoneAction} from 'src/shared/actions/app'

import {notify as notifyAction} from 'src/shared/actions/notifications'

// Constants
import {
  TEMPLATES,
  TEMP_VAR_DASHBOARD_TIME,
  TEMP_VAR_UPPER_DASHBOARD_TIME,
} from 'src/shared/constants'
import {NEW_EMPTY_DASHBOARD} from 'src/dashboards/constants'

// Types
import {
  Source,
  Dashboard,
  QueryConfig,
  QueryStatus,
  Template,
  TemplateType,
  TemplateValueType,
  Notification,
  Cell,
  QueryType,
  CellQuery,
  TimeRange,
  TimeZones,
  Me,
} from 'src/types'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {Links} from 'src/types/flux'
import {LibraryCell} from 'src/types/dashboards'

interface PassedProps {
  source: Source
  sources: Source[]
  queryConfigs: QueryConfig[]
  updateSourceLink: typeof updateSourceLinkAction
  autoRefresh: number
  handleChooseAutoRefresh: typeof setAutoRefresh
  router?: InjectedRouter
  location?: Location
  manualRefresh: number
  dashboards: Dashboard[]
  onManualRefresh: () => void
  errorThrownAction: () => void
  writeLineProtocol: (
    source: Source,
    database: string,
    content: string,
    precision?: string
  ) => void
  handleGetDashboards: () => Dashboard[]
  sendDashboardCell: (
    dashboard: Dashboard,
    newCell: Partial<Cell>
  ) => Promise<{success: boolean; dashboard: Dashboard}>
  editQueryStatus: typeof editQueryStatusAction
  queryStatus: QueryStatus
  fluxLinks: Links
  notify: (message: Notification) => void
  sourceLink: string
  onSetTimeZone: typeof setTimeZoneAction
  timeZone: TimeZones
}

interface ConnectedProps {
  queryType: QueryType
  queryDrafts: CellQuery[]
  timeRange: TimeRange
  timeZone: TimeZones
  draftScript: string
  script: string
  onUpdateQueryDrafts: (queryDrafts: CellQuery[]) => void
  onResetTimeMachine: TimeMachineContainer['reset']
  onInitFluxScript: TimeMachineContainer['handleInitFluxScript']
}

interface Auth {
  me: Me
  isUsingAuth: boolean
}

type Props = PassedProps & ConnectedProps & Auth

interface State {
  isWriteFormVisible: boolean
  isCellListVisible: boolean
  isSaveCellVisible: boolean
  isSendToDashboardVisible: boolean
  isComponentMounted: boolean
  activeQueryIndex: number
  editingLibraryCell?: LibraryCell
  lastSelectedLibraryCellID?: string
}

@ErrorHandling
export class DataExplorer extends PureComponent<Props, State> {
  constructor(props) {
    super(props)

    this.state = {
      isWriteFormVisible: false,
      isCellListVisible: false,
      isSaveCellVisible: false,
      isSendToDashboardVisible: false,
      isComponentMounted: false,
      activeQueryIndex: 0,
      editingLibraryCell: null,
      lastSelectedLibraryCellID: '',
    }

    props.onResetTimeMachine()
  }

  public async componentDidMount() {
    const {autoRefresh} = this.props

    await this.resolveQueryParams()

    GlobalAutoRefresher.poll(autoRefresh)

    this.setState({isComponentMounted: true})
  }

  public componentDidUpdate(prevProps: Props) {
    const {autoRefresh} = this.props

    if (autoRefresh !== prevProps.autoRefresh) {
      GlobalAutoRefresher.poll(autoRefresh)
    }

    if (
      prevProps.location === this.props.location &&
      this.state.isComponentMounted
    ) {
      this.writeQueryParams()
    }
  }

  public componentWillUnmount() {
    GlobalAutoRefresher.stopPolling()
  }

  public render() {
    const {
      source,
      notify,
      sources,
      timeZone,
      timeRange,
      fluxLinks,
      queryStatus,
      editQueryStatus,
      updateSourceLink,
      onSetTimeZone,
      me,
      isUsingAuth,
      autoRefresh,
    } = this.props

    const {isComponentMounted} = this.state

    if (!isComponentMounted) {
      return <PageSpinner />
    }

    return (
      <>
        {this.writeDataForm}
        {this.cellListOverlay}
        {this.saveCellOverlay}
        {this.sendToDashboardOverlay}
        <div className="deceo--page">
          <TimeMachine
            notify={notify}
            source={source}
            isInCEO={false}
            sources={sources}
            fluxLinks={fluxLinks}
            templates={this.templates}
            queryStatus={queryStatus}
            editQueryStatus={editQueryStatus}
            updateSourceLink={updateSourceLink}
            onResetFocus={this.handleResetFocus}
            onActiveQueryIndexChange={this.onActiveQueryIndexChange}
            me={me}
            isUsingAuth={isUsingAuth}
            refresh={autoRefresh}
            timeZone={timeZone}
            selectedCellName={this.state.editingLibraryCell?.name}
            onClearSelectedCell={this.handleClearSelectedCell}
          >
            {(activeEditorTab, onSetActiveEditorTab) => (
              <DEHeader
                timeZone={timeZone}
                timeRange={timeRange}
                onSetTimeZone={onSetTimeZone}
                activeEditorTab={activeEditorTab}
                onOpenWriteData={this.handleOpenWriteData}
                onSetActiveEditorTab={onSetActiveEditorTab}
                onOpenCellList={this.handleOpenCellList}
                onOpenSaveCell={this.handleOpenSaveCell}
                onOpenSendToDashboard={this.handleOpenSendToDashboard}
              />
            )}
          </TimeMachine>
        </div>
      </>
    )
  }

  private async resolveQueryParams() {
    const {
      source,
      sourceLink,
      queryDrafts,
      onUpdateQueryDrafts,
      onInitFluxScript,
    } = this.props
    const {query, script} = this.readQueryParams()

    if (script) {
      onInitFluxScript(script)
      return
    }

    if (query) {
      if (queryDrafts.find(q => q.query === query)) {
        // Has matching query draft already loaded
        return
      }

      const id = uuid.v4()
      const queryConfig = await getConfig(
        source.links.queries,
        id,
        query,
        this.templates
      )

      const queryDraft = {
        id,
        query,
        queryConfig,
        source: sourceLink,
        type: QueryType.InfluxQL,
      }

      onUpdateQueryDrafts([queryDraft])
      return
    }

    if (!queryDrafts.length) {
      const queryDraft = defaultQueryDraft(QueryType.InfluxQL)

      onUpdateQueryDrafts([queryDraft])
      return
    }
  }

  private readQueryParams(): {query?: string; script?: string} {
    const {query, script} = qs.parse(location.search, {
      ignoreQueryPrefix: true,
    })

    return {query: query as string, script: script as string}
  }

  private writeQueryParams() {
    const {router, queryDrafts, script, queryType} = this.props
    const query = _.get(queryDrafts, '0.query')
    const isFlux = queryType === QueryType.Flux

    let queryParams

    if (isFlux && script) {
      queryParams = {script}
    } else if (!isFlux && query) {
      queryParams = {query}
    }

    const pathname = stripPrefix(location.pathname)
    const search = queryParams ? `?${qs.stringify(queryParams)}` : ''

    router.push(pathname + search)
  }

  private get writeDataForm(): JSX.Element {
    const {
      source,
      errorThrownAction,
      writeLineProtocol,
      me,
      isUsingAuth,
    } = this.props

    const {isWriteFormVisible} = this.state
    return (
      <OverlayTechnology visible={isWriteFormVisible}>
        <WriteDataForm
          source={source}
          errorThrown={errorThrownAction}
          selectedDatabase={this.selectedDatabase}
          onClose={this.handleCloseWriteData}
          writeLineProtocol={writeLineProtocol}
          me={me}
          isUsingAuth={isUsingAuth}
        />
      </OverlayTechnology>
    )
  }

  private get sendToDashboardOverlay(): JSX.Element {
    const {
      source,
      dashboards,
      sendDashboardCell,
      handleGetDashboards,
      notify,
    } = this.props

    const {isSendToDashboardVisible, activeQueryIndex} = this.state
    return (
      <Authorized requiredRole={EDITOR_ROLE}>
        <OverlayTechnology visible={isSendToDashboardVisible}>
          <SendToDashboardOverlay
            notify={notify}
            onCancel={this.handleCloseSendToDashboard}
            source={source}
            dashboards={dashboards}
            activeQueryIndex={activeQueryIndex}
            handleGetDashboards={handleGetDashboards}
            sendDashboardCell={sendDashboardCell}
          />
        </OverlayTechnology>
      </Authorized>
    )
  }

  private get saveCellOverlay(): JSX.Element {
    const {source, notify} = this.props
    const {isSaveCellVisible, activeQueryIndex, editingLibraryCell} = this.state
    return (
      <Authorized requiredRole={EDITOR_ROLE}>
        <OverlayTechnology visible={isSaveCellVisible}>
          <SaveCellOverlay
            notify={notify}
            onCancel={this.handleCloseSaveCell}
            source={source}
            activeQueryIndex={activeQueryIndex}
            editingLibraryCell={editingLibraryCell}
            initialSelectedItemId={this.state.lastSelectedLibraryCellID}
            onSavedLibraryCell={this.handleSavedLibraryCell}
          />
        </OverlayTechnology>
      </Authorized>
    )
  }

  private get cellListOverlay(): JSX.Element {
    const {notify} = this.props
    const {isCellListVisible, lastSelectedLibraryCellID} = this.state
    return (
      <Authorized requiredRole={EDITOR_ROLE}>
        <OverlayTechnology visible={isCellListVisible}>
          <CellListOverlay
            notify={notify}
            onCancel={this.handleCloseCellList}
            onEditItem={this.handleEditLibraryCell}
            selectedItemId={lastSelectedLibraryCellID}
          />
        </OverlayTechnology>
      </Authorized>
    )
  }

  private get templates(): Template[] {
    const {timeRange} = this.props

    const low = timeRange.lower
    const up = timeRange.upper
    const lowerTemplateType =
      low && low.includes(':') ? TemplateType.TimeStamp : TemplateType.Constant
    const upperTemplateType =
      up && up.includes(':') ? TemplateType.TimeStamp : TemplateType.Constant
    const lowerTemplateValueType =
      low && low.includes(':')
        ? TemplateValueType.TimeStamp
        : TemplateValueType.Constant
    const upperTemplateValueType =
      up && up.includes(':')
        ? TemplateValueType.TimeStamp
        : TemplateValueType.Constant

    const dashboardTime: Template = {
      id: 'dashtime',
      tempVar: TEMP_VAR_DASHBOARD_TIME,
      type: lowerTemplateType,
      label: 'minimum bound on dashboard time',
      values: [
        {
          value: low,
          type: lowerTemplateValueType,
          selected: true,
          localSelected: true,
        },
      ],
    }

    const upperDashboardTime: Template = {
      id: 'upperdashtime',
      tempVar: TEMP_VAR_UPPER_DASHBOARD_TIME,
      type: upperTemplateType,
      label: 'upper bound on dashboard time',
      values: [
        {
          value: up || 'now()',
          type: upperTemplateValueType,
          selected: true,
          localSelected: true,
        },
      ],
    }

    return [...TEMPLATES, dashboardTime, upperDashboardTime]
  }

  private handleCloseWriteData = (): void => {
    this.setState({isWriteFormVisible: false})
  }

  private handleOpenWriteData = (): void => {
    this.setState({isWriteFormVisible: true})
  }

  private get selectedDatabase(): string {
    return _.get(this.props.queryConfigs, ['0', 'database'], null)
  }

  private handleOpenSendToDashboard = () => {
    this.setState({isSendToDashboardVisible: true})
  }

  private handleCloseSendToDashboard = () => {
    this.setState({isSendToDashboardVisible: false})
  }

  private handleOpenSaveCell = () => {
    this.setState({isSaveCellVisible: true})
  }

  private handleCloseSaveCell = () => {
    this.setState({isSaveCellVisible: false})
  }

  private handleOpenCellList = () => {
    this.setState({isCellListVisible: true})
  }

  private handleCloseCellList = () => {
    this.setState({isCellListVisible: false})
  }

  private handleEditLibraryCell = (item: LibraryCell) => {
    this.props.onResetTimeMachine(initialStateFromCell(item.content))
    this.setState({
      editingLibraryCell: item,
      lastSelectedLibraryCellID: item.id,
      isCellListVisible: false,
    })
  }

  private handleSavedLibraryCell = (item: LibraryCell) => {
    if (!item) {
      return
    }
    this.setState({
      editingLibraryCell: item,
      lastSelectedLibraryCellID: item.id,
    })
  }

  private handleClearSelectedCell = () => {
    const emptyCell = getNewDashboardCell(NEW_EMPTY_DASHBOARD as Dashboard)
    this.props.onResetTimeMachine(initialStateFromCell(emptyCell))
    this.setState({
      editingLibraryCell: null,
      lastSelectedLibraryCellID: '',
    })
  }

  private onActiveQueryIndexChange = (activeQueryIndex: number): void => {
    this.setState({activeQueryIndex})
  }

  private handleResetFocus = () => {
    return
  }
}

const ConnectedDataExplorer = (props: PassedProps & WithRouterProps & Auth) => {
  return (
    <TimeMachineContextConsumer>
      {(container: TimeMachineContainer) => {
        const {state} = container
        return (
          <DataExplorer
            {...props}
            queryDrafts={state.queryDrafts}
            queryType={state.queryType}
            draftScript={state.draftScript}
            timeRange={state.timeRange}
            script={state.script}
            onInitFluxScript={container.handleInitFluxScript}
            onUpdateQueryDrafts={container.handleUpdateQueryDrafts}
            onResetTimeMachine={container.reset}
          />
        )
      }}
    </TimeMachineContextConsumer>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {autoRefresh, timeZone},
    },
    timeRange,
    dataExplorer: {queryStatus, sourceLink},
    dashboardUI: {dashboards},
    sources,
    links,
  } = state

  return {
    timeZone,
    fluxLinks: links.flux,
    autoRefresh,
    timeRange,
    dashboards,
    sources,
    queryStatus,
    sourceLink,
  }
}

const mdtp: any = {
  handleChooseAutoRefresh: setAutoRefresh,
  errorThrownAction: errorThrown,
  writeLineProtocol: writeLineProtocolAsync,
  handleGetDashboards: getDashboardsAsync,
  sendDashboardCell: sendDashboardCellAsync,
  editQueryStatus: editQueryStatusAction,
  notify: notifyAction,
  updateSourceLink: updateSourceLinkAction,
  onSetTimeZone: setTimeZoneAction,
}

export default connect(mstp, mdtp)(withRouter(ConnectedDataExplorer))
