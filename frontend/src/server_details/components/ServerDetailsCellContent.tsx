import React, {useState, useEffect, useContext, useMemo} from 'react'
import classnames from 'classnames'
import Layout from 'src/shared/components/Layout'
import type {RenderCellContext} from 'src/shared/components/LayoutRenderer'
import type {TemplateSelectionContextValue} from 'src/shared/components/DashboardPageWithImport'
import * as DashboardsModels from 'src/types/dashboards'
import {Addon} from 'src/types/auth'
import {getAgentDetails} from 'src/hosts/utils'
import {
  DEFAULT_TABLE_OPTIONS,
  DEFAULT_DECIMAL_PLACES,
} from 'src/dashboards/constants'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import MenuTooltipButton from 'src/shared/components/MenuTooltipButton'
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'

// --- Utilities ---

const isObject = (val: unknown): val is Record<string, unknown> =>
  typeof val === 'object' && val !== null && !Array.isArray(val)

function renderValue(value: unknown, depth: number): React.ReactNode {
  if (Array.isArray(value)) {
    const listClass = classnames('server-details-simple-data-list', {
      'server-details-simple-data-list--nested': depth > 0,
    })
    return (
      <ul className={listClass}>
        {value.map((item, index) => (
          <li key={index} className="server-details-simple-data-item">
            <span className="server-details-simple-data-value">
              {isObject(item)
                ? renderSimpleData(item, depth + 1)
                : String(item ?? '')}
            </span>
          </li>
        ))}
      </ul>
    )
  }
  if (isObject(value)) {
    return renderSimpleData(value, depth + 1)
  }
  return String(value ?? '')
}

function renderSimpleData(
  obj: Record<string, unknown> | unknown,
  depth = 0
): React.ReactNode {
  if (!isObject(obj)) {
    return <span>{String(obj ?? '')}</span>
  }

  const listClass = classnames('server-details-simple-data-list', {
    'server-details-simple-data-list--nested': depth > 0,
  })

  return (
    <ul className={listClass}>
      {Object.entries(obj).map(([key, value]) => (
        <li key={key} className="server-details-simple-data-item">
          <span className="server-details-simple-data-key">{key}:</span>
          <span className="server-details-simple-data-value">
            {renderValue(value, depth)}
          </span>
        </li>
      ))}
    </ul>
  )
}

// --- Components ---

function ServerInfoBody({
  selectedHost,
  addons,
}: {
  selectedHost: string | null
  addons?: Addon[]
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedHost || !addons?.length) {
      setData(null)
      return
    }

    const addon = addons.find(a => a.name === 'salt')
    const useProxy = addon?.url?.includes('proxy/salt')
    const hasAuth = addon?.url && (addon?.token || useProxy)

    if (!hasAuth) {
      setData(null)
      setError('Salt addon not configured')
      return
    }

    let isCancelled = false
    setLoading(true)
    setError(null)

    getAgentDetails(addon.url!, addon.token ?? '', selectedHost)
      .then(res => {
        if (!isCancelled && isObject(res)) {
          setData(res)
        }
      })
      .catch(err => {
        if (!isCancelled) {
          setError(err?.message ?? 'Failed to load server info')
        }
      })
      .finally(() => {
        if (!isCancelled) setLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [selectedHost, addons])

  if (loading)
    return <div className="server-details-cell-tab-body">Loading...</div>
  if (error)
    return <div className="server-details-cell-tab-body">Error: {error}</div>
  if (!selectedHost)
    return <div className="server-details-cell-tab-body">Select a host.</div>

  if (!data || Object.keys(data).length === 0) {
    return <div className="server-details-cell-tab-body">No data.</div>
  }

  return (
    <div className="server-details-cell-tab-body">
      {Object.entries(data).map(([sectionName, section]) => {
        const displayData =
          isObject(section) && 'data' in section
            ? (section.data as Record<string, unknown>)
            : (section as Record<string, unknown>)

        return (
          <div key={sectionName} className="server-details-server-info-section">
            <div className="server-details-server-info-section-title">
              {sectionName}
            </div>
            {renderSimpleData(displayData)}
          </div>
        )
      })}
    </div>
  )
}

// --- Context & Main Content ---

export type ServerDetailsPageContextValue = TemplateSelectionContextValue & {
  selectedHost: string | null
  onHostSelect: (host: string | null) => void
}

export const ServerDetailsPageContext = React.createContext<ServerDetailsPageContextValue | null>(
  null
)

export function ServerDetailsCellContent({
  addons,
  cell,
  layoutContext,
}: {
  addons?: Addon[]
  cell?: DashboardsModels.Cell
  layoutContext?: RenderCellContext
}) {
  const ctx = useContext(ServerDetailsPageContext)
  const selectedHost = ctx?.selectedHost ?? null
  const [activeTab, setActiveTab] = useState<'info' | 'files'>('info')
  const [contextOpen, setContextOpen] = useState(false)

  const canUseLayout = !!(cell && layoutContext)

  const effectiveCell = useMemo(() => {
    if (!canUseLayout || !cell) return null

    return {
      ...cell,
      name: '',
      type: DashboardsModels.CellType.Table,
      tableOptions: {
        ...DEFAULT_TABLE_OPTIONS,
        ...cell.tableOptions,
        verticalTimeAxis: true,
      } as DashboardsModels.TableOptions,
      decimalPlaces: DEFAULT_DECIMAL_PLACES,
      fieldOptions: [
        {internalName: 'time', displayName: 'time', visible: false},
        {internalName: 'path', displayName: 'Mount Point', visible: true},
        {
          internalName: 'disk.total_gib',
          displayName: 'Total (GiB)',
          visible: true,
        },
        {
          internalName: 'disk.used_gib',
          displayName: 'Used (GiB)',
          visible: true,
        },
        {
          internalName: 'disk.used_percent',
          displayName: 'Used(%)',
          visible: true,
        },
        {
          internalName: 'disk.inode_used_percent',
          displayName: 'i-node Used(%)',
          visible: true,
        },
        {
          internalName: 'disk.free_gib',
          displayName: 'Free(GiB)',
          visible: true,
        },
      ] as DashboardsModels.FieldOption[],
      queries: cell.queries?.length
        ? cell.queries
        : [
            {
              ...(cell.queries?.[0] || {}),
              query:
                'SELECT last("total")/1073741824 AS "total_gib", last("used")/1073741824 AS "used_gib", last("free")/1073741824 AS "free_gib", last("used_percent") AS "used_percent", last("inodes_used_percent") AS "inode_used_percent" FROM ":db:".":rp:"."disk" WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=:host: GROUP BY "path"',
            } as DashboardsModels.CellQuery,
          ],
      inView: true,
    }
  }, [cell, canUseLayout])


  return (
    <div className="server-details-cell-content">
      <div className="dash-graph--draggable dash-graph--heading dash-graph--heading-draggable server-details-cell-header">
        <div
          className="server-details-cell-tab-buttons"
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            type="button"
            className={classnames({active: activeTab === 'info'})}
            onClick={e => {
              e.stopPropagation()
              setActiveTab('info')
            }}
          >
            Server Info
          </button>
          <button
            type="button"
            className={classnames({active: activeTab === 'files'})}
            onClick={e => {
              e.stopPropagation()
              setActiveTab('files')
            }}
          >
            File System
          </button>
        </div>
        <div className="server-details-cell-drag-handle">
          <div className="dash-graph--heading-bar" />
          <div className="dash-graph--heading-dragger" />
        </div>
      </div>

      {layoutContext?.onDeleteCell && cell && (
        <div
          className={classnames('dash-graph-context', {
            'dash-graph-context__open': contextOpen,
          })}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="dash-graph-context--buttons">
            <Authorized requiredRole={EDITOR_ROLE}>
              <MenuTooltipButton
                icon="trash"
                theme="danger"
                menuItems={[
                  {
                    text: 'Confirm',
                    action: () => layoutContext.onDeleteCell!(cell),
                    disabled: false,
                  },
                ]}
                informParent={() => setContextOpen(prev => !prev)}
              />
            </Authorized>
          </div>
        </div>
      )}

      <div className="server-details-cell-tabs">
        <div className="server-details-cell-tab-panel" key={activeTab}>
          <FancyScrollbar
            className="server-details-cell-tab-panel__scroll"
            style={{height: '100%'}}
            autoHide={false}
          >
            {activeTab === 'info' ? (
              <ServerInfoBody selectedHost={selectedHost} addons={addons} />
            ) : (
              <div className="server-details-cell-tab-body server-details-cell-files-layout-wrap">
                {effectiveCell && layoutContext ? (
                  <Layout
                    cell={effectiveCell}
                    timeRange={layoutContext.timeRange}
                    templates={layoutContext.templates}
                    source={layoutContext.source}
                    sources={layoutContext.sources}
                    host={layoutContext.host}
                    isEditable={false}
                    manualRefresh={layoutContext.manualRefresh}
                    onZoom={() => {}}
                    onDeleteCell={layoutContext.onDeleteCell ?? (() => {})}
                    onCloneCell={layoutContext.onCloneCell ?? (() => {})}
                    onSummonOverlayTechnologies={
                      layoutContext.onSummonOverlayTechnologies ?? (() => {})
                    }
                    instance={layoutContext.instance}
                    onPickTemplate={layoutContext.onPickTemplate}
                  />
                ) : (
                  'No data.'
                )}
              </div>
            )}
          </FancyScrollbar>
        </div>
      </div>
    </div>
  )
}
