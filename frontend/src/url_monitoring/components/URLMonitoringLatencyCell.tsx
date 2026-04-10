import React from 'react'
import TableLineChartCell from 'src/dashboards/components/TableLineChartCell'
import {toLineValues} from 'src/dashboards/utils/tableLineChart'
import {LINE_COLOR_PALETTES_SEQUENCE} from 'src/shared/constants/graphColorPalettes'
import {DataTableObject, TimeZones} from 'src/types'
import {TableLineChartPoint, TimeSeriesValue} from 'src/types/series'

type LatencyCell =
  | TimeSeriesValue
  | TimeSeriesValue[]
  | TableLineChartPoint[]
  | null
  | undefined

const LATENCY_LINE_COLOR = LINE_COLOR_PALETTES_SEQUENCE[0][0].hex
const DEFAULT_LATENCY_CHART_HEIGHT = 38

interface Props {
  value: LatencyCell
  rowData: DataTableObject
  rowIndex: number
  timeZone: TimeZones
  chartHeight?: number
  onChartClick?: () => void
}

export function URLMonitoringLatencyCell({
  value,
  rowData: _rowData,
  rowIndex: _rowIndex,
  timeZone: _timeZone,
  chartHeight,
  onChartClick,
}: Props) {
  return (
    <TableLineChartCell
      color={LATENCY_LINE_COLOR}
      values={toLineValues(value)}
      height={chartHeight ?? DEFAULT_LATENCY_CHART_HEIGHT}
      strokeWidth={0.2}
      onChartClick={onChartClick}
      options={{
        isShowLine: true,
        isShowPoint: false,
        isFillArea: true,
        isConnectSeparatedPoints: true,
        valueLabel: ['last', 'maximum', 'average'],
        isZeroBaseline: true,
        areaOpacity: 0.1,
        pointRadius: 1,
        suffix: 'ms',
      }}
    />
  )
}
