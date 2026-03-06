import React, {useState, useEffect, useContext} from 'react'
import _ from 'lodash'
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

function renderSimpleData(
  obj: Record<string, unknown>,
  depth = 0
): React.ReactNode {
  if (obj == null || typeof obj !== 'object') {
    return <span>{String(obj)}</span>
  }
  return (
    <ul
      className={`server-details-simple-data-list${depth ? ' server-details-simple-data-list--nested' : ''}`}
    >
      {_.toPairs(obj).map(([k, v]) => (
        <li key={k} className="server-details-simple-data-item">
          <span className="server-details-simple-data-key">{k}:</span>
          <span className="server-details-simple-data-value">
            {typeof v === 'object' && v !== null && !Array.isArray(v)
              ? renderSimpleData(v as Record<string, unknown>, depth + 1)
              : Array.isArray(v)
              ? String(v)
              : String(v ?? '')}
          </span>
        </li>
      ))}
    </ul>
  )
}

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

    let cancelled = false
    setLoading(true)
    setError(null)
    getAgentDetails(addon.url, addon?.token ?? '', selectedHost)
      .then(res => {
        if (!cancelled && res && typeof res === 'object') {
          setData(res as Record<string, unknown>)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err?.message ?? 'Failed to load server info')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedHost, addons])

  if (loading) {
    return (
      <div className="server-details-cell-tab-body">
        Loading...
      </div>
    )
  }
  if (error) {
    return (
      <div className="server-details-cell-tab-body">
        Error: {error}
      </div>
    )
  }
  if (!selectedHost) {
    return (
      <div className="server-details-cell-tab-body">
        Select a host.
      </div>
    )
  }
  if (!data || _.isEmpty(data)) {
    return (
      <div className="server-details-cell-tab-body">
        No data.
      </div>
    )
  }

  return (
    <div className="server-details-cell-tab-body">
      {_.toPairs(data).map(([sectionName, section]) => (
        <div key={sectionName} className="server-details-server-info-section">
          <div className="server-details-server-info-section-title">
            {sectionName}
          </div>
          {section && typeof section === 'object' && 'data' in section
            ? renderSimpleData((section as {data: Record<string, unknown>}).data)
            : renderSimpleData(section as Record<string, unknown>)}
        </div>
      ))}
    </div>
  )
}

export type ServerDetailsPageContextValue = TemplateSelectionContextValue & {
  selectedHost: string | null
  onHostSelect: (host: string | null) => void
}

export const ServerDetailsPageContext =
  React.createContext<ServerDetailsPageContextValue | null>(null)

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

  const canUseLayout = cell != null && layoutContext != null

  const effectiveCell =
    canUseLayout && cell
      ? {
          ...cell,
          name: '',
          type: DashboardsModels.CellType.Table,
          tableOptions: {
            ...DEFAULT_TABLE_OPTIONS,
            ...(cell.tableOptions ?? {}),
            verticalTimeAxis: true,
          } as DashboardsModels.TableOptions,
          decimalPlaces: DEFAULT_DECIMAL_PLACES,
          fieldOptions: [
            {internalName: 'time', displayName: 'time', visible: false},
            {internalName: 'path', displayName: 'Mount Point', visible: true},
            {
              internalName: 'disk.total_gib',
              displayName: 'Total Space (GiB)',
              visible: true,
            },
            {
              internalName: 'disk.used_gib',
              displayName: 'Used Space (GiB)',
              visible: true,
            },
            {internalName: 'disk.used_percent', displayName: 'Used(%)', visible: true},
            {
              internalName: 'disk.inode_used_percent',
              displayName: 'i-node Used(%)',
              visible: true,
            },
            {internalName: 'disk.free_gib', displayName: 'Free(GiB)', visible: true},
          ] as DashboardsModels.FieldOption[],
          queries:
            cell.queries && cell.queries.length > 0
              ? cell.queries
              : [
                  {
                    ...(cell.queries && cell.queries[0]
                      ? cell.queries[0]
                      : ({} as DashboardsModels.CellQuery)),
                    query:
                      'SELECT last("total")/1073741824 AS "total_gib", last("used")/1073741824 AS "used_gib", last("free")/1073741824 AS "free_gib", last("used_percent") AS "used_percent", last("inodes_used_percent") AS "inode_used_percent" FROM ":db:".":rp:"."disk" WHERE time > :dashboardTime: AND "host"=:host: GROUP BY "path"',
                  },
                ],
          inView: true,
        }
      : null

  return (
    <div className="server-details-cell-content">
      <div className="dash-graph--draggable dash-graph--heading dash-graph--heading-draggable server-details-cell-header">
        <div
          className="server-details-cell-tab-buttons"
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            type="button"
            className={activeTab === 'info' ? 'active' : ''}
            onClick={e => {
              e.stopPropagation()
              setActiveTab('info')
            }}
          >
            Server Info
          </button>
          <button
            type="button"
            className={activeTab === 'files' ? 'active' : ''}
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
      <div className="server-details-cell-tabs">
        <div className="server-details-cell-tab-panel" key={activeTab}>
          <FancyScrollbar
            className="server-details-cell-tab-panel__scroll"
            style={{height: '100%'}}
            autoHide={false}
          >
            {activeTab === 'info' && (
              <ServerInfoBody selectedHost={selectedHost} addons={addons} />
            )}
            {activeTab === 'files' && (
              <>
                {effectiveCell && layoutContext ? (
                  <div className="server-details-cell-tab-body server-details-cell-files-layout-wrap">
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
                </div>
              ) : (
                  <div className="server-details-cell-tab-body">
                    No data.
                  </div>
                )}
              </>
            )}
          </FancyScrollbar>
        </div>
      </div>
    </div>
  )
}
