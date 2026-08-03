import React, {useState, useMemo, useEffect, useRef} from 'react'
import {Cell, Source, Me, Template, TimeZones, TemplateValue} from 'src/types'
import {
  Button,
  ComponentColor,
  Page,
  OverlayTechnology,
  PopoverModal,
  IconFont,
  ButtonShape,
} from 'src/reusable_ui'
import {PopoverModalSection} from 'src/reusable_ui/components/PopoverModal/PopoverModal'
import {CellOrigin} from 'src/types/dashboards'
import FixedModal from 'src/reusable_ui/components/FixedModal/FixedModal'
import {bindActionCreators} from 'redux'

import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'
import LayoutRenderer, {
  RenderCellContext,
} from 'src/shared/components/LayoutRenderer'
import PageSpinner from 'src/shared/components/PageSpinner'
import ServerDetailTips from 'src/shared/components/ServerDetailTips'
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
  templateVariableLocalSelected,
} from 'src/dashboards/actions'
import * as notifyActions from 'src/shared/actions/notifications'
import {setTimeZone} from 'src/shared/actions/app'
import {setCloudTimeRange, setCloudAutoRefresh} from 'src/clouds/actions/clouds'
import {setAutoRefresh} from 'src/shared/actions/app'
import {CLOUD_TIME_RANGE} from 'src/shared/data/timeRanges'
import {timeRanges} from 'src/shared/data/timeRanges'

import {getDashboardByTemplateName, applyFixedCell} from 'src/dashboards/apis'
import QuestionMarkTooltip from 'src/shared/components/QuestionMarkTooltip'
import * as QueriesModels from 'src/types/queries'
import {
  notifyTemplateUpdated,
  notifyTemplateUpdateFailed,
} from 'src/shared/copy/notifications'
import {mergeBuiltinWithGetTempVars} from 'src/utils/tempVars'
import {hydrateTemplates} from 'src/tempVars/utils/graph'
import {useDashboardPageWithImport} from 'src/server_details/hooks/useDashboardPageWithImport'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

const UPDATE_HELP_TEXT =
  'When you run this update: For each cell that already exists on your dashboard (matched by cell ID), query definitions (queries) are replaced from the latest fixed-cell template—for all cell types (component, line, line-plus-single-stat, etc.). Layout and names stay as-is. New cells from the template are added as hidden. Template variables and version are updated to the latest.'

/** Optional context for template overrides (e.g. :host: selection). Consumer provides a React Context; common component only reads templateOverrides. */
export interface TemplateSelectionContextValue {
  templateOverrides?: Record<string, string>
}

/** Context passed to renderHeaderLeft when provided; use to render e.g. host list next to the title. */
export interface HeaderLeftContext {
  pageTitle: string
  templates: Template[]
  source: Source
  dashboard?: DashboardsModels.Dashboard
  templateVariableLocalSelected?: (
    dashboardID: string,
    templateID: string,
    value: TemplateValue
  ) => void
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
  /** Optional per-cell transformer before rendering/layout. */
  transformCell?: (cell: Cell) => Cell
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
  noDataMessage?: string

  templateAvailabilityGate?: {resolved: boolean; blocked: boolean}
  /**
   * Optional list of tempVar names (e.g. ':host:') that must have a selected
   * value before queries are executed. Used to avoid sending incomplete
   * queries that still contain template tokens.
   */
  requiredTemplateVars?: string[]
  /**
   * Optional React Context for template overrides. When provided, common component reads
   * templateOverrides (tempVar -> selected value) and applies to templates passed to cells.
   * Consumer owns state and provides via Provider; no page-specific state in common component.
   */
  templateSelectionContext?: React.Context<TemplateSelectionContextValue | null>
  /** Optional: return extra action buttons per cell (frontend-only, no backend). */
  getExtraActionsForCell?: (cell: Cell) => DashboardsModels.CellExtraAction[]
  /** Called when user clicks an injected extra action. */
  onCustomCellAction?: (cell: Cell, actionId: string) => void
  /**
   * LayoutRenderer에 넘기는 `templatesForLayout`과 동일한 배열 (host hydrate + dashboardTime 등).
   * e.g. UsageDetailModal이 그리드와 같은 템플릿을 쓰게 할 때.
   */
  onLayoutTemplatesChange?: (templates: Template[]) => void
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
  notify?: (message: {
    type: string
    icon: string
    duration: number
    message: string
  }) => void
  cellQueryStatus?: QueriesModels.QueryStatus
  editCellQueryStatus?: (
    queryID: string,
    status: QueriesModels.Status
  ) => unknown
  templateVariableLocalSelected?: (
    dashboardID: string,
    templateID: string,
    value: TemplateValue
  ) => void
}

function DashboardPageWithImport({
  pageTitle,
  pageName,
  getTempVars,
  renderCell,
  transformCell,
  renderHeaderLeft,
  renderHeaderRight,
  timeRangeKey = 'hostDetails',
  pageClassName = 'dashboard-page-with-import',
  importButtonText = 'Import Cell',
  showEmptyState = true,
  noDataMessage,
  templateAvailabilityGate,
  draggableCancel,
  requiredTemplateVars,
  templateSelectionContext,
  getExtraActionsForCell,
  onCustomCellAction,
  onLayoutTemplatesChange,
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
    editCellQueryStatus ??
    ((_queryID: string, _status: QueriesModels.Status) => undefined)

  const [manualRefreshStamp, setManualRefreshStamp] = React.useState(Date.now())
  const [hydratedTemplates, setHydratedTemplates] = React.useState<
    Template[] | null
  >(null)
  const effectiveManualRefresh = manualRefreshStamp || manualRefresh
  const [selectedCell, setSelectedCell] = useState<
    DashboardsModels.Cell | DashboardsModels.NewDefaultCell | null
  >(null)
  const [isCellEditorOpen, setIsCellEditorOpen] = useState(false)
  const [isFixedCellModalOpen, setIsFixedCellModalOpen] = useState(false)
  const [isApplyingTemplateUpdate, setIsApplyingTemplateUpdate] = useState(
    false
  )
  const fixedCellBtnRef = useRef<HTMLElement>(null)

  useEffect(() => {
    GlobalAutoRefresher.poll(autoRefresh)
    return () => {
      GlobalAutoRefresher.stopPolling()
    }
  }, [autoRefresh])

  const templateSelection =
    templateSelectionContext != null
      ? React.useContext(templateSelectionContext)
      : null
  const templateOverrides = templateSelection?.templateOverrides

  const {
    dashboard,
    cells,
    loadSettled,
    localTemplates,
    onPositionChange,
    onDeleteCell,
    onHideCell,
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

  const visibleCells = React.useMemo(() => cells.filter(c => !c.hidden), [
    cells,
  ])
  const effectiveVisibleCells = React.useMemo(
    () =>
      transformCell
        ? visibleCells.map(cell => transformCell(cell))
        : visibleCells,
    [visibleCells, transformCell]
  )

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
    return tempVars.map(t => {
      const override = templateOverrides?.[t.tempVar]
      if (override !== undefined) {
        return {
          ...t,
          values: (t.values || []).map(v => ({
            ...v,
            localSelected: v.value === override,
          })),
        }
      }

      const dashboardTemplate = dashboard?.templates?.find(
        dt => dt.tempVar === t.tempVar
      )
      if (dashboardTemplate) {
        return {
          ...t,
          values: (t.values || []).map(v => {
            const dashboardValue = dashboardTemplate.values.find(
              dv => dv.value === v.value
            )
            return {
              ...v,
              localSelected:
                dashboardValue?.localSelected ??
                v.localSelected ??
                v.selected ??
                false,
            }
          }),
        }
      }

      return {
        ...t,
        values: (t.values || []).map(v => ({
          ...v,
          localSelected:
            v.localSelected !== undefined
              ? v.localSelected
              : v.selected ?? false,
        })),
      }
    })
  }, [tempVars, templateOverrides, dashboard?.templates])

  const templatesReady = React.useMemo(() => {
    if (!mergedTemplates.length) {
      return true
    }
    if (hydratedTemplates === null) {
      return false
    }

    if (!requiredTemplateVars || !requiredTemplateVars.length) {
      return true
    }

    return requiredTemplateVars.every(tempVar => {
      const tpl = templatesWithSelection.find(t => t.tempVar === tempVar)
      if (!tpl || !tpl.values || !tpl.values.length) {
        return false
      }
      return tpl.values.some(v => v.localSelected || v.selected)
    })
  }, [
    mergedTemplates.length,
    hydratedTemplates,
    requiredTemplateVars,
    templatesWithSelection,
  ])

  const requiredTemplateVarsHaveNoValues = React.useMemo(() => {
    if (!requiredTemplateVars?.length || hydratedTemplates === null) {
      return false
    }
    return requiredTemplateVars.some(tempVar => {
      const tpl = templatesWithSelection.find(t => t.tempVar === tempVar)
      return !tpl?.values?.length
    })
  }, [requiredTemplateVars, hydratedTemplates, templatesWithSelection])

  const showNoDataForBlockedTemplates =
    Boolean(noDataMessage) &&
    hydratedTemplates !== null &&
    !templatesReady &&
    (requiredTemplateVarsHaveNoValues ||
      (templateAvailabilityGate?.resolved === true &&
        templateAvailabilityGate.blocked === true))

  const noDataFallback =
    noDataMessage != null && noDataMessage !== '' ? (
      <div className="dashboard-empty">
        <p>{noDataMessage}</p>
      </div>
    ) : null

  const selectedTimeRange: QueriesModels.TimeRange =
    cloudTimeRange?.[timeRangeKey] ?? CLOUD_TIME_RANGE.default ?? timeRanges[0]
  const dashboardRefresh = cloudAutoRefresh?.[timeRangeKey] ?? 0

  const templatesForLayout = useMemo(() => {
    const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates(
      selectedTimeRange
    )

    const templateMap = new Map<string, Template>()

    templatesWithSelection.forEach(t => {
      const key = t.tempVar || t.id
      if (key) templateMap.set(key, t)
    })

    templateMap.set(dashboardTime.tempVar || dashboardTime.id, dashboardTime)
    templateMap.set(
      upperDashboardTime.tempVar || upperDashboardTime.id,
      upperDashboardTime
    )

    return Array.from(templateMap.values())
  }, [templatesWithSelection, selectedTimeRange])

  React.useEffect(() => {
    onLayoutTemplatesChange?.(templatesForLayout)
  }, [templatesForLayout, onLayoutTemplatesChange])

  const dashboardTemplatesForEditor = useMemo(() => {
    const templateMap = new Map<string, Template>()

    templatesWithSelection.forEach(t => {
      const key = t.tempVar || t.id
      if (key) templateMap.set(key, t)
    })
    ;(dashboard?.templates ?? []).forEach(t => {
      const key = t.tempVar || t.id
      if (key && !templateMap.has(key)) {
        templateMap.set(key, t)
      }
    })

    localTemplates.forEach(t => {
      const key = t.tempVar || t.id
      if (key) templateMap.set(key, t)
    })

    const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates(
      selectedTimeRange
    )
    templateMap.set(dashboardTime.tempVar || dashboardTime.id, dashboardTime)
    templateMap.set(
      upperDashboardTime.tempVar || upperDashboardTime.id,
      upperDashboardTime
    )

    return Array.from(templateMap.values())
  }, [
    templatesWithSelection,
    dashboard?.templates,
    localTemplates,
    selectedTimeRange,
  ])

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
      addDashboardCellAsync(
        dashboard,
        newCell as DashboardsModels.NewDefaultCell
      )
    }
    setIsCellEditorOpen(false)
  }

  const handleCloseCellEditor = () => setIsCellEditorOpen(false)

  const hideBuiltinQueriesTab = React.useMemo(() => {
    if (!selectedCell || !('cellOrigin' in selectedCell)) return false
    const o = (selectedCell as Cell).cellOrigin
    return (
      o === CellOrigin.Builtin ||
      String(o ?? '').toLowerCase() === 'builtin'
    )
  }, [selectedCell])

  const handleChooseTimeRange = (tr: QueriesModels.TimeRange) => {
    onChooseCloudTimeRange({...cloudTimeRange, [timeRangeKey]: tr})
  }
  const handleChooseAutoRefresh = (option: AutoRefreshOption) => {
    setAutoRefresh(option.milliseconds)
  }
  const handleManualRefresh = () => setManualRefreshStamp(Date.now())

  const importButton = (
    <Button
      color={ComponentColor.Default}
      shape={ButtonShape.Square}
      onClick={() => importModal.setIsOpen(prev => !prev)}
      icon={IconFont.Import}
    />
  )

  // ── Fixed Cell modal ────────────────────────────────────────────────

  /**
   * Build two sections from the full cells list (including hidden):
   *  - "Template Cells" → cellOrigin === 'builtin'  (no delete)
   *  - "Custom Cells"   → all others (imported/user) (deletable)
   * checked = !cell.hidden  →  visible on dashboard
   */
  const fixedCellModalSections: PopoverModalSection[] = useMemo(() => {
    const builtinCells = cells
      .filter(c => c.cellOrigin === CellOrigin.Builtin)
      .sort((a, b) => a.name.localeCompare(b.name))
    const flexCells = cells
      .filter(c => c.cellOrigin !== CellOrigin.Builtin)
      .sort((a, b) => a.name.localeCompare(b.name))
    const sections: PopoverModalSection[] = []
    if (builtinCells.length > 0) {
      sections.push({
        label: 'Template',
        items: builtinCells.map(c => ({
          id: c.i,
          label: c.name,
          type: 'checkbox' as const,
          checked: !c.hidden,
          deletable: false,
        })),
      })
    }
    if (flexCells.length > 0) {
      sections.push({
        label: 'Custom',
        items: flexCells.map(c => ({
          id: c.i,
          label: c.name,
          type: 'checkbox' as const,
          checked: !c.hidden,
          deletable: true,
        })),
      })
    }
    return sections
  }, [cells])

  const handleFixedCellModalConfirm = (
    values: Record<string, boolean | string>
  ) => {
    const newCells = cells.map(c => {
      const newChecked = values[c.i]
      if (newChecked === undefined) return c
      const nowHidden = !newChecked
      if (!!c.hidden === nowHidden) return c
      return {...c, hidden: nowHidden}
    })
    // Only save if something actually changed
    const hasChanges = newCells.some((c, i) => c.hidden !== cells[i].hidden)
    if (hasChanges) onPositionChange(newCells)
  }

  const handleDeleteCellFromModal = (cellId: string) => {
    const cell = cells.find(c => c.i === cellId)
    if (cell) onDeleteCell(cell)
  }

  const fixedCellModalButton = (
    <span
      ref={fixedCellBtnRef as React.RefObject<HTMLSpanElement>}
      style={{display: 'inline-flex'}}
    >
      <Button
        color={ComponentColor.Default}
        shape={ButtonShape.Square}
        onClick={() => setIsFixedCellModalOpen(prev => !prev)}
        icon={IconFont.CogThick}
      />
    </span>
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

  const handleUpdateTemplate = async () => {
    if (!dashboard?.updateAvailable || !pageName) return

    setIsApplyingTemplateUpdate(true)
    try {
      await applyFixedCell(pageName)
      await getDashboardsAsync()
      safeNotify(notifyTemplateUpdated())
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      safeNotify(notifyTemplateUpdateFailed(message))
    } finally {
      setIsApplyingTemplateUpdate(false)
    }
  }

  const fixedCellUpdateBar = dashboard?.updateAvailable && (
    <div className="fixed-cells__update-bar update-bar--modal">
      <span className="fixed-cells__version-info">
        Update: {dashboard.version ? `v${dashboard.version}` : '—'} →{' '}
        {dashboard.latestVersion ? `v${dashboard.latestVersion}` : '—'}
      </span>
      <button
        type="button"
        className="fixed-cells__btn-update"
        disabled={isApplyingTemplateUpdate}
        onClick={handleUpdateTemplate}
      >
        {isApplyingTemplateUpdate ? 'Updating...' : 'Update'}
      </button>
      <QuestionMarkTooltip
        tipID="template-update-help"
        tipContent={UPDATE_HELP_TEXT}
      />
    </div>
  )

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
      {fixedCellModalButton}
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
            hideQueriesTab={hideBuiltinQueriesTab}
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
              dashboard,
              templateVariableLocalSelected,
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
          {effectiveVisibleCells.length ? (
            templatesReady ? (
              <LayoutRenderer
                cells={effectiveVisibleCells}
                source={source}
                sources={sources}
                isEditable={true}
                isStatusPage={false}
                isStaticPage={false}
                timeRange={selectedTimeRange}
                manualRefresh={effectiveManualRefresh}
                onDeleteCell={onHideCell}
                onCloneCell={onCloneCell}
                getExtraActionsForCell={getExtraActionsForCell}
                onCustomCellAction={onCustomCellAction}
                onPositionChange={onPositionChange}
                templates={templatesForLayout}
                onSummonOverlayTechnologies={onSummonOverlayTechnologies}
                host={source.name}
                renderCell={renderCell}
                draggableCancel={draggableCancel}
              />
            ) : showNoDataForBlockedTemplates ? (
              noDataFallback
            ) : (
              <PageSpinner customClass={`${pageClassName}-spinner`} />
            )
          ) : dashboard ? (
            showEmptyState ? (
              <DashboardEmpty dashboard={dashboard} />
            ) : (
              noDataFallback
            )
          ) : loadSettled ? (
            <div className="dashboard-empty">
              <p>page not available.</p>
            </div>
          ) : (
            <PageSpinner customClass={`${pageClassName}-spinner`} />
          )}
        </div>
      </Page.Contents>
      {importModal.isOpen && (
        <FixedModal
          onClose={() => importModal.setIsOpen(false)}
          onSelectionChange={importModal.onSelectionChange}
        />
      )}
      {/* fixed cell modal */}
      <PopoverModal
        anchorRef={fixedCellBtnRef as React.RefObject<HTMLElement>}
        isOpen={isFixedCellModalOpen}
        onClose={() => setIsFixedCellModalOpen(false)}
        title="Cell Manager"
        sections={fixedCellModalSections}
        onConfirm={handleFixedCellModalConfirm}
        onDeleteItem={handleDeleteCellFromModal}
        width={320}
        tip={<ServerDetailTips />}
        beforeBody={fixedCellUpdateBar}
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
  templateVariableLocalSelected: bindActionCreators(
    templateVariableLocalSelected,
    dispatch
  ),
  dispatch,
})

export default DashboardPageWithImport
