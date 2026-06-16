import React from 'react'
import {AlignType, ColumnInfo, DataTableObject} from 'src/types'
import {Host} from 'src/shared/apis/host'
import {
  BACKGROUND_TYPE_MODES,
  CHART_TYPE_MODES,
  FORMAT_OPTIONS,
} from 'src/types/statisticalgraph'

import {
  LINE_COLORS_I,
  LINE_COLORS_J,
  LINE_COLOR_PALETTES_SEQUENCE,
} from 'src/shared/constants/graphColorPalettes'
import {Link} from 'react-router'
import TableGaugeCell from 'src/dashboards/components/TableGaugeCell'
import TableLineChartCell from 'src/dashboards/components/TableLineChartCell'
import {SERVER_DETAILS_PAGE_NAME} from 'src/shared/constants/routes'
import {toLineValues} from 'src/dashboards/utils/tableLineChart'
import AlertStatusIcon from 'src/hosts/components/AlertStatusIcon'
import {AlertStatusMap} from 'src/hosts/types/alertStatus'
import QuestionMarkTooltip from 'src/shared/components/QuestionMarkTooltip'

export interface ServerListQuery {
  id: string
  text: string
}

interface Props {
  sourceID: string
  chartMode?: 'gauge' | 'line'
  alertStatusMap?: AlertStatusMap
  onStatusIconClick?: (host: string) => void
  isAlertsEnabled?: boolean
  hosts?: Host[]
  hasFetched?: boolean
  t?: (key: string) => string
}

const SERVER_LIST_LINE_HEX_BY_PARENT = {
  CPU: LINE_COLOR_PALETTES_SEQUENCE[0][0].hex,
  Memory: LINE_COLOR_PALETTES_SEQUENCE[1][0].hex,
  Network: LINE_COLOR_PALETTES_SEQUENCE[2][0].hex,
  Disk: LINE_COLOR_PALETTES_SEQUENCE[3][0].hex,
} as const

export const serverListColumns = ({
  sourceID,
  chartMode = 'gauge',
  alertStatusMap = {},
  onStatusIconClick,
  isAlertsEnabled = true,
  hosts = [],
  hasFetched = false,
  t = (k: string) => k,
}: Props): ColumnInfo[] => {
  const isLineChart = chartMode === 'line'

  return [
    {
      key: 'host',
      name: !isAlertsEnabled ? (
        <div className="server-status-header-content">
          Status
          <QuestionMarkTooltip
            tipID="alert-status-disabled"
            tipContent={t('hosts.alert_status_disabled')}
            tooltipPlace="right"
          />
        </div>
      ) : (
        'Status'
      ),
      align: AlignType.CENTER,
      parentHeader: 'Server',
      parentHeaderClassName: 'parent-header-server',
      options: {
        thead: {
          align: AlignType.CENTER,
          className: 'server-status',
          style: {zIndex: 11},
        },
      },
      render: (value: string) => {
        if (!isAlertsEnabled) {
          return <span>-</span>
        }
        const hostStatus = alertStatusMap[value]
        const level = hostStatus?.currentLevel ?? 'normal'
        return (
          <AlertStatusIcon
            status={level}
            onStatusClick={() => onStatusIconClick && onStatusIconClick(value)}
          />
        )
      },
    },
    {
      key: 'host',
      name: '서버 호스트',
      align: AlignType.LEFT,
      parentHeader: 'Server',
      parentHeaderClassName: 'parent-header-server',
      options: {
        thead: {
          align: AlignType.LEFT,
          className: 'server-host',
          style: {width: '8%'},
        },
      },
      render: (value: string) => {
        const hostInfo = hosts?.find(h => h.minionId === value)
        const ip = hostInfo?.privateIps?.[0] || '-'
        return (
          <div
            className="server-host"
            style={{display: 'flex', flexDirection: 'column'}}
          >
            <Link
              className={'ellipsis-text'}
              title={value}
              to={`/sources/${sourceID}/server-monitoring/${SERVER_DETAILS_PAGE_NAME}?host=${value}`}
            >
              {value}
            </Link>
            <div className="server-ip">
              {ip}
              {ip === '-' && hasFetched && (
                <QuestionMarkTooltip
                  tipID={`no-ip-${value}`}
                  tipContent={t('hosts.no_ip_msg')}
                  tooltipPlace="right"
                />
              )}
            </div>
          </div>
        )
      },
    },
    {
      key: 'CPU Usage',
      name: 'CPU Usage',
      parentHeader: 'CPU',
      parentHeaderClassName: 'parent-header-cpu',
      options: {
        thead: {
          align: AlignType.CENTER,
          style: {
            width: '14%',
          },
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
        if (isLineChart) {
          return (
            <TableLineChartCell
              color={SERVER_LIST_LINE_HEX_BY_PARENT.CPU}
              values={toLineValues(value)}
              options={{
                isShowLine: true,
                isShowPoint: false,
                isFillArea: true,
                isConnectSeparatedPoints: false,
                valueLabel: ['maximum', 'last'],
                isZeroBaseline: true,
                areaOpacity: 0.1,
                pointRadius: 1,
                valueFormat: FORMAT_OPTIONS.RAW,
                suffix: '%',
              }}
            />
          )
        }
        return <TableGaugeCell options={gaugeOptions} value={value as number} />
      },
    },
    {
      key: 'Mem Total',
      name: 'Mem Total',
      parentHeader: 'Memory',
      parentHeaderClassName: 'parent-header-mem',
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
          colors: LINE_COLORS_J,
          chartType: CHART_TYPE_MODES.SEGMENTED,
          backgroundType: BACKGROUND_TYPE_MODES.GRADIENT,
          isPercent: false,
          isShowValues: true,
          isGauge: false,
          valueFormat: FORMAT_OPTIONS.KMG,
          decimalPlaces: 0,
        }

        return <TableGaugeCell options={gaugeOptions} value={value as number} />
      },
    },
    {
      key: 'Mem Usage',
      name: 'Mem Usage',
      parentHeader: 'Memory',
      align: AlignType.CENTER,
      options: {
        thead: {
          align: AlignType.CENTER,
          style: {
            width: '14%',
          },
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
        if (isLineChart) {
          return (
            <TableLineChartCell
              color={SERVER_LIST_LINE_HEX_BY_PARENT.Memory}
              values={toLineValues(value)}
              options={{
                isShowLine: true,
                isShowPoint: false,
                isFillArea: true,
                isConnectSeparatedPoints: false,
                valueLabel: ['maximum', 'last'],
                isZeroBaseline: true,
                valueFormat: FORMAT_OPTIONS.RAW,
                suffix: '%',
              }}
            />
          )
        }
        return <TableGaugeCell options={gaugeOptions} value={value as number} />
      },
    },
    {
      key: 'Mem Used',
      name: 'Mem Used',
      parentHeader: 'Memory',
      parentHeaderClassName: 'parent-header-mem',
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
          colors: LINE_COLORS_J,
          chartType: CHART_TYPE_MODES.SEGMENTED,
          backgroundType: BACKGROUND_TYPE_MODES.GRADIENT,
          isPercent: false,
          isShowValues: true,
          isGauge: false,
          decimalPlaces: 0,
          valueFormat: FORMAT_OPTIONS.KMG,
        }

        return <TableGaugeCell options={gaugeOptions} value={value as number} />
      },
    },
    {
      key: 'Mem Cached',
      name: 'Mem Cached',
      parentHeader: 'Memory',
      align: AlignType.RIGHT,
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
          colors: LINE_COLORS_J,
          chartType: CHART_TYPE_MODES.SEGMENTED,
          backgroundType: BACKGROUND_TYPE_MODES.GRADIENT,
          isPercent: false,
          isShowValues: true,
          isGauge: false,
          valueFormat: FORMAT_OPTIONS.KMG,
          decimalPlaces: 0,
        }

        return <TableGaugeCell options={gaugeOptions} value={value as number} />
      },
    },
    {
      key: 'Network Traffic',
      name: 'Network Traffic (Max)',
      parentHeader: 'Network',
      align: AlignType.CENTER,
      options: {
        thead: {
          align: AlignType.CENTER,
          style: {
            width: '14%',
          },
        },
        isGauge: true,
        sorting: true,
      },
      render: (value: number, rowData: DataTableObject) => {
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
        if (isLineChart) {
          return (
            <>
              <TableLineChartCell
                color={SERVER_LIST_LINE_HEX_BY_PARENT.Network}
                values={toLineValues(value)}
                options={{
                  isShowLine: true,
                  isShowPoint: false,
                  isFillArea: true,
                  isConnectSeparatedPoints: false,
                  valueLabel: ['maximum', 'last'],
                  isZeroBaseline: true,
                  valueFormat: FORMAT_OPTIONS.KMG,
                }}
              />
              <div
                className="ellipsis-text network-interface"
                title={rowData['Network Interface']}
              >
                {rowData['Network Interface']}
              </div>
            </>
          )
        }
        return (
          <div className="network-traffic-container">
            <TableGaugeCell options={gaugeOptions} value={value as number} />
            <div
              className="ellipsis-text network-interface"
              title={rowData['Network Interface']}
            >
              {rowData['Network Interface']}
            </div>
          </div>
        )
      },
    },
    {
      key: 'Disk Usage',
      name: 'Disk Usage',
      parentHeader: 'Disk',
      align: AlignType.CENTER,
      options: {
        thead: {
          align: AlignType.CENTER,
          style: {
            width: '14%',
          },
        },
        isGauge: true,
        sorting: true,
      },
      render: (value: number, rowData: DataTableObject) => {
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
        if (isLineChart) {
          return (
            <>
              <TableLineChartCell
                color={SERVER_LIST_LINE_HEX_BY_PARENT.Disk}
                values={toLineValues(value)}
                options={{
                  isShowLine: true,
                  isShowPoint: false,
                  isFillArea: true,
                  isConnectSeparatedPoints: false,
                  valueLabel: ['maximum', 'last'],
                  isZeroBaseline: true,
                  valueFormat: FORMAT_OPTIONS.RAW,
                  suffix: '%',
                }}
              />
              <div
                className="ellipsis-text disk-usage-path"
                title={rowData.Path}
              >
                {rowData.Path}
              </div>
            </>
          )
        }
        return (
          <div className="disk-usage-container">
            <TableGaugeCell options={gaugeOptions} value={value} />
            <div className="ellipsis-text disk-usage-path" title={rowData.Path}>
              {rowData.Path}
            </div>
          </div>
        )
      },
    },
    {
      key: 'Disk I/O %',
      name: 'Disk I/O % (Max)',
      parentHeader: 'Disk',
      align: AlignType.CENTER,
      options: {
        thead: {
          align: AlignType.CENTER,
          style: {
            width: '14%',
          },
        },
        isGauge: true,
        sorting: true,
      },
      render: (value: number, rowData: DataTableObject) => {
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
        if (isLineChart) {
          return (
            <>
              <TableLineChartCell
                color={SERVER_LIST_LINE_HEX_BY_PARENT.Disk}
                values={toLineValues(value)}
                options={{
                  isShowLine: true,
                  isShowPoint: false,
                  isFillArea: true,
                  isConnectSeparatedPoints: false,
                  valueLabel: ['maximum', 'last'],
                  isZeroBaseline: true,
                  valueFormat: FORMAT_OPTIONS.RAW,
                  suffix: '%',
                }}
              />
              <div
                className="ellipsis-text disk-io-device"
                title={formatDiskDeviceLabel(rowData.Device) as string}
              >
                {formatDiskDeviceLabel(rowData.Device)}
              </div>
            </>
          )
        }
        return (
          <div className="disk-io-container">
            <TableGaugeCell options={gaugeOptions} value={value} />
            <div
              className="ellipsis-text disk-io-device"
              title={formatDiskDeviceLabel(rowData.Device) as string}
            >
              {formatDiskDeviceLabel(rowData.Device)}
            </div>
          </div>
        )
      },
    },
    // {
    //   key: 'mean_usage_irq',
    //   name: 'mean_usage_irq',
    //   align: AlignType.RIGHT,
    //   options: {
    //     thead: {
    //       align: AlignType.RIGHT,
    //     },
    //     sorting: true,
    //   },
    //   render: (_value: number, cellData: DataTableObject) => {
    //     const series = Array.isArray(cellData.mean_usage_irq)
    //       ? cellData.mean_usage_irq
    //       : []

    //     return (
    //       <TableLineChartCell
    //         values={series}
    //         options={{
    //           isShowLine: true,
    //           isShowPoint: false,
    //           isFillArea: true,
    //           isConnectSeparatedPoints: false,
    //           valueLabel: 'maximum',
    //           isZeroBaseline: true,
    //         }}
    //       />
    //     )
    //   },
    // },
  ]
}

const formatDiskDeviceLabel = (device: unknown) => {
  if (typeof device !== 'string') {
    return device
  }

  const trimmed = device.trim()

  if (/^\d+\s+[A-Z]:$/i.test(trimmed)) {
    return trimmed.split(/\s+/).slice(1).join(' ')
  }

  return trimmed
}

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
FROM ":db:".":rp:"."cpu"
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
FROM ":db:".":rp:"."mem"
WHERE time > :dashboardTime: AND time < :upperDashboardTime:
GROUP BY "host"
FILL(null)`,
  },
  {
    id: 'server-list-mem-cached-win',
    text: `SELECT last("Standby_Cache_Core_Bytes") + last("Standby_Cache_Normal_Priority_Bytes") + last("Standby_Cache_Reserve_Bytes") AS "Mem Cached"
FROM ":db:".":rp:"."win_mem"
WHERE time > :dashboardTime: AND time < :upperDashboardTime:
GROUP BY "host"
FILL(null)`,
  },
  {
    id: 'server-list-network',
    text: `SELECT "interface" AS "Network Interface", max("traffic") AS "Network Traffic"
FROM (
  SELECT non_negative_derivative(max("bytes_recv"),1s) + non_negative_derivative(max("bytes_sent"),1s) AS "traffic"
  FROM ":db:".":rp:"."net"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime:
  GROUP BY time(:interval:), "interface"
)
GROUP BY "host"`,
  },
  {
    id: 'server-list-network-win',
    text: `SELECT "instance" AS "Network Interface", max("traffic") AS "Network Traffic"
FROM (
  SELECT max("Bytes_Received_persec") + max("Bytes_Sent_persec") AS "traffic"
  FROM ":db:".":rp:"."win_net"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "instance" !~ /^_Total/
  GROUP BY time(:interval:), "host", "instance"
)
GROUP BY "host"`,
  },
  {
    id: 'server-list-disk-io-win',
    text: `SELECT "instance" AS "Device", max("Disk I/O %") AS "Disk I/O %"
FROM (
  SELECT last("Percent_Disk_Time") AS "Disk I/O %"
  FROM ":db:".":rp:"."win_diskio"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "instance" !~ /^_Total/
  GROUP BY time(:interval:), "host", "instance"
)
GROUP BY "host"`,
  },

  {
    id: 'server-list-disk-usage',
    text: `SELECT "path" AS "Path", max("Disk Usage") AS "Disk Usage"
FROM (
  SELECT last("used_percent") AS "Disk Usage"
  FROM ":db:".":rp:"."disk"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND path !~ /^\\/boot/ AND path !~ /^\\/run/
  GROUP BY "path"
)
GROUP BY "host"`,
  },

  // {
  //   id: 'server-list-disk-io',
  //   text: `SELECT "name" AS "Device", max("io_time") AS "Disk I/O %"
  // FROM (
  //   SELECT non_negative_derivative(max("io_time"),1s) / 10 AS "io_time"
  //   FROM ":db:".":rp:"."diskio"
  //   WHERE time > now() - 3m
  //   GROUP BY time(:interval:), "name"
  //   LIMIT 1
  // )
  // GROUP BY "host"`,
  // },
  // TODO: 데이터 수집 처리 후 아래 diskio_ext 쿼리로 교체 (mount_path 활용)
  {
    id: 'server-list-disk-io',
    text: `SELECT "mount_path" AS "Device", max("io_time") AS "Disk I/O %"
  FROM (
    SELECT non_negative_derivative(max("io_time"),1s) / 10 AS "io_time"
    FROM ":db:".":rp:"."diskio"
    WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "mount_path" != ''
    GROUP BY time(:interval:), "host", "mount_path"
  )
  GROUP BY "host"`,
  },

  // {
  //   id: 'server-list-cpu-irq-mean',
  //   text: `SELECT mean("usage_irq") AS "mean_usage_irq" FROM ":db:".":rp:"."cpu" WHERE time > :dashboardTime: AND time < :upperDashboardTime: GROUP BY "host", time(:interval:)`,
  // },
]

export const serverListLineQueries: ServerListQuery[] = [
  {
    id: 'server-list-line-cpu',
    text: `SELECT mean("usage_system") + mean("usage_user") AS "CPU Usage"
FROM ":db:".":rp:"."cpu"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "cpu"='cpu-total'
GROUP BY "host", time(:interval:)
FILL(null)`,
  },
  {
    id: 'server-list-line-mem',
    text: `SELECT mean("used_percent") AS "Mem Usage"
FROM ":db:".":rp:"."mem"
WHERE time > :dashboardTime: AND time < :upperDashboardTime:
GROUP BY "host", time(:interval:)
FILL(null)`,
  },
  {
    id: 'server-list-line-mem-static',
    text: `SELECT last("total") AS "Mem Total",
last("used") AS "Mem Used",
last("cached") AS "Mem Cached"
FROM ":db:".":rp:"."mem"
WHERE time > :dashboardTime: AND time < :upperDashboardTime:
GROUP BY "host"
FILL(null)`,
  },
  {
    id: 'server-list-line-mem-cached-win',
    text: `SELECT last("Standby_Cache_Core_Bytes") + last("Standby_Cache_Normal_Priority_Bytes") + last("Standby_Cache_Reserve_Bytes") AS "Mem Cached"
FROM ":db:".":rp:"."win_mem"
WHERE time > :dashboardTime: AND time < :upperDashboardTime:
GROUP BY "host"
FILL(null)`,
  },
  {
    id: 'server-list-line-disk-usage',
    text: `SELECT max("Disk Usage") AS "Disk Usage"
FROM (
  SELECT last("used_percent") AS "Disk Usage"
  FROM ":db:".":rp:"."disk"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND path !~ /^\\/boot/ AND path !~ /^\\/run/
  GROUP BY "host", "path", time(:interval:)
  FILL(null)
)
GROUP BY "host", time(:interval:)
FILL(null)`,
  },
  //   {
  //     id: 'server-list-line-disk-io',
  //     text: `SELECT max("Disk I/O %") AS "Disk I/O %"
  // FROM (
  //   SELECT non_negative_derivative(max("io_time"),1s) / 10 AS "Disk I/O %"
  //   FROM ":db:".":rp:"."diskio"
  //   WHERE time > :dashboardTime: AND time < :upperDashboardTime:
  //   GROUP BY "host", "name", time(:interval:)
  //   FILL(null)
  // )
  // GROUP BY "host", time(:interval:)
  // FILL(null)`,
  //   },
  // TODO: 데이터 수집 처리 후 아래 diskio_ext 쿼리로 교체 (mount_path 활용)
  {
    id: 'server-list-line-disk-io',
    text: `SELECT max("Disk I/O %") AS "Disk I/O %"
  FROM (
    SELECT non_negative_derivative(max("io_time"),1s) / 10 AS "Disk I/O %"
    FROM ":db:".":rp:"."diskio"
    WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "mount_path" != ''
    GROUP BY "host", "mount_path", time(:interval:)
    FILL(null)
  )
  GROUP BY "host", time(:interval:)
  FILL(null)`,
  },
  {
    id: 'server-list-line-disk-io-win',
    text: `SELECT max("Disk I/O %") AS "Disk I/O %"
FROM (
  SELECT last("Percent_Disk_Time") AS "Disk I/O %"
  FROM ":db:".":rp:"."win_diskio"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "instance" !~ /^_Total/
  GROUP BY "host", "instance", time(:interval:)
  FILL(null)
)
GROUP BY "host", time(:interval:)
FILL(null)`,
  },
  {
    id: 'server-list-line-network',
    text: `SELECT max("traffic") AS "Network Traffic"
FROM (
  SELECT non_negative_derivative(max("bytes_recv"),1s) + non_negative_derivative(max("bytes_sent"),1s) AS "traffic"
  FROM ":db:".":rp:"."net"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime:
  GROUP BY "host", "interface", time(:interval:)
  FILL(null)
)
GROUP BY "host", time(:interval:)
FILL(null)`,
  },
  {
    id: 'server-list-line-network-win',
    text: `SELECT max("traffic") AS "Network Traffic"
FROM (
  SELECT max("Bytes_Received_persec") + max("Bytes_Sent_persec") AS "traffic"
  FROM ":db:".":rp:"."win_net"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "instance" !~ /^_Total/
  GROUP BY "host", "instance", time(:interval:)
  FILL(null)
)
GROUP BY "host", time(:interval:)
FILL(null)`,
  },
  {
    id: 'server-list-network-win',
    text: `SELECT "instance" AS "Network Interface", max("traffic") AS "__ignore_network_traffic__"
  FROM (
    SELECT max("Bytes_Received_persec") + max("Bytes_Sent_persec") AS "traffic"
    FROM ":db:".":rp:"."win_net"
    WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "instance" !~ /^_Total/
    GROUP BY time(:interval:), "host", "instance"
  )
  GROUP BY "host"`,
  },
  {
    id: 'server-list-network',
    text: `SELECT "interface" AS "Network Interface", max("traffic") AS "__ignore_network_traffic__"
  FROM (
    SELECT non_negative_derivative(max("bytes_recv"),1s) + non_negative_derivative(max("bytes_sent"),1s) AS "traffic"
    FROM ":db:".":rp:"."net"
    WHERE time > :dashboardTime: AND time < :upperDashboardTime:
    GROUP BY time(:interval:), "host", "interface"
  )
  GROUP BY "host"`,
  },
  {
    id: 'server-list-line-disk-usage-meta',
    text: `SELECT "path" AS "Path", max("Disk Usage") AS "__ignore_disk_usage__"
FROM (
  SELECT last("used_percent") AS "Disk Usage"
  FROM ":db:".":rp:"."disk"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND path !~ /^\\/boot/ AND path !~ /^\\/run/
  GROUP BY "host", "path"
)
GROUP BY "host"`,
  },
  // {
  //   id: 'server-list-line-disk-io-meta',
  //   text: `SELECT "name" AS "Device", max("io_time") AS "__ignore_disk_io__"
  // FROM (
  //   SELECT non_negative_derivative(max("io_time"),1s) / 10 AS "io_time"
  //   FROM ":db:".":rp:"."diskio"
  //   WHERE time > now() - 3m
  //   GROUP BY time(:interval:), "host", "name"
  //   LIMIT 1
  // )
  // GROUP BY "host"`,
  // },
  // TODO: 데이터 수집 처리 후 아래 diskio_ext 쿼리로 교체 (mount_path 활용)
  {
    id: 'server-list-line-disk-io-meta',
    text: `SELECT "mount_path" AS "Device", max("io_time") AS "__ignore_disk_io__"
  FROM (
    SELECT non_negative_derivative(max("io_time"),1s) / 10 AS "io_time"
    FROM ":db:".":rp:"."diskio"
    WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "mount_path" != ''
    GROUP BY time(:interval:), "host", "mount_path"
  )
  GROUP BY "host"`,
  },
  {
    id: 'server-list-line-disk-io-win-meta',
    text: `SELECT "instance" AS "Device", max("Disk I/O %") AS "__ignore_disk_io__"
FROM (
  SELECT last("Percent_Disk_Time") AS "Disk I/O %"
  FROM ":db:".":rp:"."win_diskio"
  WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "instance" !~ /^_Total/
  GROUP BY time(:interval:), "host", "instance"
)
GROUP BY "host"`,
  },
]
