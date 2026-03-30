import React from 'react'
import {AlignType} from 'src/types'
import TableLineChartCell from 'src/dashboards/components/TableLineChartCell'
import {toLineValues} from 'src/dashboards/utils/tableLineChart'
import {FORMAT_OPTIONS} from 'src/types/statisticalgraph'
import {ColumnInfo} from 'src/types'
import type {DataTableObject} from 'src/types/tableType'
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
    render: value => {
      return (
        <TableLineChartCell
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
          }}
        />
      )
    },
  },
]

export const serverDetailProcessQueries = [
  {
    id: 'server-list-line-cpu',
    text: `SELECT sum("cpu_usage_pct") AS "CPU"
  FROM ":db:".":rp:"."procstat_top"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:' AND "user"=~/:user:/
  GROUP BY "process_name", "user", time(:interval:)
  FILL(null)`,
  },
  {
    id: 'server-list-line-mem',
    text: `SELECT sum("memory_usage_pct") AS "Memory"
  FROM ":db:".":rp:"."procstat_top"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:' AND "user"=~/:user:/
  GROUP BY "process_name", "user", time(:interval:)
  FILL(null)`,
  },
  {
    id: 'server-list-line-network',
    text: `SELECT mean("io_read_bps") AS "mean_io_read_bps", mean("io_write_bps") AS "mean_io_write_bps", mean("io_total_bps") AS "Process I/O"
  FROM ":db:".":rp:"."procstat_top"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:' AND "process_name"=~/:process:/ AND "user"=~/:user:/
  GROUP BY "host", "process_name", "user", time(:interval:)
  FILL(null)`,
  },
  {
    id: 'server-list-line-count',
    text: `SELECT last("process_count") AS "Count"
  FROM ":db:".":rp:"."procstat_top"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:' AND "user"=~/:user:/
  GROUP BY "process_name", "user", time(:interval:)
  FILL(null)`,
  },
]
