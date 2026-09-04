import React, {useEffect, useState} from 'react'
import {connect} from 'react-redux'
import {getDashboardsAsync} from 'src/dashboards/actions'
import {
  Dashboard,
  Cell,
  Source,
  TimeRange,
  Template,
  DashboardType,
  CellType,
} from 'src/types'
import {ImportSelectionPayload} from 'src/shared/types/importModal'
import _ from 'lodash'
import classnames from 'classnames'
import OverlayTechnology from 'src/reusable_ui/components/overlays/OverlayTechnology'
import OverlayContainer from 'src/reusable_ui/components/overlays/OverlayContainer'
import OverlayHeading from 'src/reusable_ui/components/overlays/OverlayHeading'
import OverlayBody from 'src/reusable_ui/components/overlays/OverlayBody'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import {renderRegisteredCell} from 'src/shared/components/cellRegistry'
import {
  detectTemplateConflicts,
  getTemplateQueryKey,
} from 'src/server_details/utils/templateConflict'
import {hasRunnableQuery} from 'src/reusable_ui/components/FixedModal/previewCells'
import {proxy} from 'src/utils/queryUrlGenerator'
import {getDeep} from 'src/utils/wrappers'

interface DashboardListProps {
  dashboards: Dashboard[]
  handleGetDashboards: () => Promise<Dashboard[]>
  source?: Source
  timeRange?: TimeRange
  onSelectionChange?: (items: ImportSelectionPayload) => void
  /** Hide this dashboard from the import source list (usually the active one). */
  excludeDashboardId?: string | number
}

/** Cloned dashboards reuse cell.i — qualify by dashboard id for selection. */
const cellSelectionKey = (dashboardId: string, cellId: string): string =>
  `${dashboardId}::${cellId}`

interface DashboardItemProps {
  dashboard: Dashboard
  onPreviewClick: (cell: Cell, dashboard: Dashboard) => void
  onToggle: (id: string, checked: boolean) => void
  isSelected: boolean
  onCellToggle: (dashboardId: string, cellId: string, checked: boolean) => void
  selectedCells: Set<string>
}

interface CellItemProps {
  cell: Cell
  dashboardId: string
  onPreviewClick: (cell: Cell) => void
  onToggle: (cellId: string, checked: boolean) => void
  isSelected: boolean
}

interface CellPreviewModalProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  cell: Cell | null
  source?: Source
  timeRange?: TimeRange
  templates?: Template[]
}

const CellPreviewModal: React.FC<CellPreviewModalProps> = ({
  isOpen,
  setIsOpen,
  cell,
  source,
  timeRange,
  templates = [],
}) => {
  if (!cell || !source) return null

  // 셀을 렌더링하기 위한 형식으로 변환
  const previewCell = {
    ...cell,
    inView: true,
    queries: cell.queries.map(q => ({
      ...q,
      text: q.query || q.text,
      queryConfig: {
        ...q.queryConfig,
        rawText: q.query || q.text || '',
      },
    })),
  }

  const defaultTimeRange: TimeRange = {
    upper: null,
    lower: null,
  }

  return (
    <OverlayTechnology visible={isOpen}>
      <OverlayContainer maxWidth={1200}>
        <OverlayHeading
          title={cell.name || 'Cell Preview'}
          onDismiss={() => setIsOpen(false)}
        />
        <OverlayBody>
          <div className="fixedmodal-preview-body">
            <LayoutRenderer
              cells={[previewCell]}
              source={source}
              sources={source ? [source] : []}
              isEditable={false}
              isStatusPage={false}
              isStaticPage={false}
              timeRange={timeRange || defaultTimeRange}
              manualRefresh={0}
              templates={templates}
              host=""
              renderCell={renderRegisteredCell}
            />
          </div>
        </OverlayBody>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

const CellItem: React.FC<CellItemProps> = ({
  cell,
  dashboardId,
  onPreviewClick,
  onToggle,
  isSelected,
}) => {
  const checkboxId = `cell-checkbox-${dashboardId}-${cell.i}`

  const handleTypeClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onPreviewClick(cell)
  }

  return (
    <div
      className="fixedmodal-list-row fixedmodal-list-row--nested"
      onClick={() => onToggle(cell.i, !isSelected)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle(cell.i, !isSelected)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="fixedmodal-list-row__inner">
        <div
          className="fixedmodal-checkbox-wrapper"
          onClick={e => e.stopPropagation()}
        >
          <input
            type="checkbox"
            id={checkboxId}
            checked={isSelected}
            onChange={e => {
              e.stopPropagation()
              onToggle(cell.i, e.target.checked)
            }}
            onClick={e => e.stopPropagation()}
          />
          <label
            htmlFor={checkboxId}
            onClick={e => e.stopPropagation()}
          />
        </div>
        <span className="icon circle-thin fixedmodal-list-row__icon" />
        <span
          className="fixedmodal-list-row__cell-name"
          title={cell.name || 'Unnamed Cell'}
        >
          {cell.name || 'Unnamed Cell'}
        </span>
        <span
          className="fixedmodal-list-row__cell-type"
          onClick={handleTypeClick}
          title={cell.type}
        >
          {cell.type}
        </span>
      </div>
    </div>
  )
}

const DashboardItem: React.FC<DashboardItemProps> = ({
  dashboard,
  onPreviewClick,
  onToggle,
  isSelected,
  onCellToggle,
  selectedCells,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  const hasCells = dashboard.cells && dashboard.cells.length > 0

  return (
    <div
      className={classnames('dashboard-tree-item', {expanded: isExpanded})}
    >
      <div
        className={classnames('dashboard-tree-header fixedmodal-list-row', {
          'is-expanded': isExpanded,
          'is-hovered': isHovered,
          'has-no-children': !hasCells,
        })}
        onClick={hasCells ? toggleExpanded : undefined}
        onMouseEnter={() => hasCells && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className="fixedmodal-checkbox-wrapper"
          onClick={e => e.stopPropagation()}
        >
          <input
            type="checkbox"
            id={`dashboard-checkbox-${dashboard.id}`}
            checked={isSelected}
            onChange={e => {
              e.stopPropagation()
              onToggle(dashboard.id, e.target.checked)
            }}
            onClick={e => e.stopPropagation()}
          />
          <label
            htmlFor={`dashboard-checkbox-${dashboard.id}`}
            onClick={e => e.stopPropagation()}
          />
        </div>
        <div className="fixedmodal-list-row__caret-wrap">
          {hasCells && (
            <span
              className={classnames('icon fixedmodal-list-row__caret-icon', {
                'caret-down': isExpanded,
                'caret-right': !isExpanded,
              })}
            />
          )}
        </div>
        <div className="fixedmodal-list-row__title-block">
          <div
            className="fixedmodal-list-row__name"
            title={dashboard.name || 'Untitled Dashboard'}
          >
            {dashboard.name || 'Untitled Dashboard'}
          </div>
          <div
            className="fixedmodal-list-row__meta"
            title={`Cells: ${dashboard.cells?.length || 0}`}
          >
            Cells: {dashboard.cells?.length || 0}
          </div>
        </div>
      </div>
      {hasCells && isExpanded && (
        <div className="dashboard-tree-children">
          {dashboard.cells.map(cell => (
            <CellItem
              key={cellSelectionKey(dashboard.id, cell.i)}
              cell={cell}
              dashboardId={dashboard.id}
              onPreviewClick={cell => onPreviewClick(cell, dashboard)}
              onToggle={(cellId, checked) =>
                onCellToggle(dashboard.id, cellId, checked)
              }
              isSelected={selectedCells.has(
                cellSelectionKey(dashboard.id, cell.i)
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DashboardList({
  dashboards,
  handleGetDashboards,
  source,
  timeRange,
  onSelectionChange,
  excludeDashboardId,
}: DashboardListProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [previewCell, setPreviewCell] = useState<Cell | null>(null)
  const [previewTemplates, setPreviewTemplates] = useState<Template[]>([])
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [selectedDashboards, setSelectedDashboards] = useState<Set<string>>(
    new Set()
  )
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  // Measurements collected on the current source; null while unknown, in which
  // case no template is hidden (a failed lookup must not swallow the list).
  const [measurements, setMeasurements] = useState<string[] | null>(null)

  useEffect(() => {
    if (!source) {
      return
    }
    let isCancelled = false

    proxy({
      source: source.links.proxy,
      query: 'SHOW MEASUREMENTS',
      db: source.telegraf,
    })
      .then(({data}) => {
        if (isCancelled) {
          return
        }
        const values = getDeep<string[][]>(
          data,
          'results.[0].series.[0].values',
          []
        )
        setMeasurements(values.map(v => v[0]))
      })
      .catch(() => {
        // Leave it unknown so every shared template stays listed.
      })

    return () => {
      isCancelled = true
    }
  }, [source])

  // Importable cells only (no query → “Add Data” cells are excluded from the list).
  // `component` cells carry no query — they render from the cell registry — so
  // they are importable even though hasRunnableQuery() rejects them.
  const isImportableCell = (cell: Cell) =>
    cell.type === CellType.Component || hasRunnableQuery(cell)

  const importableDashboards = _.sortBy(
    dashboards,
    d => d.name?.toLowerCase() || ''
  )
    .filter(dashboard => {
      if (dashboard.type === DashboardType.Builtin) {
        // Builtin dashboards back their own pages; only the ones the template
        // marks as shared are offered as importable templates, and only while
        // the measurement they read is actually being collected.
        if (!dashboard.shared) {
          return false
        }
        if (
          dashboard.measurement &&
          measurements &&
          !measurements.includes(dashboard.measurement)
        ) {
          return false
        }
      } else if (dashboard.type !== DashboardType.Normal) {
        return false
      }
      if (
        excludeDashboardId != null &&
        excludeDashboardId !== '' &&
        String(dashboard.id) === String(excludeDashboardId)
      ) {
        return false
      }
      return true
    })
    .map(dashboard => ({
      ...dashboard,
      cells: (dashboard.cells ?? []).filter(isImportableCell),
    }))
    .filter(dashboard => (dashboard.cells?.length ?? 0) > 0)

  // Builtin dashboards are the shipped cell templates (e.g. snmp); list them
  // under their own heading so they read as categories, not user dashboards.
  const templateDashboards = importableDashboards.filter(
    d => d.type === DashboardType.Builtin
  )
  const userDashboards = importableDashboards.filter(
    d => d.type !== DashboardType.Builtin
  )

  const emitSelectionChange = (nextCells: Set<string>) => {
    if (!onSelectionChange) {
      return
    }

    const dashboardsWithSelectedCellsOnly = importableDashboards
      .map(d => ({
        ...d,
        cells: (d.cells ?? []).filter(c =>
          nextCells.has(cellSelectionKey(d.id, c.i))
        ),
      }))
      .filter(d => d.cells.length > 0)

    const allTemplates: Template[] = []
    const templateMap = new Map<string, Template>()

    dashboardsWithSelectedCellsOnly.forEach(dashboard => {
      if (dashboard.templates && dashboard.templates.length > 0) {
        dashboard.templates.forEach(template => {
          const queryKey = getTemplateQueryKey(template)
          const fullKey = `${template.tempVar}::${queryKey}`

          if (!templateMap.has(fullKey)) {
            templateMap.set(fullKey, template)
            allTemplates.push(template)
          }
        })
      }
    })

    onSelectionChange({
      dashboards: dashboardsWithSelectedCellsOnly,
      cellTypes: [],
      libraryCells: [],
      templates: detectTemplateConflicts(allTemplates),
      importStrategy: 'append',
    })
  }

  const handleDashboardToggle = (dashboardId: string, checked: boolean) => {
    const newSelected = new Set(selectedDashboards)
    const newSelectedCells = new Set(selectedCells)

    const dashboard = importableDashboards.find(d => d.id === dashboardId)

    if (checked) {
      newSelected.add(dashboardId)
      if (dashboard?.cells) {
        dashboard.cells.forEach(cell => {
          newSelectedCells.add(cellSelectionKey(dashboardId, cell.i))
        })
      }
    } else {
      newSelected.delete(dashboardId)
      if (dashboard?.cells) {
        dashboard.cells.forEach(cell => {
          newSelectedCells.delete(cellSelectionKey(dashboardId, cell.i))
        })
      }
    }

    setSelectedDashboards(newSelected)
    setSelectedCells(newSelectedCells)
    emitSelectionChange(newSelectedCells)
  }

  const handleCellToggle = (
    dashboardId: string,
    cellId: string,
    checked: boolean
  ) => {
    const key = cellSelectionKey(dashboardId, cellId)
    const newSelected = new Set(selectedCells)
    if (checked) {
      newSelected.add(key)
    } else {
      newSelected.delete(key)
    }
    setSelectedCells(newSelected)

    const dashboard = importableDashboards.find(d => d.id === dashboardId)
    const newSelectedDashboards = new Set(selectedDashboards)
    if (dashboard?.cells?.length) {
      const allSelected = dashboard.cells.every(cell =>
        newSelected.has(cellSelectionKey(dashboardId, cell.i))
      )
      if (allSelected) {
        newSelectedDashboards.add(dashboardId)
      } else {
        newSelectedDashboards.delete(dashboardId)
      }
      setSelectedDashboards(newSelectedDashboards)
    }

    emitSelectionChange(newSelected)
  }

  useEffect(() => {
    const loadDashboards = async () => {
      setIsLoading(true)
      try {
        await handleGetDashboards()
      } catch (error) {
        console.error('Failed to load dashboards:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboards()
  }, [handleGetDashboards])

  const handlePreviewClick = (cell: Cell, dashboard: Dashboard) => {
    setPreviewCell(cell)
    setPreviewTemplates(dashboard.templates || [])
    setIsPreviewOpen(true)
  }

  if (isLoading) {
    return (
      <div className="fixedmodal-list fixedmodal-list__loading">
        <p className="fixedmodal-list__message">Loading...</p>
      </div>
    )
  }

  const renderGroup = (label: string, group: typeof importableDashboards) => {
    if (group.length === 0) {
      return null
    }
    return (
      <React.Fragment key={label}>
        <div className="fixedmodal-list__group-label">{label}</div>
        <div className="fixedmodal-list__list-box">
          {group.map(dashboard => (
            <DashboardItem
              key={dashboard.id}
              dashboard={dashboard}
              onPreviewClick={handlePreviewClick}
              onToggle={handleDashboardToggle}
              isSelected={selectedDashboards.has(dashboard.id)}
              onCellToggle={handleCellToggle}
              selectedCells={selectedCells}
            />
          ))}
        </div>
      </React.Fragment>
    )
  }

  return (
    <div className="fixedmodal-list">
      {importableDashboards.length === 0 ? (
        <p className="fixedmodal-list__message">No dashboards found.</p>
      ) : (
        <>
          {renderGroup('Template', templateDashboards)}
          {renderGroup('Dashboards', userDashboards)}
        </>
      )}
      <CellPreviewModal
        isOpen={isPreviewOpen}
        setIsOpen={setIsPreviewOpen}
        cell={previewCell}
        source={source}
        timeRange={timeRange}
        templates={previewTemplates}
      />
    </div>
  )
}

const mapStateToProps = ({dashboardUI, sources, app}) => {
  const activeSourceID = app?.persisted?.activeSourceID
  const source =
    sources?.find((s: Source) => s.id === activeSourceID) || sources?.[0]

  return {
    dashboards: dashboardUI.dashboards || [],
    source,
    timeRange: app?.persisted?.timeRange || {upper: null, lower: null},
  }
}

const mapDispatchToProps = {
  handleGetDashboards: getDashboardsAsync,
}

export default connect(mapStateToProps, mapDispatchToProps)(DashboardList)
