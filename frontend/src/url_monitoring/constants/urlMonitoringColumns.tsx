import React from 'react'
import {AlignType, ColumnInfo, DataTableObject} from 'src/types'
import {TableLineChartPoint, TimeSeriesValue} from 'src/types/series'
import {UrlMonitoringLatencyCell} from 'src/url_monitoring/components/UrlMonitoringLatencyCell'

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

const getStatusColor = (statusCode: number | null) => {
  if (statusCode === null) return '#6b7280'
  if (statusCode >= 200 && statusCode < 300) return '#4ed8a0'
  if (statusCode >= 300 && statusCode < 400) return '#63b3ff'
  // 빨간 계열(4xx/5xx) 동일 컬러
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
}

export const urlMonitoringColumns = (
  handlers?: UrlMonitoringColumnHandlers
): ColumnInfo[] => [
  {
    key: 'last_http_response_code',
    name: '현재 Status Code',
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
          title={code === null ? 'N/A' : String(code)}
        >
          {code ?? '--'}
        </div>
      )
    },
  },
  {
    key: 'url',
    name: '요청/URL',
    align: AlignType.LEFT,
    options: {
      thead: {align: AlignType.LEFT, className: 'url-monitoring-url-th'},
    },
    render: (value: unknown) => {
      const text = String(value ?? '')
      return (
        <div
          style={{
            maxWidth: 280,
            whiteSpace: 'pre-line',
            wordBreak: 'break-all',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={text}
        >
          {text || '--'}
        </div>
      )
    },
  },
  {
    key: 'region',
    name: '지원',
    align: AlignType.LEFT,
    options: {
      thead: {align: AlignType.LEFT, className: 'url-monitoring-region-th'},
    },
    render: (value: unknown) => <>{value ?? '--'}</>,
  },
  {
    key: 'response_time_ms',
    name: '평균 응답시간',
    align: AlignType.RIGHT,
    options: {
      thead: {align: AlignType.RIGHT},
      sorting: true,
    },
    render: (value: LatencyCell, rowData, _colIdx, rowIndex, tz) => (
      <UrlMonitoringLatencyCell
        value={value}
        rowData={rowData as DataTableObject}
        rowIndex={rowIndex}
        timeZone={tz}
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
          title="수정"
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
          title="복사"
          onClick={e => {
            e.stopPropagation()
            handlers?.onCopyRow?.(rowData as DataTableObject)
          }}
        >
          <span className="icon duplicate" aria-hidden />
        </button>
        <button
          type="button"
          className="btn btn-xs btn-default url-monitoring-row-actions__btn"
          title="삭제"
          onClick={e => {
            e.stopPropagation()
            void rowData
          }}
        >
          <span className="icon trash" aria-hidden />
        </button>
      </div>
    ),
  },
]
