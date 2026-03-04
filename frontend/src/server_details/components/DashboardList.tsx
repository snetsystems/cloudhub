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
          <div
            style={{
              height: '600px',
              backgroundColor: '#1c1c21',
              padding: '20px',
              overflow: 'auto',
            }}
          >
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
  const [isHovered, setIsHovered] = useState(false)

  const handleTypeClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onPreviewClick(cell)
  }

  return (
    <div
      onClick={() => onToggle(cell.i, !isSelected)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle(cell.i, !isSelected)
        }
      }}
      role="button"
      tabIndex={0}
      style={{
        padding: '8px 16px 8px 48px',
        borderBottom: '1px solid #383846',
        backgroundColor: '#202028',
        cursor: 'pointer',
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
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
        <span
          className="icon circle-thin"
          style={{fontSize: '6px', color: '#999dab'}}
        />
        <span style={{fontWeight: 500, fontSize: '13px', color: '#999dab'}}>
          {cell.name || 'Unnamed Cell'}
        </span>
        <span
          onClick={handleTypeClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            marginLeft: 'auto',
            color: isHovered ? '#d4d7dd' : '#999dab',
            fontSize: '11px',
            padding: '2px 8px',
            backgroundColor: isHovered ? '#31313d' : '#383846',
            borderRadius: '3px',
            cursor: 'pointer',
            transition: 'background-color 0.25s ease, color 0.25s ease',
          }}
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

  const getBackgroundColor = () => {
    if (isExpanded) return '#383846' // active
    if (isHovered) return '#31313d' // hover
    return '#202028' // default
  }

  const getTextColor = () => {
    if (isExpanded) return '#f6f6f8' // active
    if (isHovered) return '#d4d7dd' // hover
    return '#999dab' // default
  }

  const getSecondaryTextColor = () => {
    if (isExpanded) return 'rgba(246, 246, 248, 0.7)' // active
    if (isHovered) return 'rgba(212, 215, 221, 0.7)' // hover
    return 'rgba(153, 157, 171, 0.7)' // default
  }

  return (
    <div
      className={classnames('dashboard-tree-item', {expanded: isExpanded})}
      style={{borderBottom: '1px solid #383846'}}
    >
      <div
        className="dashboard-tree-header"
        onClick={hasCells ? toggleExpanded : undefined}
        onMouseEnter={() => hasCells && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          padding: '12px 16px',
          cursor: hasCells ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: getBackgroundColor(),
          transition: 'background-color 0.25s ease, color 0.25s ease',
        }}
      >
        <div
          className="fixedmodal-checkbox-wrapper"
          style={{marginRight: '8px'}}
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
        <div
          style={{
            width: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '8px',
          }}
        >
          {hasCells && (
            <span
              className={classnames('icon', {
                'caret-down': isExpanded,
                'caret-right': !isExpanded,
              })}
              style={{
                fontSize: '12px',
                color: getTextColor(),
                transition: 'transform 0.2s, color 0.25s ease',
              }}
            />
          )}
        </div>
        <div style={{flex: 1}}>
          <div
            style={{
              fontWeight: 600,
              fontSize: '14px',
              color: getTextColor(),
              transition: 'color 0.25s ease',
            }}
          >
            {dashboard.name || 'Untitled Dashboard'}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: getSecondaryTextColor(),
              marginTop: '2px',
              transition: 'color 0.25s ease',
            }}
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
      <div style={{padding: '16px'}}>
        <p>Loading...</p>
      </div>
    )
  }

  const sortedDashboards = _.sortBy(
    dashboards,
    d => d.name?.toLowerCase() || ''
  ).filter(dashboard => dashboard.type === DashboardType.Normal)

  return (
    <div style={{padding: '16px'}}>
      {sortedDashboards.length === 0 ? (
        <p>No dashboards found.</p>
      ) : (
        <div
          style={{
            backgroundColor: '#202028',
            border: '1px solid #383846',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
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
