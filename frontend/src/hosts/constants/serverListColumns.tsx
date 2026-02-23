import React from 'react'
import {AlignType, ColumnInfo} from 'src/types'
import {
  BACKGROUND_TYPE_MODES,
  CHART_TYPE_MODES,
  FORMAT_OPTIONS,
} from 'src/types/statisticalgraph'

import {
  LINE_COLORS_I,
  LINE_COLORS_E,
} from 'src/shared/constants/graphColorPalettes'
import {Link} from 'react-router'
import TableGaugeCell from 'src/dashboards/components/TableGaugeCell'

export interface ServerListQuery {
  id: string
  text: string
}

interface Props {
  sourceID: string
}

export const serverListColumns = ({sourceID}: Props): ColumnInfo[] => [
  {
    key: 'host',
    name: '서버 호스트',
    align: AlignType.LEFT,
    render: (value: string) => {
      return (
        <Link
          to={`/sources/${sourceID}/server-monitoring/server-details?host=${value}`}
        >
          {value}
        </Link>
      )
    },
  },
  {
    key: 'CPU Usage',
    name: 'CPU Usage',
    options: {
      thead: {
        align: AlignType.RIGHT,
      },
      sorting: true,
    },
    render: (value: number) => {
      const gaugeOptions = {
        min: 0,
        max: 100,
        colors: LINE_COLORS_I,
        chartType: CHART_TYPE_MODES.SEGMENTED,
        backgroundType: BACKGROUND_TYPE_MODES.GRADIENT,
        isPercent: true,
        isShowValues: true,
        isGauge: true,
        decimalPlaces: 0,
      }
      return <TableGaugeCell options={gaugeOptions} value={value} />
    },
  },
  {
    key: 'Mem Total',
    name: 'Mem Total',
    align: AlignType.RIGHT,
    options: {
      sorting: true,
      thead: {
        align: AlignType.RIGHT,
      },
      isGauge: true,
    },
    render: (value: number) => {
      const gaugeOptions = {
        min: 0,
        max: 0,
        colors: LINE_COLORS_E,
        chartType: CHART_TYPE_MODES.SEGMENTED,
        backgroundType: BACKGROUND_TYPE_MODES.GRADIENT,
        isPercent: false,
        isShowValues: true,
        isGauge: false,
        valueFormat: FORMAT_OPTIONS.KMG,
        decimalPlaces: 0,
      }
      return <TableGaugeCell options={gaugeOptions} value={value} />
    },
  },
  {
    key: 'Mem Usage',
    name: 'Mem Usage',
    align: AlignType.RIGHT,
    options: {
      thead: {
        align: AlignType.RIGHT,
      },
      isGauge: true,
      sorting: true,
    },
    render: (value: number) => {
      const gaugeOptions = {
        min: 0,
        max: 100,
        colors: LINE_COLORS_I,
        chartType: CHART_TYPE_MODES.SEGMENTED,
        backgroundType: BACKGROUND_TYPE_MODES.GRADIENT,
        isPercent: true,
        isShowValues: true,
        isGauge: true,
        decimalPlaces: 0,
      }
      return <TableGaugeCell options={gaugeOptions} value={value} />
    },
  },
  {
    key: 'Mem Used',
    name: 'Mem Used',
    align: AlignType.RIGHT,
    options: {
      thead: {
        align: AlignType.RIGHT,
      },
      isGauge: true,
      sorting: true,
    },
    render: (value: number) => {
      const gaugeOptions = {
        min: 0,
        max: 100,
        colors: LINE_COLORS_I,
        chartType: CHART_TYPE_MODES.SEGMENTED,
        backgroundType: BACKGROUND_TYPE_MODES.GRADIENT,
        isPercent: false,
        isShowValues: true,
        isGauge: false,
        valueFormat: FORMAT_OPTIONS.KMG,
        decimalPlaces: 0,
      }
      return <TableGaugeCell options={gaugeOptions} value={value} />
    },
  },
  {
    key: 'Mem Cached',
    name: 'Mem Cached',
    align: AlignType.RIGHT,
    options: {
      thead: {
        align: AlignType.RIGHT,
      },
      isGauge: true,
      sorting: true,
    },
    render: (value: number) => {
      const gaugeOptions = {
        min: 0,
        max: 100,
        colors: LINE_COLORS_I,
        chartType: CHART_TYPE_MODES.SEGMENTED,
        backgroundType: BACKGROUND_TYPE_MODES.GRADIENT,
        isPercent: false,
        isShowValues: true,
        isGauge: false,
        valueFormat: FORMAT_OPTIONS.KMG,
        decimalPlaces: 0,
      }
      return <TableGaugeCell options={gaugeOptions} value={value} />
    },
  },
  {
    key: 'Network Traffic',
    name: 'Network Traffic (Max)',
    align: AlignType.RIGHT,
    options: {
      thead: {
        align: AlignType.RIGHT,
      },
      isGauge: true,
      sorting: true,
    },
    render: (value: number) => {
      const gaugeOptions = {
        min: 0,
        max: 1000000000,
        colors: LINE_COLORS_I,
        chartType: CHART_TYPE_MODES.CONTINUOUS,
        backgroundType: BACKGROUND_TYPE_MODES.GRADIENT,
        isPercent: false,
        isShowValues: true,
        isGauge: true,
        valueFormat: FORMAT_OPTIONS.KMG,
        decimalPlaces: 0,
      }
      return <TableGaugeCell options={gaugeOptions} value={value} />
    },
  },
  {
    key: 'Network Interface',
    name: 'Network Interface',
    align: AlignType.LEFT,
  },
  {
    key: 'Disk Usage',
    name: 'Disk Usage',
    align: AlignType.RIGHT,
    options: {
      thead: {
        align: AlignType.RIGHT,
      },
      isGauge: true,
      sorting: true,
    },
    render: (value: number) => {
      const gaugeOptions = {
        min: 0,
        max: 100,
        colors: LINE_COLORS_I,
        chartType: CHART_TYPE_MODES.SEGMENTED,
        backgroundType: BACKGROUND_TYPE_MODES.GRADIENT,
        isPercent: true,
        isShowValues: true,
        isGauge: true,
        decimalPlaces: 0,
      }
      return <TableGaugeCell options={gaugeOptions} value={value} />
    },
  },
  {key: 'Path', name: 'Path', align: AlignType.LEFT},
  {
    key: 'Disk I/O %',
    name: 'Disk I/O % (Max)',
    align: AlignType.RIGHT,
    options: {
      thead: {
        align: AlignType.RIGHT,
      },
      isGauge: true,
      sorting: true,
    },
    render: (value: number) => {
      const gaugeOptions = {
        min: 0,
        max: 100,
        colors: LINE_COLORS_I,
        chartType: CHART_TYPE_MODES.SEGMENTED,
        backgroundType: BACKGROUND_TYPE_MODES.GRADIENT,
        isPercent: true,
        isShowValues: true,
        isGauge: true,
        decimalPlaces: 0,
      }
      return <TableGaugeCell options={gaugeOptions} value={value} />
    },
  },
  {key: 'Device', name: 'Device', align: AlignType.LEFT},
]

export const serverListQueries: ServerListQuery[] = [
  {
    id: 'server-list-cpu',
    text: `SELECT last("usage_system") + last("usage_user") AS "CPU Usage",
last("usage_idle") AS "CPU Idle",
last("usage_guest") AS "CPU Guest",
last("usage_irq") AS "CPU IRQ",
last("usage_nice") AS "CPU Nice",
last("usage_steal") AS "CPU Steal",
last("usage_softirq") AS "CPU SoftIRQ",
last("usage_guest_nice") AS "CPU Guest Nice",
last("usage_iowait") AS "CPU IOWait"
FROM "Default"."autogen"."cpu"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "cpu"='cpu-total'
GROUP BY "host"
FILL(null)`,
  },
  {
    id: 'server-list-mem',
    text: `SELECT last("used_percent") AS "Mem Usage",
last("total") AS "Mem Total",
last("used") AS "Mem Used",
last("free") AS "Mem Free",
last("shared") AS "Mem Shared",
last("buffered") AS "Mem Buffered",
last("cached") AS "Mem Cached",
last("available") AS "Mem Available"
FROM "Default"."autogen"."mem"
WHERE time > :dashboardTime: AND time < :upperDashboardTime:
GROUP BY "host"
FILL(null)`,
  },
  {
    id: 'server-list-network',
    text: `SELECT "interface" AS "Network Interface", max("traffic") AS "Network Traffic"
FROM (
  SELECT non_negative_derivative(max("bytes_recv"),1s) + non_negative_derivative(max("bytes_sent"),1s) AS "traffic"
  FROM "Default"."autogen"."net"
  WHERE time > now() - 3m
  GROUP BY time(:interval:), "interface"
  LIMIT 1
)
GROUP BY "host"`,
  },
  {
    id: 'server-list-disk-usage',
    text: `SELECT "path" AS "Path", max("Disk Usage") AS "Disk Usage"
FROM (
  SELECT last("used_percent") AS "Disk Usage"
  FROM "Default"."autogen"."disk"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND path !~ /^\\/boot/ AND path !~ /^\\/run/
  GROUP BY "path"
)
GROUP BY "host"`,
  },
  {
    id: 'server-list-disk-io',
    text: `SELECT "name" AS "Device", max("io_time") AS "Disk I/O %"
FROM (
  SELECT non_negative_derivative(max("io_time"),1s) / 10 AS "io_time"
  FROM "Default"."autogen"."diskio"
  WHERE time > now() - 3m
  GROUP BY time(:interval:), "name"
  LIMIT 1
)
GROUP BY "host"`,
  },
]
