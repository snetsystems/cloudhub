import React, {useState, useMemo} from 'react'
import {Cell, Source, Me, Template, TimeZones} from 'src/types'
import {Button, ComponentColor, Page, OverlayTechnology} from 'src/reusable_ui'
import FixedModal from 'src/reusable_ui/components/FixedModal/FixedModal'
import {bindActionCreators} from 'redux'

import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'
import LayoutRenderer, {
  RenderCellContext,
} from 'src/shared/components/LayoutRenderer'
import PageSpinner from 'src/shared/components/PageSpinner'
import DashboardEmpty from 'src/dashboards/components/DashboardEmpty'
import CellEditorOverlay from 'src/dashboards/components/CellEditorOverlay'
import {createTimeRangeTemplates} from 'src/shared/utils/templates'
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
  editCellQueryStatus,
} from 'src/dashboards/actions'
import * as notifyActions from 'src/shared/actions/notifications'
import {setTimeZone} from 'src/shared/actions/app'
import {setCloudTimeRange, setCloudAutoRefresh} from 'src/clouds/actions/clouds'
import {setAutoRefresh} from 'src/shared/actions/app'
import {CLOUD_TIME_RANGE} from 'src/shared/data/timeRanges'
import {timeRanges} from 'src/shared/data/timeRanges'

import {useDashboardPageWithImport} from 'src/server_details/hooks/useDashboardPageWithImport'
import {getDashboardByTemplateName} from 'src/dashboards/apis'
import * as QueriesModels from 'src/types/queries'
import {mergeBuiltinWithGetTempVars} from 'src/utils/tempVars'
import {hydrateTemplates} from 'src/tempVars/utils/graph'

/** Optional context for template overrides (e.g. :host: selection). Consumer provides a React Context; common component only reads templateOverrides. */
export interface TemplateSelectionContextValue {
  templateOverrides?: Record<string, string>
}

/** Context passed to renderHeaderLeft when provided; use to render e.g. host list next to the title. */
export interface HeaderLeftContext {
  pageTitle: string
  templates: Template[]
  source: Source
}

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
  /** When provided, renders next to the page title in the left header (e.g. host list). */
  renderHeaderLeft?: (context: HeaderLeftContext) => React.ReactNode
  /** When provided, replaces the default right header (SourceIndicator, AutoRefresh, TimeRange, TimeZone, Import). */
  renderHeaderRight?: (context: HeaderRightContext) => React.ReactNode
  /** Key in cloudTimeRange for this page (e.g. 'hostDetails', 'prediction'). Default 'hostDetails'. */
  timeRangeKey?: string
  pageClassName?: string
  importButtonText?: string
  draggableCancel?: string
  /** When false, do not show "no cells" empty state (DashboardEmpty). Default true. */
  showEmptyState?: boolean
  /**
   * Optional React Context for template overrides. When provided, common component reads
   * templateOverrides (tempVar -> selected value) and applies to templates passed to cells.
   * Consumer owns state and provides via Provider; no page-specific state in common component.
   */
  templateSelectionContext?: React.Context<TemplateSelectionContextValue | null>
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
  fluxLinks?: {self: string; suggestions: string; ast: string}
  notify?: (message: {type: string; icon: string; duration: number; message: string}) => void
  cellQueryStatus?: QueriesModels.QueryStatus
  editCellQueryStatus?: (queryID: string, status: QueriesModels.Status) => unknown
}

function DashboardPageWithImport({
  pageTitle,
  pageName,
  getTempVars,
  renderCell,
  renderHeaderLeft,
  renderHeaderRight,
  draggableCancel,
  timeRangeKey = 'hostDetails',
  pageClassName = 'dashboard-page-with-import',
  importButtonText = 'Import Modal',
  showEmptyState = true,
  templateSelectionContext,
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
  fluxLinks,
  notify,
  cellQueryStatus,
  editCellQueryStatus,
}: DashboardPageWithImportProps) {
  const safeFluxLinks = fluxLinks ?? {self: '', suggestions: '', ast: ''}
  const safeNotify = notify ?? (() => {})
  const safeCellQueryStatus = cellQueryStatus ?? {queryID: '', status: {}}
  const safeEditCellQueryStatus =
    editCellQueryStatus ?? ((_queryID: string, _status: QueriesModels.Status) => undefined)
  const tempVars = getTempVars(source)
  const [manualRefreshStamp, setManualRefreshStamp] = React.useState(Date.now())
  const [hydratedTemplates, setHydratedTemplates] = React.useState<
    Template[] | null
  >(null)
  const effectiveManualRefresh = manualRefreshStamp || manualRefresh
  const [selectedCell, setSelectedCell] = useState<
    DashboardsModels.Cell | DashboardsModels.NewDefaultCell | null
  >(null)
  const [isCellEditorOpen, setIsCellEditorOpen] = useState(false)

  const {
    dashboard,
    cells,
    loadSettled,
    onPositionChange,
    onDeleteCell,
    onCloneCell,
    importModal,
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

  const mergedTemplates = React.useMemo(
    () =>
      mergeBuiltinWithGetTempVars(
        dashboard?.templates ?? [],
        getTempVars(source),
        source
      ),
    [dashboard?.templates, source]
  )

  React.useEffect(() => {
    let cancelled = false
    hydrateTemplates(mergedTemplates, sources, {source}).then(result => {
      if (!cancelled) setHydratedTemplates(result)
    })
    return () => {
      cancelled = true
    }
  }, [mergedTemplates, sources, source])

  const tempVars = hydratedTemplates ?? mergedTemplates

  const templatesWithSelection = React.useMemo(() => {
    if (!templateOverrides || Object.keys(templateOverrides).length === 0)
      return tempVars
    return tempVars.map(t => {
      const override = templateOverrides[t.tempVar]
      if (override === undefined) return t
      return {
        ...t,
        values: (t.values || []).map(v => ({
          ...v,
          localSelected: v.value === override,
        })),
      }
    })
  }, [tempVars, templateOverrides])

  const onSummonOverlayTechnologies = (_cell: Cell) => {}

  const selectedTimeRange: QueriesModels.TimeRange =
    cloudTimeRange?.[timeRangeKey] ?? CLOUD_TIME_RANGE.default ?? timeRanges[0]
  const dashboardRefresh = cloudAutoRefresh?.[timeRangeKey] ?? 0

  const mergedTemplates = useMemo(() => {
    const templateMap = new Map<string, Template>()
    tempVars.forEach(t => {
      const key = t.tempVar || t.id
      if (key) templateMap.set(key, t)
    })
    ;(dashboard?.templates ?? []).forEach(t => {
      const key = t.tempVar || t.id
      if (key) templateMap.set(key, t)
    })
    localTemplates.forEach(t => {
      const key = t.tempVar || t.id
      if (key) templateMap.set(key, t)
    })
    const {dashboardTime, upperDashboardTime} =
      createTimeRangeTemplates(selectedTimeRange)
    templateMap.set(dashboardTime.tempVar || dashboardTime.id, dashboardTime)
    templateMap.set(
      upperDashboardTime.tempVar || upperDashboardTime.id,
      upperDashboardTime
    )
    return Array.from(templateMap.values())
  }, [tempVars, dashboard?.templates, localTemplates, selectedTimeRange])

  const dashboardTemplatesForEditor = useMemo(
    () => [...mergedTemplates, ...(dashboard?.templates || [])],
    [mergedTemplates, dashboard?.templates]
  )

  const onSummonOverlayTechnologies = (cell: Cell) => {
    setSelectedCell(cell)
    setIsCellEditorOpen(true)
  }

  const handleSaveEditedCell = async (
    newCell: DashboardsModels.Cell | DashboardsModels.NewDefaultCell
  ) => {
    if (!dashboard) {
      setIsCellEditorOpen(false)
      return
    }
    if ((newCell as DashboardsModels.Cell).i !== undefined) {
      const updatedCells = dashboard.cells.map(cell =>
        cell.i === (newCell as DashboardsModels.Cell).i
          ? {...cell, ...newCell}
          : cell
      )
      const newDashboard = {...dashboard, cells: updatedCells}
      updateDashboard(newDashboard)
      await putDashboard(newDashboard)
    } else {
      addDashboardCellAsync(dashboard, newCell as DashboardsModels.NewDefaultCell)
    }
    setIsCellEditorOpen(false)
  }

  const handleCloseCellEditor = () => setIsCellEditorOpen(false)

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
      {dashboard && selectedCell && (
        <OverlayTechnology visible={isCellEditorOpen}>
          <CellEditorOverlay
            source={source}
            sources={sources}
            me={me}
            isUsingAuth={!!isUsingAuth}
            notify={safeNotify}
            fluxLinks={safeFluxLinks}
            cell={selectedCell}
            dashboardID={dashboard.id}
            queryStatus={safeCellQueryStatus}
            onSave={handleSaveEditedCell}
            onCancel={handleCloseCellEditor}
            dashboardTemplates={dashboardTemplatesForEditor}
            editQueryStatus={safeEditCellQueryStatus}
            dashboardTimeRange={selectedTimeRange}
            dashboardRefresh={dashboardRefresh}
          />
        </OverlayTechnology>
      )}
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <>
            <Page.Title title={pageTitle} />
            {renderHeaderLeft?.({
              pageTitle,
              templates: tempVars,
              source,
            })}
          </>
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true}>
          <>
            {renderHeaderRight
              ? renderHeaderRight(headerRightContext)
              : defaultHeaderRight}
          </>
        </Page.Header.Right>
      </Page.Header>
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
              templates={templatesWithSelection}
              onSummonOverlayTechnologies={onSummonOverlayTechnologies}
              host={source.name}
              renderCell={renderCell}
              draggableCancel={draggableCancel}
            />
          ) : dashboard ? (
            showEmptyState ? (
              <DashboardEmpty dashboard={dashboard} />
            ) : null
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
    dashboardUI: {dashboards, cellQueryStatus},
    links,
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
    cellQueryStatus,
    fluxLinks: links?.flux ?? {self: '', suggestions: '', ast: ''},
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
  editCellQueryStatus: bindActionCreators(editCellQueryStatus, dispatch),
  notify: bindActionCreators(notifyActions.notify, dispatch),
  setTimeZone: bindActionCreators(setTimeZone, dispatch),
  setAutoRefresh: bindActionCreators(setAutoRefresh, dispatch),
  onChooseCloudTimeRange: bindActionCreators(setCloudTimeRange, dispatch),
  onChooseCloudAutoRefresh: bindActionCreators(setCloudAutoRefresh, dispatch),
  dispatch,
})

export default DashboardPageWithImport
