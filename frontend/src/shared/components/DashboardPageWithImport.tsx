import React from 'react'
import {Cell, Source, Me, Template, TimeZones} from 'src/types'
import {Button, ComponentColor, Page} from 'src/reusable_ui'
import FixedModal from 'src/reusable_ui/components/FixedModal/FixedModal'
import {bindActionCreators} from 'redux'

import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'
import LayoutRenderer, {
  RenderCellContext,
} from 'src/shared/components/LayoutRenderer'
import PageSpinner from 'src/shared/components/PageSpinner'
import DashboardEmpty from 'src/dashboards/components/DashboardEmpty'
import SourceIndicator from 'src/shared/components/SourceIndicator'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import TimeZoneToggle from 'src/shared/components/time_zones/TimeZoneToggle'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import {AutoRefreshOption} from 'src/shared/components/dropdown_auto_refresh/autoRefreshOptions'
import * as DashboardsModels from 'src/types/dashboards'
import {
  addDashboardCellAsync,
  cloneDashboardCellAsync,
  deleteDashboardCellAsync,
  updateDashboard,
  putDashboard,
  getDashboardsAsync,
  patchDashboardByIDAsync,
} from 'src/dashboards/actions'
import {setTimeZone} from 'src/shared/actions/app'
import {setCloudTimeRange, setCloudAutoRefresh} from 'src/clouds/actions/clouds'
import {setAutoRefresh} from 'src/shared/actions/app'
import {CLOUD_TIME_RANGE} from 'src/shared/data/timeRanges'
import {timeRanges} from 'src/shared/data/timeRanges'

import TemplateControlBar from 'src/tempVars/components/TemplateControlBar'
import {useDashboardPageWithImport} from 'src/server_details/hooks/useDashboardPageWithImport'
import {getDashboardByTemplateName} from 'src/dashboards/apis'
import * as QueriesModels from 'src/types/queries'

/** Context passed to renderHeaderRight when provided; use default header data or compose your own. */
export interface HeaderRightContext {
  importButton: React.ReactNode
  timeZone: TimeZones
  setTimeZone: typeof setTimeZone
  autoRefresh: number
  cloudAutoRefresh: CloudAutoRefresh
  cloudTimeRange: CloudTimeRange
  timeRangeKey: string
  selectedTimeRange: QueriesModels.TimeRange
  onChooseTimeRange: (tr: QueriesModels.TimeRange) => void
  onChooseAutoRefresh: (option: AutoRefreshOption) => void
  onChooseCloudAutoRefresh: (v: CloudAutoRefresh) => void
  onManualRefresh: () => void
}

/** Page-specific config: only these vary per page; the rest is common. */
export interface DashboardPageWithImportConfig {
  pageTitle: string
  pageName: string
  /** e.g. generateForHosts(source) for server details */
  getTempVars: (source: Source) => Template[]
  /** Fixed/custom cells: return a node for custom render, or null to use server/default Layout. */
  renderCell?: (
    cell: Cell,
    context: RenderCellContext
  ) => React.ReactNode | null
  /** When provided, replaces the default right header (SourceIndicator, AutoRefresh, TimeRange, TimeZone, Import). */
  renderHeaderRight?: (context: HeaderRightContext) => React.ReactNode
  /** Key in cloudTimeRange for this page (e.g. 'hostDetails', 'prediction'). Default 'hostDetails'. */
  timeRangeKey?: string
  pageClassName?: string
  importButtonText?: string
}

export interface DashboardPageWithImportProps
  extends DashboardPageWithImportConfig {
  source: Source
  sources: Source[]
  inPresentationMode: boolean
  cloudAutoRefresh: CloudAutoRefresh
  cloudTimeRange: CloudTimeRange
  manualRefresh: number
  timeZone: TimeZones
  autoRefresh: number
  setTimeZone: typeof setTimeZone
  setAutoRefresh: typeof setAutoRefresh
  onChooseCloudTimeRange: (cloudTimeRange: CloudTimeRange) => void
  onChooseCloudAutoRefresh: (cloudAutoRefresh: CloudAutoRefresh) => void
  updateDashboard: typeof updateDashboard
  putDashboard: (dashboard: DashboardsModels.Dashboard) => void | Promise<void>
  addDashboardCellAsync: typeof addDashboardCellAsync
  cloneDashboardCellAsync: typeof cloneDashboardCellAsync
  deleteDashboardCellAsync: typeof deleteDashboardCellAsync
  getDashboardsAsync: typeof getDashboardsAsync
  patchDashboardByIDAsync: typeof patchDashboardByIDAsync
  dispatch: (action: unknown) => Promise<unknown>
  dashboards?: DashboardsModels.Dashboard[]
  me?: Me
  isUsingAuth?: boolean
}

function DashboardPageWithImport({
  pageTitle,
  pageName,
  getTempVars,
  renderCell,
  renderHeaderRight,
  timeRangeKey = 'hostDetails',
  pageClassName = 'dashboard-page-with-import',
  importButtonText = 'Import Modal',
  source,
  sources,
  inPresentationMode,
  cloudTimeRange,
  cloudAutoRefresh,
  manualRefresh,
  timeZone,
  autoRefresh,
  setTimeZone,
  setAutoRefresh,
  onChooseCloudTimeRange,
  onChooseCloudAutoRefresh,
  updateDashboard,
  putDashboard,
  addDashboardCellAsync,
  cloneDashboardCellAsync,
  deleteDashboardCellAsync,
  getDashboardsAsync,
  patchDashboardByIDAsync,
  dispatch,
  dashboards,
  me,
  isUsingAuth,
}: DashboardPageWithImportProps) {
  const tempVars = getTempVars(source)
  const [manualRefreshStamp, setManualRefreshStamp] = React.useState(Date.now())
  const effectiveManualRefresh = manualRefreshStamp || manualRefresh

  const {
    dashboard,
    cells,
    loadSettled,
    onPositionChange,
    onDeleteCell,
    onCloneCell,
    importModal,
    localTemplates,
    handlePickTemplate,
    handleSaveTemplates,
  } = useDashboardPageWithImport({
    pageName,
    fetchDashboardByName: getDashboardByTemplateName,
    dashboards,
    getDashboardsAsync,
    updateDashboard,
    putDashboard,
    patchDashboardByIDAsync,
    addDashboardCellAsync,
    cloneDashboardCellAsync,
    deleteDashboardCellAsync,
    dispatch,
  })

  const onSummonOverlayTechnologies = (_cell: Cell) => {}

  const selectedTimeRange: QueriesModels.TimeRange =
    cloudTimeRange?.[timeRangeKey] ?? CLOUD_TIME_RANGE.default ?? timeRanges[0]
  const handleChooseTimeRange = (tr: QueriesModels.TimeRange) => {
    onChooseCloudTimeRange({...cloudTimeRange, [timeRangeKey]: tr})
  }
  const handleChooseAutoRefresh = (option: AutoRefreshOption) => {
    setAutoRefresh(option.milliseconds)
  }
  const handleManualRefresh = () => setManualRefreshStamp(Date.now())

  const importButton = (
    <Button
      text={importButtonText}
      color={ComponentColor.Primary}
      onClick={() => importModal.setIsOpen(prev => !prev)}
    />
  )

  const headerRightContext: HeaderRightContext = {
    importButton,
    timeZone,
    setTimeZone,
    autoRefresh,
    cloudAutoRefresh,
    cloudTimeRange,
    timeRangeKey,
    selectedTimeRange,
    onChooseTimeRange: handleChooseTimeRange,
    onChooseAutoRefresh: handleChooseAutoRefresh,
    onChooseCloudAutoRefresh: onChooseCloudAutoRefresh,
    onManualRefresh: handleManualRefresh,
  }

  const defaultHeaderRight = (
    <>
      <AutoRefreshDropdown
        onChoose={handleChooseAutoRefresh}
        selected={autoRefresh}
        onManualRefresh={handleManualRefresh}
      />
      <TimeRangeDropdown
        onChooseTimeRange={handleChooseTimeRange}
        selected={selectedTimeRange}
      />
      <TimeZoneToggle onSetTimeZone={setTimeZone} timeZone={timeZone} />
      {importButton}
    </>
  )

  return (
    <Page className={pageClassName}>
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title={pageTitle} />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true}>
          <>
            {renderHeaderRight
              ? renderHeaderRight(headerRightContext)
              : defaultHeaderRight}
          </>
        </Page.Header.Right>
      </Page.Header>
      {localTemplates.length > 0 && (
        <TemplateControlBar
          templates={localTemplates}
          me={me}
          isUsingAuth={isUsingAuth || false}
          onSaveTemplates={handleSaveTemplates}
          onPickTemplate={handlePickTemplate}
          source={source}
        />
      )}
      <Page.Contents fullWidth={true} inPresentationMode={inPresentationMode}>
        <div className="dashboard container-fluid full-width">
          {cells.length ? (
            <LayoutRenderer
              cells={cells}
              source={source}
              sources={sources}
              isEditable={true}
              isStatusPage={false}
              isStaticPage={false}
              timeRange={selectedTimeRange}
              manualRefresh={effectiveManualRefresh}
              onDeleteCell={onDeleteCell}
              onCloneCell={onCloneCell}
              onPositionChange={onPositionChange}
              templates={tempVars}
              onSummonOverlayTechnologies={onSummonOverlayTechnologies}
              host={source.name}
              renderCell={renderCell}
            />
          ) : dashboard ? (
            <DashboardEmpty dashboard={dashboard} />
          ) : loadSettled ? (
            <div className="dashboard-empty">
              <p>page not available.</p>
            </div>
          ) : (
            <PageSpinner customClass={`${pageClassName}-spinner`} />
          )}
        </div>
      </Page.Contents>
      <FixedModal
        isOpen={importModal.isOpen}
        setIsOpen={importModal.setIsOpen}
        onSelectionChange={importModal.onSelectionChange}
        builtinName={pageName}
      />
    </Page>
  )
}

/** Shared mapStateToProps for pages using DashboardPageWithImport. */
export const dashboardPageWithImportMstp = state => {
  const {
    app: {
      ephemeral: {inPresentationMode},
      persisted: {
        cloudAutoRefresh,
        cloudTimeRange,
        manualRefresh,
        timeZone,
        autoRefresh,
      },
    },
    auth: {isUsingAuth, me},
    dashboardUI: {dashboards},
  } = state

  return {
    me,
    isUsingAuth,
    cloudAutoRefresh,
    inPresentationMode,
    cloudTimeRange,
    manualRefresh,
    timeZone,
    autoRefresh,
    dashboards,
  }
}

/** Shared mapDispatchToProps for pages using DashboardPageWithImport. */
export const dashboardPageWithImportMdtp = dispatch => ({
  updateDashboard: bindActionCreators(updateDashboard, dispatch),
  putDashboard: (dashboard: DashboardsModels.Dashboard) =>
    dispatch(putDashboard(dashboard)),
  addDashboardCellAsync: bindActionCreators(addDashboardCellAsync, dispatch),
  cloneDashboardCellAsync: bindActionCreators(
    cloneDashboardCellAsync,
    dispatch
  ),
  deleteDashboardCellAsync: bindActionCreators(
    deleteDashboardCellAsync,
    dispatch
  ),
  getDashboardsAsync: bindActionCreators(getDashboardsAsync, dispatch),
  patchDashboardByIDAsync: bindActionCreators(
    patchDashboardByIDAsync,
    dispatch
  ),
  setTimeZone: bindActionCreators(setTimeZone, dispatch),
  setAutoRefresh: bindActionCreators(setAutoRefresh, dispatch),
  onChooseCloudTimeRange: bindActionCreators(setCloudTimeRange, dispatch),
  onChooseCloudAutoRefresh: bindActionCreators(setCloudAutoRefresh, dispatch),
  dispatch,
})

export default DashboardPageWithImport
