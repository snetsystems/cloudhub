import React from 'react'
import {AlignType} from 'src/types'
import TableLineChartCell from 'src/dashboards/components/TableLineChartCell'
import {toLineValues} from 'src/dashboards/utils/tableLineChart'
import {FORMAT_OPTIONS} from 'src/types/statisticalgraph'
import {ColumnInfo} from 'src/types'
import type {DataTableObject} from 'src/types/tableType'
import {TableLineChartPoint} from 'src/types/series'
import {LINE_COLOR_PALETTES_SEQUENCE} from 'src/shared/constants/graphColorPalettes'

const PROCESS_LIST_LINE_HEX_BY_KEY = {
  CPU: LINE_COLOR_PALETTES_SEQUENCE[0][0].hex,
  Memory: LINE_COLOR_PALETTES_SEQUENCE[1][0].hex,
  'Process I/O': LINE_COLOR_PALETTES_SEQUENCE[2][0].hex,
  Count: LINE_COLOR_PALETTES_SEQUENCE[3][0].hex,
} as const

const IEC_LABELS = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB']

const formatBytesIEC = (bytes: number, decimalPlaces = 1): string => {
  if (!Number.isFinite(bytes) || bytes === 0) return '0 B'
  const absBytes = Math.abs(bytes)
  let divisor = 1
  let unitIndex = -1
  for (let i = 0; i < IEC_LABELS.length; i++) {
    if (absBytes < divisor * 1024) break
    divisor *= 1024
    unitIndex = i
  }
  if (unitIndex === -1) return `${bytes.toFixed(decimalPlaces)} B`
  return `${(bytes / divisor).toFixed(decimalPlaces)} ${IEC_LABELS[unitIndex]}`
}
export const lineChartTableColumn: ColumnInfo[] = [
  {
    key: 'process_name',
    name: '이름',
    options: {
      sorting: true,
    },
    render: (value: unknown, rowData: DataTableObject) => {
      const processName = String(value ?? '')
      const user = (rowData?.user as string) ?? ''
      if (!user) return processName
      return (
        <span className="process-name-with-user">
          <span className="process-name-with-user__name">{processName}</span>
          <span className="process-name-with-user__user">{user}</span>
        </span>
      )
    },
  },
  {
    key: 'CPU',
    name: 'CPU',
    options: {
      sorting: true,
      sortArrayBy: 'max',
      thead: {
        align: AlignType.CENTER,
      },
    },
    render: value => {
      return (
        <TableLineChartCell
          color={PROCESS_LIST_LINE_HEX_BY_KEY.CPU}
          values={toLineValues(value)}
          options={{
            isShowLine: true,
            isShowPoint: false,
            isFillArea: true,
            isConnectSeparatedPoints: false,
            valueLabel: 'maximum',
            isZeroBaseline: true,
            areaOpacity: 0.1,
            pointRadius: 1,
            suffix: '%',
          }}
        />
      )
    },
  },
  {
    key: 'Memory',
    name: '메모리',
    options: {
      sorting: true,
      sortArrayBy: 'max',
      thead: {
        align: AlignType.CENTER,
      },
    },
    render: (value, rowData) => {
      const rssRaw = rowData?.RSS
      let maxRss: number | null = null
      if (Array.isArray(rssRaw)) {
        const points = rssRaw as TableLineChartPoint[]
        for (const p of points) {
          const v =
            typeof p?.value === 'number'
              ? p.value
              : typeof p === 'number'
              ? ((p as unknown) as number)
              : null
          if (
            v !== null &&
            Number.isFinite(v) &&
            (maxRss === null || v > maxRss)
          ) {
            maxRss = v
          }
        }
      } else if (typeof rssRaw === 'number' && Number.isFinite(rssRaw)) {
        maxRss = rssRaw
      }
      const extraLabel = maxRss !== null ? formatBytesIEC(maxRss) : null
      return (
        <TableLineChartCell
          color={PROCESS_LIST_LINE_HEX_BY_KEY.Memory}
          values={toLineValues(value)}
          options={{
            isShowLine: true,
            isShowPoint: false,
            isFillArea: true,
            isConnectSeparatedPoints: false,
            valueLabel: 'maximum',
            isZeroBaseline: true,
            areaOpacity: 0.1,
            pointRadius: 1,
            suffix: '%',
            extraLabel: extraLabel ?? undefined,
          }}
        />
      )
    },
  },
  {
    key: 'Process I/O',
    name: '프로세스 I/O',
    options: {
      sorting: true,
      sortArrayBy: 'max',
      thead: {
        align: AlignType.CENTER,
      },
    },
    render: value => {
      return (
        <TableLineChartCell
          color={PROCESS_LIST_LINE_HEX_BY_KEY['Process I/O']}
          values={toLineValues(value)}
          options={{
            isShowLine: true,
            isShowPoint: false,
            isFillArea: true,
            isConnectSeparatedPoints: false,
            valueLabel: 'maximum',
            isZeroBaseline: true,
            areaOpacity: 0.1,
            pointRadius: 1,
            decimalPlaces: 2,
            valueFormat: FORMAT_OPTIONS.KMG,
            suffix: 'bps',
          }}
        />
      )
    },
  },
  {
    key: 'Count',
    name: '개수',
    options: {
      sorting: true,
      sortArrayBy: 'max',
      thead: {
        align: AlignType.CENTER,
      },
    },
    render: value => {
      return (
        <TableLineChartCell
          color={PROCESS_LIST_LINE_HEX_BY_KEY.Count}
          values={toLineValues(value)}
          strokeWidth={0.5}
          options={{
            isShowLine: true,
            isShowPoint: false,
            isFillArea: true,
            isConnectSeparatedPoints: false,
            valueLabel: 'maximum',
            isZeroBaseline: true,
            areaOpacity: 0.1,
            pointRadius: 1,
            decimalPlaces: 0,
            suffix: 'ea',
          }}
        />
      )
    },
  },
]

export const serverDetailProcessQueries = [
  {
    id: 'server-list-line-cpu',
    text: `SELECT mean("cpu_usage_pct") AS "CPU"
  FROM ":db:".":rp:"."procstat_top"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
  GROUP BY "process_name", "user", time(:interval:)
  FILL(null)`,
  },
  {
    id: 'server-list-line-mem',
    text: `SELECT mean("memory_usage_pct") AS "Memory", mean("memory_rss_bytes") AS "RSS"
  FROM ":db:".":rp:"."procstat_top"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
  GROUP BY "process_name", "user", time(:interval:)
  FILL(null)`,
  },
  {
    id: 'server-list-line-network',
    text: `SELECT mean("io_read_bps") AS "mean_io_read_bps", mean("io_write_bps") AS "mean_io_write_bps", mean("io_total_bps") AS "Process I/O"
  FROM ":db:".":rp:"."procstat_top"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:' AND "process_name"=~/:process:/
  GROUP BY "host", "process_name", "user", time(:interval:)
  FILL(null)`,
  },
  {
    id: 'server-list-line-count',
    text: `SELECT last("process_count") AS "Count"
  FROM ":db:".":rp:"."procstat_top"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
  GROUP BY "process_name", "user", time(:interval:)
  FILL(null)`,
  },
]
