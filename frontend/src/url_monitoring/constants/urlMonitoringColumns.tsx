import React from 'react'
import {AlignType, ColumnInfo, DataTableObject} from 'src/types'
import {TableLineChartPoint, TimeSeriesValue} from 'src/types/series'
import ConfirmButton from 'src/shared/components/ConfirmButton'
import {URLMonitoringLatencyCell} from 'src/url_monitoring/components/URLMonitoringLatencyCell'

type LatencyCell =
  | TimeSeriesValue
  | TimeSeriesValue[]
  | TableLineChartPoint[]
  | null
  | undefined

type StatusCodeCell =
  | TimeSeriesValue
  | TimeSeriesValue[]
  | TableLineChartPoint[]
  | null
  | undefined

/** Shown when last_http_response_code is missing (e.g. not returned from Influx) */
const MISSING_HTTP_STATUS_LABEL = 'No code'
const MISSING_HTTP_STATUS_TITLE =
  'No HTTP status code in recent data. Check your query and collection settings.'

const getStatusColor = (statusCode: number | null) => {
  if (statusCode === null) return '#6b7280'
  if (statusCode >= 200 && statusCode < 300) return '#4ed8a0'
  if (statusCode >= 300 && statusCode < 400) return '#63b3ff'
  // Same red tone for 4xx / 5xx
  if (statusCode >= 400) return '#ff4d4f'
  return '#6b7280'
}

const toNumber = (value: StatusCodeCell): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export interface UrlMonitoringColumnHandlers {
  onEditRow?: (row: DataTableObject) => void
  onCopyRow?: (row: DataTableObject) => void
  onDeleteRow?: (row: DataTableObject) => void
  onLatencyChartClick?: (row: DataTableObject) => void
}

export const urlMonitoringColumns = (
  handlers?: UrlMonitoringColumnHandlers
): ColumnInfo[] => [
  {
    key: 'last_http_response_code',
    name: 'Status code',
    align: AlignType.CENTER,
    options: {
      thead: {align: AlignType.CENTER, className: 'url-monitoring-status-th'},
    },
    render: (value: StatusCodeCell) => {
      const code = toNumber(value)
      const color = getStatusColor(code)
      return (
        <div
          className="url-monitoring-status-badge"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 72,
            height: 30,
            padding: '0 12px',
            borderRadius: 6,
            backgroundColor: color,
            color: '#ffffff',
            fontWeight: 800,
            fontSize: 14,
          }}
          title={code === null ? MISSING_HTTP_STATUS_TITLE : String(code)}
        >
          {code ?? MISSING_HTTP_STATUS_LABEL}
        </div>
      )
    },
  },
  {
    key: 'url',
    name: 'Request / URL',
    align: AlignType.LEFT,
    options: {
      thead: {align: AlignType.LEFT, className: 'url-monitoring-url-th'},
    },
    render: (value: unknown, rowData: any) => {
      const url = String(value ?? '')
      const name = String(rowData?.name ?? '')
      return (
        <div style={{maxWidth: 300}}>
          {name && (
            <div style={{fontWeight: 600, marginBottom: 2}}>{name}</div>
          )}
          <div
            style={{
              wordBreak: 'break-all',
              color: name ? '#aab0bb' : undefined,
              fontSize: name ? 12 : undefined,
            }}
            title={url}
          >
            {url || '--'}
          </div>
        </div>
      )
    },
  },
  {
    key: 'response_time_ms',
    name: 'Avg. response time (ms)',
    align: AlignType.RIGHT,
    options: {
      thead: {align: AlignType.RIGHT},
      sorting: true,
    },
    render: (value: LatencyCell, rowData, _colIdx, rowIndex, tz) => (
      <URLMonitoringLatencyCell
        value={value}
        rowData={rowData as DataTableObject}
        rowIndex={rowIndex}
        timeZone={tz}
        onChartClick={
          handlers?.onLatencyChartClick
            ? () =>
                handlers.onLatencyChartClick?.(rowData as DataTableObject)
            : undefined
        }
      />
    ),
  },
  {
    key: '__actions__',
    name: '',
    align: AlignType.CENTER,
    options: {
      thead: {align: AlignType.CENTER, className: 'url-monitoring-actions-th'},
    },
    render: (_value: unknown, rowData: any) => (
      <div
        className="url-monitoring-row-actions"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          className="btn btn-xs btn-default url-monitoring-row-actions__btn"
          title="Edit"
          onClick={e => {
            e.stopPropagation()
            handlers?.onEditRow?.(rowData as DataTableObject)
          }}
        >
          <span className="icon pencil" aria-hidden />
        </button>
        <button
          type="button"
          className="btn btn-xs btn-default url-monitoring-row-actions__btn"
          title="Copy"
          onClick={e => {
            e.stopPropagation()
            handlers?.onCopyRow?.(rowData as DataTableObject)
          }}
        >
          <span className="icon duplicate" aria-hidden />
        </button>
        <ConfirmButton
          type="btn-default"
          size="btn-xs"
          square={true}
          icon="trash"
          isEventStopPropagation={true}
          confirmText="Confirm"
          confirmAction={() =>
            handlers?.onDeleteRow?.(rowData as DataTableObject)
          }
          customClass="url-monitoring-row-actions__btn"
        />
      </div>
    ),
  },
]
