import React from 'react'
import RefreshingGraph from 'src/shared/components/RefreshingGraph'
import {CellType, QueryType} from 'src/types'
import type {Template, TimeRange, Query} from 'src/types'
import type {Source} from 'src/types/sources'
import {
  DEFAULT_AXES,
  FULL_DEFAULT_AXIS,
  AXES_SCALE_OPTIONS,
} from 'src/dashboards/constants/cellEditor'
import type {Axes} from 'src/types/dashboards'
import {
  DEFAULT_TABLE_OPTIONS,
  DEFAULT_FIELD_OPTIONS,
  DEFAULT_DECIMAL_PLACES,
} from 'src/dashboards/constants'
import {
  DEFAULT_TABLE_GAUGE_CHART_OPTIONS,
  DEFAULT_GRAPH_OPTIONS,
} from 'src/shared/constants'
import {LINE_COLOR_PALETTES_SEQUENCE} from 'src/shared/constants/graphColorPalettes'
import {NoteVisibility} from 'src/types/dashboards'
import type {GraphOptions} from 'src/types/dashboards'
import {UsageDetailBlock} from '../UsageDetailBlock'
import type {UsageDetailServerContext} from '../types'
import {DEFAULT_DETAIL_TIME_RANGE} from '../utils'

const BYTES_PER_MIB = 1048576

const NETWORK_DETAIL_CHART_OPTIONS = {
  graphOptions: {
    ...DEFAULT_GRAPH_OPTIONS,
    fillArea: false,
    showLine: true,
    showPoint: false,
  } as GraphOptions,
  decimalPlaces: {...DEFAULT_DECIMAL_PLACES, digits: 2, isEnforced: true},
  axes: DEFAULT_AXES,
  staticLegend: true,
  staticLegendPosition: 'bottom' as const,
  staticLegendGap: 0,
  axisLabelWidth: 32,
  containerStyle: {
    left: 2,
    top: 2,
    width: 'calc(100% - 4px)',
    height: 'calc(100% - 4px)',
    position: 'absolute' as const,
  },
}

const BLOCK_QUERIES: Record<string, string> = {
  'traffic-in-out': `SELECT non_negative_derivative(sum("bytes_recv"), 1s)/${BYTES_PER_MIB} AS "Traffic in", non_negative_derivative(sum("bytes_sent"), 1s)/${BYTES_PER_MIB} AS "Traffic out"
FROM ":db:".":rp:"."net"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'packet-in-out': `SELECT non_negative_derivative(sum("packets_recv"), 1s) AS "Packet in", non_negative_derivative(sum("packets_sent"), 1s) AS "Packet out"
FROM ":db:".":rp:"."net"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'error-in-out': `SELECT non_negative_derivative(sum("err_in"), 1s) AS "Error in", non_negative_derivative(sum("err_out"), 1s) AS "Error out"
FROM ":db:".":rp:"."net"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'dropped-in-out': `SELECT non_negative_derivative(sum("drop_in"), 1s) AS "Dropped in", non_negative_derivative(sum("drop_out"), 1s) AS "Dropped out"
FROM ":db:".":rp:"."net"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,
}

const NETWORK_BLOCK_AXES: Record<string, Axes> = {
  'traffic-in-out': {
    x: FULL_DEFAULT_AXIS,
    y: {
      ...FULL_DEFAULT_AXIS,
      suffix: '',
      base: AXES_SCALE_OPTIONS.BASE_RAW,
      avoidScientificNotation: true,
    },
  },
  'packet-in-out': {
    x: FULL_DEFAULT_AXIS,
    y: {
      ...FULL_DEFAULT_AXIS,
      suffix: '',
      base: AXES_SCALE_OPTIONS.BASE_RAW,
      avoidScientificNotation: true,
    },
  },
  'error-in-out': {
    x: FULL_DEFAULT_AXIS,
    y: {
      ...FULL_DEFAULT_AXIS,
      suffix: '',
      base: AXES_SCALE_OPTIONS.BASE_RAW,
      avoidScientificNotation: true,
    },
  },
  'dropped-in-out': {
    x: FULL_DEFAULT_AXIS,
    y: {
      ...FULL_DEFAULT_AXIS,
      suffix: '',
      base: AXES_SCALE_OPTIONS.BASE_RAW,
      avoidScientificNotation: true,
    },
  },
}

const BLOCK_CONFIG: Record<
  string,
  {title: string; autoScale?: boolean}
> = {
  'traffic-in-out': {title: 'Traffic In/Out (MiB/s)', autoScale: true},
  'packet-in-out': {title: 'Packet In/Out (/s)', autoScale: true},
  'error-in-out': {title: 'Error In/Out (/s)', autoScale: true},
  'dropped-in-out': {title: 'Dropped In/Out (/s)', autoScale: true},
}

const GRID_LAYOUT = [
  'traffic-in-out',
  'packet-in-out',
  'error-in-out',
  'dropped-in-out',
] as const

function resolveAxesForBlock(
  blockId: string,
  autoScale: boolean
): Axes {
  const baseAxes =
    NETWORK_BLOCK_AXES[blockId] ?? NETWORK_DETAIL_CHART_OPTIONS.axes
  if (autoScale) return baseAxes
  const isPercent = (baseAxes.y?.suffix ?? '').trim().endsWith('%')
  if (!isPercent) return baseAxes
  return {
    ...baseAxes,
    y: {...baseAxes.y, bounds: ['0', '100'] as [string, string]},
  }
}

function DetailChartBlock({
  blockId,
  source,
  host,
  timeRange,
  templates,
  colors,
}: {
  blockId: string
  source: Source | null
  host: string | null
  timeRange: TimeRange
  templates: Template[] | null
  colors: typeof LINE_COLOR_PALETTES_SEQUENCE[number]
}) {
  const queryText = BLOCK_QUERIES[blockId]
  if (!queryText) return null

  if (!source) {
    return (
      <div className="process-detail-modal__placeholder">
        Source가 없습니다.
      </div>
    )
  }

  if (!host || !templates) {
    return (
      <div className="process-detail-modal__placeholder">
        호스트를 선택하세요.
      </div>
    )
  }

  const queries: Query[] = [
    {
      text: queryText,
      id: `network-detail-${blockId}`,
      type: QueryType.InfluxQL,
      queryConfig: null,
    } as Query,
  ]

  const autoScale = BLOCK_CONFIG[blockId]?.autoScale ?? true
  const axes = resolveAxesForBlock(blockId, autoScale)

  return (
    <div
      className="process-detail-modal__chart"
      style={{width: '100%', height: '100%'}}
    >
      <RefreshingGraph
        source={source}
        queryType={QueryType.InfluxQL}
        queries={queries}
        templates={templates}
        timeRange={timeRange}
        type={CellType.Line}
        axes={axes}
        graphOptions={NETWORK_DETAIL_CHART_OPTIONS.graphOptions}
        staticLegend={NETWORK_DETAIL_CHART_OPTIONS.staticLegend}
        staticLegendPosition={NETWORK_DETAIL_CHART_OPTIONS.staticLegendPosition}
        staticLegendGap={NETWORK_DETAIL_CHART_OPTIONS.staticLegendGap}
        axisLabelWidth={NETWORK_DETAIL_CHART_OPTIONS.axisLabelWidth}
        containerStyle={NETWORK_DETAIL_CHART_OPTIONS.containerStyle}
        colors={colors}
        tableOptions={DEFAULT_TABLE_OPTIONS}
        fieldOptions={DEFAULT_FIELD_OPTIONS}
        decimalPlaces={NETWORK_DETAIL_CHART_OPTIONS.decimalPlaces}
        tableGaugeChartOptions={DEFAULT_TABLE_GAUGE_CHART_OPTIONS}
        cellID={`network-detail-${blockId}`}
        cellHeight={160}
        resizerTopHeight={0}
        cellNote=""
        cellNoteVisibility={NoteVisibility.Default}
        inView={true}
        onZoom={() => {}}
        editQueryStatus={() => {}}
        onSetResolution={() => {}}
      />
    </div>
  )
}

export function NetworkDetailContent({
  serverContext,
  templates,
}: {
  serverContext: UsageDetailServerContext
  templates: Template[] | null
}) {
  const timeRange = serverContext.timeRange ?? DEFAULT_DETAIL_TIME_RANGE
  const source = serverContext.source
  const host = serverContext.selectedHost

  return (
    <div className="process-detail-modal__body">
      <div className="process-detail-modal__grid process-detail-modal__grid--2x2">
        {GRID_LAYOUT.map((blockId, i) => {
          const config = BLOCK_CONFIG[blockId]
          if (!config) return null
          const colors =
            LINE_COLOR_PALETTES_SEQUENCE[
              i % LINE_COLOR_PALETTES_SEQUENCE.length
            ]
          return (
            <UsageDetailBlock key={blockId} title={config.title}>
              <DetailChartBlock
                blockId={blockId}
                source={source}
                host={host}
                timeRange={timeRange}
                templates={templates}
                colors={colors}
              />
            </UsageDetailBlock>
          )
        })}
      </div>
    </div>
  )
}
