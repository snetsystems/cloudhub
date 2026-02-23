import React, {useEffect, useState} from 'react'
import {
  getBuiltinDashboardList,
  getBuiltinDashboardTemplate,
  getTemplateDashboardByName,
  applyBuiltinDashboard,
} from 'src/dashboards/apis'
import {Dashboard, Cell} from 'src/types/dashboards'
import _ from 'lodash'
import classnames from 'classnames'
import QuestionMarkTooltip from 'src/shared/components/QuestionMarkTooltip'

interface BuiltinTemplatesProps {}

interface TemplateItemProps {
  template: Dashboard
}

interface TemplateCellItemProps {
  cell: Cell
}

const TemplateCellItem: React.FC<TemplateCellItemProps> = ({cell}) => {
  return (
    <div className="builtin-templates__cell-row">
      <div className="builtin-templates__cell-inner">
        <div className="fixedmodal-checkbox-wrapper">
          <input
            type="checkbox"
            id={`builtin-cell-${cell.i}`}
            onClick={e => e.stopPropagation()}
          />
          <label htmlFor={`builtin-cell-${cell.i}`} />
        </div>
        <span className="icon circle-thin" />
        <span className="builtin-templates__cell-name">
          {cell.name || 'Unnamed Cell'}
        </span>
        <span className="builtin-templates__cell-type">{cell.type || '—'}</span>
      </div>
    </div>
  )
}

const TemplateItem: React.FC<TemplateItemProps> = ({template}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  const hasCells = template.cells && template.cells.length > 0

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
        <div className="fixedmodal-checkbox-wrapper" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            id={`builtin-template-${template.name}-${template.id}`}
            onClick={e => e.stopPropagation()}
          />
          <label
            htmlFor={`builtin-template-${template.name}-${template.id}`}
            onClick={e => e.stopPropagation()}
          />
        </div>
        <div className="builtin-templates__caret-wrap">
          {hasCells && (
            <span
              className={classnames('icon', {
                'caret-down': isExpanded,
                'caret-right': !isExpanded,
              })}
            />
          )}
        </div>
        <div className="builtin-templates__tree-title">
          <div className="builtin-templates__tree-name">
            {template.name || 'Untitled Template'}
          </div>
          <div className="builtin-templates__tree-meta">
            Cells: {template.cells?.length || 0}
          </div>
        </div>
        <div
          className="builtin-templates__badges"
          onClick={e => e.stopPropagation()}
        >
          {template.recentlyUpdated && (
            <span
              className="builtin-templates__badge-recently"
              title="Template was applied within the last 30 days."
            >
              Recently updated
            </span>
          )}
        </div>
      </div>
      {hasCells && isExpanded && (
        <div className="dashboard-tree-children">
          {template.cells!.map(cell => (
            <TemplateCellItem key={cell.i} cell={cell} />
          ))}
        </div>
      )}
    </div>
  )
}

const UPDATE_HELP_TEXT =
  'When you run this update: Only cells of type "fixedCell" are changed. For those cells, only the query definitions (queries) are replaced from the latest template, matched by cell ID. Layout, names, and all other cell types remain unchanged. Template variables and version are updated to the latest.'

function BuiltinTemplates(_props: BuiltinTemplatesProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<Dashboard[]>([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [isApplying, setIsApplying] = useState(false)

  const refreshList = () => setRefreshTrigger(t => t + 1)

  const templatesWithUpdate = templates.filter(t => t.updateAvailable && t.name)
  const hasUpdateAvailable = templatesWithUpdate.length > 0

  const handleUpdateAll = async () => {
    if (!hasUpdateAvailable) return
    setIsApplying(true)
    try {
      for (const t of templatesWithUpdate) {
        await applyBuiltinDashboard(t.name!)
      }
      refreshList()
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
        const listRes = await getBuiltinDashboardList()
        const list = listRes.data?.templates ?? []
        if (cancelled) return
        if (list.length === 0) {
          setIsLoading(false)
          return
        }
        const [templateResults, orgResults] = await Promise.all([
          Promise.all(
            list.map(({name}) =>
              getBuiltinDashboardTemplate(name).then(r => r.data)
            )
          ),
          Promise.all(
            list.map(({name}) => getTemplateDashboardByName(name))
          ),
        ])
        if (cancelled) return
        const merged: Dashboard[] = templateResults.map((t, i) => {
          const org = orgResults[i]?.data
          const serverVersion = org?.latestVersion ?? t.version
          return {
            ...t,
            version: org?.version ?? undefined,
            latestVersion: serverVersion,
            updateAvailable: org?.updateAvailable,
            recentlyUpdated: org?.recentlyUpdated,
          }
        })
        setTemplates(_.sortBy(merged, d => d.name?.toLowerCase() ?? ''))
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load builtin templates')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [refreshTrigger])

  if (isLoading) {
    return (
      <div className="builtin-templates">
        <h2 className="builtin-templates__title">Builtin</h2>
        <p>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="builtin-templates">
        <h2 className="builtin-templates__title">Builtin</h2>
        <p className="builtin-templates__error">{error}</p>
      </div>
    )
  }

  return (
    <div className="builtin-templates">
      <div className="builtin-templates__header">
        <h2 className="builtin-templates__title">Builtin</h2>
        {hasUpdateAvailable && (
          <div className="builtin-templates__update-bar">
            <span className="builtin-templates__version-info">
              Current: {templatesWithUpdate[0].version ? `v${templatesWithUpdate[0].version}` : '—'} → Latest:{' '}
              {templatesWithUpdate[0].latestVersion ? `v${templatesWithUpdate[0].latestVersion}` : '—'}
            </span>
            <button
              type="button"
              className="builtin-templates__btn-update"
              disabled={isApplying}
              onClick={handleUpdateAll}
            >
              {isApplying ? 'Updating...' : 'Update'}
            </button>
            <QuestionMarkTooltip
              tipID="builtin-update-help"
              tipContent={UPDATE_HELP_TEXT}
            />
          </div>
        )}
      </div>
      {templates.length === 0 ? (
        <p>No builtin templates available.</p>
      ) : (
        <div className="builtin-templates__list">
          {templates.map(template => (
            <TemplateItem
              key={template.name || template.id}
              template={template}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default BuiltinTemplates
