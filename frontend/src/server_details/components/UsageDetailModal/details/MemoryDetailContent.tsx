import React from 'react'
import RefreshingGraph from 'src/shared/components/RefreshingGraph'
import {CellType, QueryType} from 'src/types'
import type {Template, TimeRange, CellQuery} from 'src/types'
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

const MEMORY_DETAIL_CHART_OPTIONS = {
  graphOptions: {
    ...DEFAULT_GRAPH_OPTIONS,
    fillArea: false,
    showLine: true,
    showPoint: false,
  } as GraphOptions,
  decimalPlaces: {...DEFAULT_DECIMAL_PLACES, digits: 1, isEnforced: true},
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

const BYTES_PER_GIB = 1073741824

const MEMORY_Y_AXIS = {
  ...FULL_DEFAULT_AXIS,
  suffix: '',
  base: AXES_SCALE_OPTIONS.BASE_RAW,
  avoidScientificNotation: true,
}

const BLOCK_QUERIES: Record<string, string> = {
  'memory-usage': `SELECT mean("used_percent") AS "used_percent"
FROM ":db:".":rp:"."mem"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'memory-used': `SELECT mean("free")/${BYTES_PER_GIB} AS "free", mean("cached")/${BYTES_PER_GIB} AS "cached", mean("buffered")/${BYTES_PER_GIB} AS "buffers", mean("used")/${BYTES_PER_GIB} AS "used"
FROM ":db:".":rp:"."mem"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'memory-available': `SELECT mean("available")/${BYTES_PER_GIB} AS "available"
FROM ":db:".":rp:"."mem"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'memory-sreclaimable': `SELECT mean("sreclaimable")/${BYTES_PER_GIB} AS "sreclaimable"
FROM ":db:".":rp:"."mem"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'memory-sunreclaim': `SELECT mean("sunreclaim")/${BYTES_PER_GIB} AS "sunreclaim"
FROM ":db:".":rp:"."mem"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'memory-slab': `SELECT mean("slab")/${BYTES_PER_GIB} AS "slab"
FROM ":db:".":rp:"."mem"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'memory-swap-percent': `SELECT (mean("swap_total") - mean("swap_free")) / mean("swap_total") * 100 AS "swap_used_percent"
FROM ":db:".":rp:"."mem"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'memory-swap-used': `SELECT (mean("swap_total") - mean("swap_free"))/${BYTES_PER_GIB} AS "swap_used"
FROM ":db:".":rp:"."mem"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'memory-page-faults': `SELECT non_negative_derivative(mean("pgfault"), 1s) AS "pgfault", non_negative_derivative(mean("pgmajfault"), 1s) AS "pgmajfault"
FROM ":db:".":rp:"."kernel_vmstat"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,
}

const MEMORY_BASE_AXES: Axes = {
  x: FULL_DEFAULT_AXIS,
  y: MEMORY_Y_AXIS,
}

const BLOCK_CONFIG: Record<
  string,
  {title: string; blockClassName?: string; isPercent?: boolean; bounds?: [string, string]; yLabel?: string}
> = {
  'memory-usage': {title: 'Memory Usage (%)', isPercent: true, bounds: ['0', '100']},
  'memory-used': {title: 'Memory Used (GiB)', bounds: ['0', ''], yLabel: 'GiB'},
  'memory-available': {title: 'Memory Available (GiB)', bounds: ['0', ''], yLabel: 'GiB'},
  'memory-sreclaimable': {title: 'Memory SReclaimable (GiB)', bounds: ['0', ''], yLabel: 'GiB'},
  'memory-sunreclaim': {title: 'Memory SUnreclaim (GiB)', bounds: ['0', ''], yLabel: 'GiB'},
  'memory-slab': {title: 'Memory Slab (GiB)', bounds: ['0', ''], yLabel: 'GiB'},
  'memory-swap-percent': {title: 'Memory Swap Used (%)', isPercent: true, bounds: ['0', '100']},
  'memory-swap-used': {title: 'Memory Swap Used (GiB)', bounds: ['0', ''], yLabel: 'GiB'},
  'memory-page-faults': {title: 'Memory Page Faults (/s)', bounds: ['0', '']},
}

const GRID_LAYOUT = {
  top: ['memory-usage', 'memory-used', 'memory-available'] as const,
  middle: ['memory-sreclaimable', 'memory-sunreclaim', 'memory-slab'] as const,
  bottom: [
    'memory-swap-percent',
    'memory-swap-used',
    'memory-page-faults',
  ] as const,
}

function resolveAxesForBlock(blockId: string): Axes {
  const config = BLOCK_CONFIG[blockId]
  const bounds = config?.bounds
  if (!bounds) return MEMORY_BASE_AXES
  const yOverrides: Partial<typeof MEMORY_Y_AXIS> = {bounds}
  if (config?.yLabel) yOverrides.suffix = ` ${config.yLabel}`
  return {...MEMORY_BASE_AXES, y: {...MEMORY_BASE_AXES.y, ...yOverrides}}
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

  const queries: CellQuery[] = [
    {
      query: queryText,
      text: queryText,
      id: `memory-detail-${blockId}`,
      type: QueryType.InfluxQL,
      queryConfig: null as CellQuery['queryConfig'],
      source: source.id,
    },
  ]

  const axes = resolveAxesForBlock(blockId)

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
        graphOptions={MEMORY_DETAIL_CHART_OPTIONS.graphOptions}
        staticLegend={MEMORY_DETAIL_CHART_OPTIONS.staticLegend}
        staticLegendPosition={MEMORY_DETAIL_CHART_OPTIONS.staticLegendPosition}
        staticLegendGap={MEMORY_DETAIL_CHART_OPTIONS.staticLegendGap}
        axisLabelWidth={MEMORY_DETAIL_CHART_OPTIONS.axisLabelWidth}
        containerStyle={MEMORY_DETAIL_CHART_OPTIONS.containerStyle}
        colors={colors}
        tableOptions={DEFAULT_TABLE_OPTIONS}
        fieldOptions={DEFAULT_FIELD_OPTIONS}
        decimalPlaces={MEMORY_DETAIL_CHART_OPTIONS.decimalPlaces}
        tableGaugeChartOptions={DEFAULT_TABLE_GAUGE_CHART_OPTIONS}
        cellID={`memory-detail-${blockId}`}
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

export function MemoryDetailContent({
  serverContext,
  templates,
}: {
  serverContext: UsageDetailServerContext
  templates: Template[] | null
}) {
  const timeRange = serverContext.timeRange ?? DEFAULT_DETAIL_TIME_RANGE
  const source = serverContext.source
  const host = serverContext.selectedHost

  const renderGridSection = (blockIds: readonly string[], startIndex: number) =>
    blockIds.map((blockId, i) => {
      const config = BLOCK_CONFIG[blockId]
      if (!config) return null
      const paletteIndex =
        (startIndex + i) % LINE_COLOR_PALETTES_SEQUENCE.length
      const colors = LINE_COLOR_PALETTES_SEQUENCE[paletteIndex]
      return (
        <UsageDetailBlock
          key={blockId}
          title={config.title}
          blockClassName={config.blockClassName}
        >
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
    })

  return (
    <div className="process-detail-modal__body">
      <div className="process-detail-modal__grid process-detail-modal__grid--top">
        {renderGridSection(GRID_LAYOUT.top, 0)}
      </div>
      <div className="process-detail-modal__grid process-detail-modal__grid--middle">
        {renderGridSection(GRID_LAYOUT.middle, GRID_LAYOUT.top.length)}
      </div>
      <div className="process-detail-modal__grid process-detail-modal__grid--bottom">
        {renderGridSection(
          GRID_LAYOUT.bottom,
          GRID_LAYOUT.top.length + GRID_LAYOUT.middle.length
        )}
      </div>
    </div>
  )
}
