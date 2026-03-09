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
} from 'src/types'
import {ImportSelectionPayload} from 'src/shared/types/importModal'
import _ from 'lodash'
import classnames from 'classnames'
import OverlayTechnology from 'src/reusable_ui/components/overlays/OverlayTechnology'
import OverlayContainer from 'src/reusable_ui/components/overlays/OverlayContainer'
import OverlayHeading from 'src/reusable_ui/components/overlays/OverlayHeading'
import OverlayBody from 'src/reusable_ui/components/overlays/OverlayBody'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import {
  detectTemplateConflicts,
  getTemplateQueryKey,
} from 'src/server_details/utils/templateConflict'

interface DashboardListProps {
  dashboards: Dashboard[]
  handleGetDashboards: () => Promise<Dashboard[]>
  source?: Source
  timeRange?: TimeRange
  onSelectionChange?: (items: ImportSelectionPayload) => void
}

interface DashboardItemProps {
  dashboard: Dashboard
  onPreviewClick: (cell: Cell) => void
  onToggle: (id: string, checked: boolean) => void
  isSelected: boolean
  onCellToggle: (cellId: string, checked: boolean) => void
  selectedCells: Set<string>
}

interface CellItemProps {
  cell: Cell
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
            />
          </div>
        </OverlayBody>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

const CellItem: React.FC<CellItemProps> = ({
  cell,
  onPreviewClick,
  onToggle,
  isSelected,
}) => {
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
            id={`cell-checkbox-${cell.i}`}
            checked={isSelected}
            onChange={e => {
              e.stopPropagation()
              onToggle(cell.i, e.target.checked)
            }}
            onClick={e => e.stopPropagation()}
          />
          <label
            htmlFor={`cell-checkbox-${cell.i}`}
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
              key={cell.i}
              cell={cell}
              onPreviewClick={onPreviewClick}
              onToggle={onCellToggle}
              isSelected={selectedCells.has(cell.i)}
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
}: DashboardListProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [previewCell, setPreviewCell] = useState<Cell | null>(null)
  const [previewTemplates, setPreviewTemplates] = useState<Template[]>([])
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [selectedDashboards, setSelectedDashboards] = useState<Set<string>>(
    new Set()
  )
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())

  const handleDashboardToggle = (dashboardId: string, checked: boolean) => {
    const newSelected = new Set(selectedDashboards)
    const newSelectedCells = new Set(selectedCells)

    const dashboard = dashboards.find(d => d.id === dashboardId)

    if (checked) {
      newSelected.add(dashboardId)
      if (dashboard?.cells) {
        dashboard.cells.forEach(cell => {
          newSelectedCells.add(cell.i)
        })
      }
    } else {
      newSelected.delete(dashboardId)
      if (dashboard?.cells) {
        dashboard.cells.forEach(cell => {
          newSelectedCells.delete(cell.i)
        })
      }
    }

    setSelectedDashboards(newSelected)
    setSelectedCells(newSelectedCells)

    if (onSelectionChange) {
      const selected = dashboards.filter(d => newSelected.has(d.id))
      const selectedCellsList: Cell[] = []
      dashboards.forEach(d => {
        d.cells?.forEach(cell => {
          if (newSelectedCells.has(cell.i)) {
            selectedCellsList.push(cell)
          }
        })
      })

      const allTemplates: Template[] = []
      const templateMap = new Map<string, Template>()

      selected.forEach(dashboard => {
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

      const templatesWithConflict = detectTemplateConflicts(allTemplates)

      const dashboardsWithSelectedCellsOnly = selected
        .map(d => ({
          ...d,
          cells: (d.cells ?? []).filter(c => newSelectedCells.has(c.i)),
        }))
        .filter(d => d.cells.length > 0)

      onSelectionChange({
        dashboards: dashboardsWithSelectedCellsOnly,
        cellTypes: [],
        libraryCells: [],
        templates: templatesWithConflict,
        importStrategy: 'append',
      })
    }
  }

  const handleCellToggle = (cellId: string, checked: boolean) => {
    const newSelected = new Set(selectedCells)
    if (checked) {
      newSelected.add(cellId)
    } else {
      newSelected.delete(cellId)
    }
    setSelectedCells(newSelected)

    if (onSelectionChange) {
      // 현재 선택된 셀을 기준으로, 하나 이상의 셀이 선택된 대시보드를 모두 payload에 포함한다.
      const selectedDashboardsByCells = dashboards.filter(dashboard =>
        dashboard.cells?.some(cell => newSelected.has(cell.i))
      )

      const selectedDashboardIds = new Set<string>([
        ...Array.from(selectedDashboards),
        ...selectedDashboardsByCells.map(d => d.id),
      ])

      const selected = dashboards.filter(d => selectedDashboardIds.has(d.id))

      const allTemplates: Template[] = []
      const templateMap = new Map<string, Template>()

      selected.forEach(dashboard => {
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

      const templatesWithConflict = detectTemplateConflicts(allTemplates)

      const dashboardsWithSelectedCellsOnly = selected
        .map(d => ({
          ...d,
          cells: (d.cells ?? []).filter(c => newSelected.has(c.i)),
        }))
        .filter(d => d.cells.length > 0)

      onSelectionChange({
        dashboards: dashboardsWithSelectedCellsOnly,
        cellTypes: [],
        libraryCells: [],
        templates: templatesWithConflict,
        importStrategy: 'append',
      })
    }
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

  const handlePreviewClick = (cell: Cell) => {
    const dashboard = dashboards.find(d => d.cells?.some(c => c.i === cell.i))

    setPreviewCell(cell)
    setPreviewTemplates(dashboard?.templates || [])
    setIsPreviewOpen(true)
  }

  if (isLoading) {
    return (
      <div className="fixedmodal-list fixedmodal-list__loading">
        <p className="fixedmodal-list__message">Loading...</p>
      </div>
    )
  }

  const sortedDashboards = _.sortBy(
    dashboards,
    d => d.name?.toLowerCase() || ''
  ).filter(dashboard => dashboard.type === DashboardType.Normal)

  return (
    <div className="fixedmodal-list">
      {sortedDashboards.length === 0 ? (
        <p className="fixedmodal-list__message">No dashboards found.</p>
      ) : (
        <div className="fixedmodal-list__list-box">
          {sortedDashboards.map(dashboard => (
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
