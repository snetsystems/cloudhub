import React, {useEffect, useState, useCallback, useRef} from 'react'
import {useDispatch} from 'react-redux'
import {
  getFixedCellList,
  getFixedCell,
  getFixedCellDashboardByName,
  applyFixedCell,
} from 'src/dashboards/apis'
import {notify} from 'src/shared/actions/notifications'
import {
  notifyFixedCellsUpdated,
  notifyFixedCellsUpdateFailed,
} from 'src/shared/copy/notifications'
import {Dashboard, Cell, CellType, CellOrigin} from 'src/types/dashboards'
import {Template} from 'src/types/tempVars'
import {ImportSelectionPayload} from 'src/shared/types/importModal'
import _ from 'lodash'
import classnames from 'classnames'
import QuestionMarkTooltip from 'src/shared/components/QuestionMarkTooltip'

interface FixedCellsProps {
  onSelectionChange?: (items: ImportSelectionPayload) => void
  /** When set, only the fixed-cell with this name is shown (e.g. current page's template). */
  fixedCellName?: string
}

interface TemplateItemProps {
  template: Dashboard
  selectedCellIds: Set<string>
  onTemplateToggle: (templateName: string, checked: boolean) => void
  onCellToggle: (templateName: string, cellId: string, checked: boolean) => void
}

interface TemplateCellItemProps {
  cell: Cell
  isChecked: boolean
  onToggle: (cellId: string, checked: boolean) => void
}

const TemplateCellItem: React.FC<TemplateCellItemProps> = ({
  cell,
  isChecked,
  onToggle,
}) => {
  const checkboxId = `fixed-cell-cell-${cell.i}`
  const handleRowClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.fixedmodal-checkbox-wrapper'))
      return
    onToggle(cell.i, !isChecked)
  }
  return (
    <div
      className="fixed-cells__cell-row"
      onClick={handleRowClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle(cell.i, !isChecked)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="fixed-cells__cell-inner">
        <div
          className="fixedmodal-checkbox-wrapper"
          onClick={e => e.stopPropagation()}
        >
          <input
            type="checkbox"
            id={checkboxId}
            checked={isChecked}
            onChange={e =>
              onToggle(cell.i, (e.target as HTMLInputElement).checked)
            }
            onClick={e => e.stopPropagation()}
          />
          <label htmlFor={checkboxId} onClick={e => e.stopPropagation()} />
        </div>
        <span className="icon circle-thin" />
        <span className="fixed-cells__cell-name" title={cell.name || 'Unnamed Cell'}>
          {cell.name || 'Unnamed Cell'}
        </span>
        <span className="fixed-cells__cell-type" title={cell.type || '—'}>
          {cell.type || '—'}
        </span>
      </div>
    </div>
  )
}

const TemplateItem: React.FC<TemplateItemProps> = ({
  template,
  selectedCellIds,
  onTemplateToggle,
  onCellToggle,
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const hasCells = template.cells && template.cells.length > 0
  const templateName = template.name || template.id || ''
  const allSelected =
    hasCells && template.cells!.every(c => selectedCellIds.has(c.i))
  const someSelected =
    hasCells && template.cells!.some(c => selectedCellIds.has(c.i))

  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  const handleTemplateCheck = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = (e.target as HTMLInputElement).checked
    onTemplateToggle(templateName, checked)
  }

  const templateCheckRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const el = templateCheckRef.current
    if (el) el.indeterminate = someSelected && !allSelected
  }, [someSelected, allSelected])

  return (
    <div
      className={classnames('dashboard-tree-item', {
        expanded: isExpanded,
        'dashboard-tree-item--no-children': !hasCells,
      })}
    >
      <div
        className="dashboard-tree-header"
        onClick={hasCells ? toggleExpanded : undefined}
      >
        <div
          className="fixedmodal-checkbox-wrapper"
          onClick={e => e.stopPropagation()}
        >
          <input
            ref={templateCheckRef}
            type="checkbox"
            id={`fixed-cell-${template.name}-${template.id}`}
            checked={allSelected}
            onChange={handleTemplateCheck}
            onClick={e => e.stopPropagation()}
          />
          <label
            htmlFor={`fixed-cell-${template.name}-${template.id}`}
            onClick={e => e.stopPropagation()}
          />
        </div>
        <div className="fixed-cells__caret-wrap">
          {hasCells && (
            <span
              className={classnames('icon', {
                'caret-down': isExpanded,
                'caret-right': !isExpanded,
              })}
            />
          )}
        </div>
        <div className="fixed-cells__tree-title">
          <div className="fixed-cells__tree-name" title={template.name || 'Untitled Template'}>
            {template.name || 'Untitled Template'}
          </div>
          <div className="fixed-cells__tree-meta" title={`Cells: ${template.cells?.length || 0}`}>
            Cells: {template.cells?.length || 0}
          </div>
        </div>
      </div>
      {hasCells && isExpanded && (
        <div className="dashboard-tree-children">
          {template.cells!.map((cell, index) => (
            <TemplateCellItem
              key={cell.i ? `${cell.i}-${index}` : `cell-${index}`}
              cell={cell}
              isChecked={selectedCellIds.has(cell.i)}
              onToggle={(cellId, checked) =>
                onCellToggle(templateName, cellId, checked)
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

const UPDATE_HELP_TEXT =
  'When you run this update: For each cell that already exists on your dashboard (matched by cell ID), query definitions (queries) are replaced from the latest fixed-cell template—for all cell types (component, line, line-plus-single-stat, etc.). Layout and names stay as-is. New cells from the template are added as hidden. Template variables and version are updated to the latest.'

function FixedCells({
  onSelectionChange,
  fixedCellName: fixedCellNameFilter,
}: FixedCellsProps) {
  const dispatch = useDispatch()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<Dashboard[]>([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [isApplying, setIsApplying] = useState(false)
  /** template name -> selected cell ids (for Import) */
  const [selectedCellIdsByTemplate, setSelectedCellIdsByTemplate] = useState<
    Record<string, string[]>
  >({})

  const refreshList = () => setRefreshTrigger(t => t + 1)

  const selectedSet = useCallback(
    (templateName: string) => {
      return new Set(selectedCellIdsByTemplate[templateName] ?? [])
    },
    [selectedCellIdsByTemplate]
  )

  const onSelectionChangeRef = useRef(onSelectionChange)
  onSelectionChangeRef.current = onSelectionChange

  const buildSelectionPayload = useCallback(
    (selectedByTemplate: Record<string, string[]>) => {
      const dashboards: Dashboard[] = []
      const templateVars: Template[] = []
      templates.forEach(t => {
        const name = t.name || t.id || ''
        const ids = new Set(selectedByTemplate[name] ?? [])
        const selectedCells = (t.cells ?? []).filter(c => ids.has(c.i))
        if (selectedCells.length === 0) return
        dashboards.push({...t, cells: selectedCells})
        ;(t.templates ?? []).forEach(tv => {
          if (!templateVars.find(v => v.id === tv.id)) templateVars.push(tv)
        })
      })
      return {
        dashboards,
        cellTypes: [] as CellType[],
        libraryCells: [],
        templates: templateVars,
        importStrategy: 'mergeByCellId' as const,
      }
    },
    [templates]
  )

  useEffect(() => {
    const notify = onSelectionChangeRef.current
    if (!notify) return
    const payload = buildSelectionPayload(selectedCellIdsByTemplate)
    notify(payload)
  }, [selectedCellIdsByTemplate, buildSelectionPayload])

  const handleTemplateToggle = useCallback(
    (templateName: string, checked: boolean) => {
      const template = templates.find(
        t => (t.name || t.id || '') === templateName
      )
      const cellIds = template?.cells?.map(c => c.i) ?? []
      setSelectedCellIdsByTemplate(prev => ({
        ...prev,
        [templateName]: checked ? cellIds : [],
      }))
    },
    [templates]
  )

  const handleCellToggle = useCallback(
    (templateName: string, cellId: string, checked: boolean) => {
      setSelectedCellIdsByTemplate(prev => {
        const list = prev[templateName] ?? []
        const nextList = checked
          ? [...list, cellId]
          : list.filter(id => id !== cellId)
        return {...prev, [templateName]: nextList}
      })
    },
    []
  )

  const templatesWithUpdate = templates.filter(t => t.updateAvailable && t.name)
  const hasUpdateAvailable = templatesWithUpdate.length > 0

  const handleUpdateAll = async () => {
    if (!hasUpdateAvailable) return
    setIsApplying(true)
    const count = templatesWithUpdate.length
    try {
      for (const t of templatesWithUpdate) {
        await applyFixedCell(t.name!)
      }
      refreshList()
      dispatch(notify(notifyFixedCellsUpdated(count)))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      dispatch(notify(notifyFixedCellsUpdateFailed(message)))
    } finally {
      setIsApplying(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setError(null)
    setTemplates([])
    setIsLoading(true)

    const load = async () => {
      try {
        const listRes = await getFixedCellList()
        const list = listRes.data?.templates ?? []
        if (cancelled) return
        if (list.length === 0) {
          setIsLoading(false)
          return
        }
        const [templateResults, orgResults] = await Promise.all([
          Promise.all(
            list.map(({name}) => getFixedCell(name).then(r => r.data))
          ),
          Promise.all(list.map(({name}) => getFixedCellDashboardByName(name))),
        ])
        if (cancelled) return
        // 표시 목록 = 사용자 대시보드(org) 기준. builtin 셀은 hidden 여부와 관계없이 전부 표시 (hidden = 대시보드 레이아웃에서만 숨김, 리스트에서는 항상 표시).
        const merged: Dashboard[] = templateResults.map((t, i) => {
          const org = orgResults[i]?.data
          const serverVersion = org?.latestVersion ?? t.version
          const orgBuiltinCells =
            org?.cells?.filter(c => c.cellOrigin === CellOrigin.Builtin) ?? []
          const cells =
            orgBuiltinCells.length > 0 ? orgBuiltinCells : t.cells ?? []
          const templates = org?.templates ?? t.templates ?? []

          return {
            ...(org || t),
            cells,
            templates,
            version: org?.version ?? undefined,
            latestVersion: serverVersion,
            updateAvailable: org?.updateAvailable,
          }
        })
        let filtered = _.sortBy(merged, d => d.name?.toLowerCase() ?? '')

        // 선택 상태: 현재 org에 있는 builtin 셀 id로 초기화 (Update 전 5개 체크, Update 후 6개 체크)
        const initialSelection: Record<string, string[]> = {}
        templateResults.forEach((t, i) => {
          const org = orgResults[i]?.data
          const name = (t.name || t.id || '').toString()
          if (!name) return
          const orgBuiltinIds = (
            org?.cells?.filter(c => c.cellOrigin === CellOrigin.Builtin) ?? []
          )
            .map(c => c.i)
            .filter(Boolean)
          initialSelection[name] = orgBuiltinIds
        })
        if (fixedCellNameFilter) {
          const name = fixedCellNameFilter.trim().toLowerCase()
          filtered = filtered.filter(
            d => (d.name ?? d.id ?? '').toString().toLowerCase() === name
          )
        }
        setTemplates(filtered)
        setSelectedCellIdsByTemplate(prev => ({
          ...prev,
          ...initialSelection,
        }))
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load fixed-cell templates')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [refreshTrigger, fixedCellNameFilter])

  if (isLoading) {
    return (
      <div className="fixed-cells">
        <p>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed-cells">
        <p className="fixed-cells__error">{error}</p>
      </div>
    )
  }

  return (
    <div className="fixed-cells">
      <div className="fixed-cells__header">
        {hasUpdateAvailable && (
          <div className="fixed-cells__update-bar">
            <span className="fixed-cells__version-info">
              Current:{' '}
              {templatesWithUpdate[0].version
                ? `v${templatesWithUpdate[0].version}`
                : '—'}{' '}
              → Latest:{' '}
              {templatesWithUpdate[0].latestVersion
                ? `v${templatesWithUpdate[0].latestVersion}`
                : '—'}
            </span>
            <button
              type="button"
              className="fixed-cells__btn-update"
              disabled={isApplying}
              onClick={handleUpdateAll}
            >
              {isApplying ? 'Updating...' : 'Update'}
            </button>
            <QuestionMarkTooltip
              tipID="fixed-cell-update-help"
              tipContent={UPDATE_HELP_TEXT}
            />
          </div>
        )}
      </div>
      {templates.length === 0 ? (
        <p>No fixed-cells available.</p>
      ) : (
        <div className="fixed-cells__list">
          {templates.map(template => (
            <TemplateItem
              key={template.name || template.id}
              template={template}
              selectedCellIds={selectedSet(template.name || template.id || '')}
              onTemplateToggle={handleTemplateToggle}
              onCellToggle={handleCellToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default FixedCells
