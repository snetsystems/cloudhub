import React from 'react'

import TableGaugeCell from 'src/dashboards/components/TableGaugeCell'
import TableLineChartCell from 'src/dashboards/components/TableLineChartCell'
import {toLineValues} from 'src/dashboards/utils/tableLineChart'
import {formatDateTimeForDeviceData} from 'src/device_management/utils'
import {
  LINE_COLORS_I,
  LINE_COLOR_PALETTES_SEQUENCE,
} from 'src/shared/constants/graphColorPalettes'
import {AlignType, ColumnInfo, OpticsThreshold} from 'src/types'
import {
  BACKGROUND_TYPE_MODES,
  CHART_TYPE_MODES,
  FORMAT_OPTIONS,
} from 'src/types/statisticalgraph'
import {OpticsPoint} from 'src/types/optics'
import {
  OPTICS_STATUS_LABEL,
  OpticsPortStatus,
  isOpticsFault,
  opticalPowerRange,
  temperatureRange,
} from 'src/device_management/constants/opticsThreshold'

const LINE_HEX = {
  tx: LINE_COLOR_PALETTES_SEQUENCE[0][0].hex,
  rx: LINE_COLOR_PALETTES_SEQUENCE[1][0].hex,
  temp: LINE_COLOR_PALETTES_SEQUENCE[3][0].hex,
}

/** Last point that actually carries a number; buckets can be empty. */
export const lastPointValue = (points: OpticsPoint[]): number | null => {
  for (let i = (points?.length ?? 0) - 1; i >= 0; i--) {
    const value = points[i]?.value
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return null
}

const fmt = (value: number | null, digits: number): string =>
  value === null ? '-' : value.toFixed(digits)

const metricColumn = ({
  key,
  name,
  portKey,
  color,
  range,
  digits,
  suffix,
  isTrend,
  xDomain,
}: {
  key: string
  name: string
  portKey: string
  color: string
  range: {min: number; max: number}
  digits: number
  suffix: string
  isTrend: boolean
  xDomain?: [number, number]
}): ColumnInfo => ({
  key,
  name,
  align: AlignType.CENTER,
  parentHeader: 'Worst port',
  options: {sorting: true, sortArrayBy: 'last', isGauge: true},
  render: (value, rowData) => {
    const portName = (rowData?.[portKey] as string) ?? ''
    const label = (
      <div className="ellipsis-text optics-worst-port" title={portName}>
        {portName || '-'}
      </div>
    )

    if (isTrend) {
      return (
        <>
          <TableLineChartCell
            color={color}
            values={toLineValues(value)}
            xDomain={xDomain}
            options={{
              isShowLine: true,
              isShowPoint: false,
              isFillArea: true,
              isConnectSeparatedPoints: false,
              valueLabel: ['last'],
              areaOpacity: 0.1,
              valueFormat: FORMAT_OPTIONS.RAW,
              suffix,
            }}
          />
          {label}
        </>
      )
    }

    return (
      <div className="optics-gauge-container">
        <TableGaugeCell
          options={{
            ...range,
            colors: LINE_COLORS_I,
            chartType: CHART_TYPE_MODES.SEGMENTED,
            backgroundType: BACKGROUND_TYPE_MODES.GRADIENT,
            isPercent: false,
            isShowValues: true,
            isGauge: true,
            valueFormat: FORMAT_OPTIONS.RAW,
            decimalPlaces: digits,
            suffix,
          }}
          value={lastPointValue(value)}
        />
        {label}
      </div>
    )
  },
})

/** Device-level rows: one per device, worst port per metric. */
export const opticsDeviceColumns = (
  isTrend: boolean,
  threshold: OpticsThreshold,
  xDomain?: [number, number]
): ColumnInfo[] => [
  {
    key: 'sysName',
    name: 'Device',
    align: AlignType.LEFT,
    parentHeader: 'Device',
    options: {sorting: true},
  },
  {
    key: 'model',
    name: 'Model',
    align: AlignType.CENTER,
    parentHeader: 'Device',
    options: {sorting: true},
  },
  {
    key: 'ip',
    name: 'IP',
    align: AlignType.LEFT,
    parentHeader: 'Device',
    options: {sorting: true, isIP: true},
  },
  {
    key: 'location',
    name: 'Location',
    align: AlignType.LEFT,
    parentHeader: 'Device',
    options: {sorting: true},
  },
  metricColumn({
    key: 'tx',
    name: 'TX Power (dBm)',
    portKey: 'txPort',
    color: LINE_HEX.tx,
    range: opticalPowerRange(threshold.tx_low_dbm),
    digits: 2,
    suffix: ' dBm',
    isTrend,
    xDomain,
  }),
  metricColumn({
    key: 'rx',
    name: 'RX Power (dBm)',
    portKey: 'rxPort',
    color: LINE_HEX.rx,
    range: opticalPowerRange(threshold.rx_low_dbm),
    digits: 2,
    suffix: ' dBm',
    isTrend,
    xDomain,
  }),
  metricColumn({
    key: 'temp',
    name: 'Temperature (°C)',
    portKey: 'tempPort',
    color: LINE_HEX.temp,
    range: temperatureRange(threshold.temp_high_c),
    digits: 1,
    suffix: ' °C',
    isTrend,
    xDomain,
  }),
  {
    key: 'status',
    name: 'Status',
    align: AlignType.CENTER,
    parentHeader: 'Ports',
    options: {sorting: true},
    render: (value, rowData) => (
      <div
        className={`device--indicator ${
          rowData?.isHealthy ? 'indicator--primary' : 'indicator--fail'
        }`}
      >
        {value}
      </div>
    ),
  },
  {
    key: 'checkedAt',
    name: 'Checked At',
    align: AlignType.CENTER,
    parentHeader: 'Ports',
    options: {sorting: true},
    render: (value, _row, _c, _r, timeZone) => (
      <>{value ? formatDateTimeForDeviceData(value, timeZone) : '-'}</>
    ),
  },
  {
    // Holds the per-port rows; clicking the device row opens them.
    key: 'ports',
    name: 'Ports',
    align: AlignType.CENTER,
    parentHeader: 'Ports',
    options: {isAccordion: true},
    render: value => <>{(value as unknown[])?.length ?? 0}</>,
  },
]

/** Port-level rows inside an expanded device. */
export const opticsPortColumns: ColumnInfo[] = [
  {key: 'ifName', name: 'Port', align: AlignType.LEFT},
  {
    // The interface name does not say what the link is for; the alias is what
    // an operator set to identify it.
    key: 'alias',
    name: 'Alias',
    align: AlignType.LEFT,
    render: value => (
      <div className="ellipsis-text" title={value || ''}>
        {value || '-'}
      </div>
    ),
  },
  {
    key: 'tx',
    name: 'TX Power (dBm)',
    align: AlignType.RIGHT,
    render: value => <>{fmt(value, 2)}</>,
  },
  {
    key: 'rx',
    name: 'RX Power (dBm)',
    align: AlignType.RIGHT,
    render: value => <>{fmt(value, 2)}</>,
  },
  {
    key: 'temp',
    name: 'Temperature (°C)',
    align: AlignType.RIGHT,
    render: value => <>{fmt(value, 1)}</>,
  },
  {
    key: 'status',
    name: 'Status',
    align: AlignType.CENTER,
    render: value => {
      const status = value as OpticsPortStatus
      // Shut and unpopulated ports read as neutral: neither green nor red.
      const indicator = isOpticsFault(status)
        ? 'indicator--fail'
        : status === 'ok'
        ? 'indicator--primary'
        : ''
      return (
        <div className={`device--indicator ${indicator}`}>
          {OPTICS_STATUS_LABEL[status] ?? '-'}
        </div>
      )
    },
  },
  {
    key: 'checkedAt',
    name: 'Checked At',
    align: AlignType.CENTER,
    render: (value, _row, _c, _r, timeZone) => (
      <>{value ? formatDateTimeForDeviceData(value, timeZone) : '-'}</>
    ),
  },
]
