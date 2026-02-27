import React from 'react'
import {AlignType} from 'src/types'
import TableLineChartCell from 'src/dashboards/components/TableLineChartCell'
import {toLineValues} from 'src/dashboards/utils/tableLineChart'

export const lineChartTableColumn = [
  {
    key: 'host',
    name: '이름',
  },
  {
    key: 'CPU',
    name: 'CPU',
    option: {
      thead: {
        align: AlignType.CENTER,
      },
    },
    render: value => {
      return (
        <TableLineChartCell
          values={toLineValues(value)}
          options={{
            showLine: true,

            showPoint: false,
            fillArea: true,
            connectSeparatedPoints: true,
          }}
        />
      )
    },
  },
  {
    key: 'Memory',
    name: '메모리',
    option: {
      thead: {
        align: AlignType.CENTER,
      },
    },
    render: value => {
      return (
        <TableLineChartCell
          values={toLineValues(value)}
          options={{
            showLine: true,

            showPoint: false,
            fillArea: true,
            connectSeparatedPoints: true,
          }}
        />
      )
    },
  },
  {
    key: 'Process I/O',
    name: '프로세스 I/O',
    option: {
      thead: {
        align: AlignType.CENTER,
      },
    },
    render: value => {
      return (
        <TableLineChartCell
          values={toLineValues(value)}
          options={{
            showLine: true,

            showPoint: false,
            fillArea: true,
            connectSeparatedPoints: true,
          }}
        />
      )
    },
  },
  {
    key: 'Count',
    name: '개수',
    option: {
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
            showLine: true,

            showPoint: false,
            fillArea: true,
            connectSeparatedPoints: true,
          }}
        />
      )
    },
  },
]
export const serverListDummyLineQueries = [
  {
    id: 'server-list-dummy-line-cpu',
    text: `SELECT mean("usage_system") + mean("usage_user") AS "CPU"
  FROM "Default"."autogen"."cpu"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "cpu"='cpu-total'
  GROUP BY "host", time(:interval:)
  FILL(null)`,
  },
  {
    id: 'server-list-dummy-line-mem',
    text: `SELECT mean("used_percent") AS "Memory"
  FROM "Default"."autogen"."mem"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime:
  GROUP BY "host", time(:interval:)
  FILL(null)`,
  },
  {
    id: 'server-list-dummy-line-network',
    text: `SELECT max("traffic") AS "Process I/O"
  FROM (
    SELECT non_negative_derivative(max("bytes_recv"),1s) + non_negative_derivative(max("bytes_sent"),1s) AS "traffic"
    FROM "Default"."autogen"."net"
    WHERE time > :dashboardTime: AND time < :upperDashboardTime:
    GROUP BY "host", "interface", time(:interval:)
    FILL(null)
  )
  GROUP BY "host", time(:interval:)
  FILL(null)`,
  },
  {
    id: 'server-list-dummy-line-count',
    text: `SELECT count("usage_user") AS "Count"
  FROM "Default"."autogen"."cpu"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "cpu"='cpu-total'
  GROUP BY "host", time(:interval:)
  FILL(null)`,
  },
]
