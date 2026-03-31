import React from 'react'
import {AlignType, ColumnInfo} from 'src/types'
import {TableLineChartPoint, TimeSeriesValue} from 'src/types/series'
import TableLineChartCell from 'src/dashboards/components/TableLineChartCell'
import {toLineValues} from 'src/dashboards/utils/tableLineChart'
import {LINE_COLOR_PALETTES_SEQUENCE} from 'src/shared/constants/graphColorPalettes'

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

const LATENCY_LINE_COLOR = LINE_COLOR_PALETTES_SEQUENCE[0][0].hex

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

export const urlMonitoringColumns = (): ColumnInfo[] => [
  {
    key: 'last_http_response_code',
    name: '현재 Status Code',
    align: AlignType.LEFT,
    options: {
      thead: {align: AlignType.LEFT, className: 'url-monitoring-status-th'},
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
            minWidth: 44,
            padding: '4px 8px',
            borderRadius: 4,
            backgroundColor: color,
            color: '#ffffff',
            fontWeight: 700,
            fontSize: 12,
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
    render: (value: LatencyCell) => (
      <TableLineChartCell
        color={LATENCY_LINE_COLOR}
        values={toLineValues(value)}
        options={{
          isShowLine: true,
          isShowPoint: false,
          isFillArea: true,
          isConnectSeparatedPoints: false,
          valueLabel: 'last',
          isZeroBaseline: true,
          areaOpacity: 0.1,
          pointRadius: 1,
        }}
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
        style={{display: 'flex', justifyContent: 'center', gap: 10}}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          className="btn btn-xs btn-default"
          title="Edit"
          onClick={e => {
            e.stopPropagation()
            void rowData
          }}
        >
          <span className="icon pencil" />
        </button>

        <button
          type="button"
          className="btn btn-xs btn-default"
          title="Copy"
          onClick={e => {
            e.stopPropagation()
            // TODO: 백엔드 연결 후 copy 로직 연결
          }}
        >
          <span className="icon duplicate" />
        </button>

        <button
          type="button"
          className="btn btn-xs btn-default"
          title="Delete"
          onClick={e => {
            e.stopPropagation()
            void rowData
          }}
        >
          <span className="icon trash" />
        </button>
      </div>
    ),
  },
]
