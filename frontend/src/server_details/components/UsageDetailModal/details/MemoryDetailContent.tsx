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
const BYTES_PER_MIB = 1048576

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

  'memory-sreclaimable': `SELECT mean("sreclaimable")/${BYTES_PER_MIB} AS "sreclaimable"
FROM ":db:".":rp:"."mem"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'memory-sunreclaim': `SELECT mean("sunreclaim")/${BYTES_PER_MIB} AS "sunreclaim"
FROM ":db:".":rp:"."mem"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'memory-slab': `SELECT mean("slab")/${BYTES_PER_MIB} AS "slab"
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

const MEMORY_BLOCK_AXES: Record<string, Axes> = {
  'memory-usage': {
    x: FULL_DEFAULT_AXIS,
    y: {
      ...FULL_DEFAULT_AXIS,
      suffix: '',
      base: AXES_SCALE_OPTIONS.BASE_RAW,
      avoidScientificNotation: true,
    },
  },
  'memory-used': {
    x: FULL_DEFAULT_AXIS,
    y: {
      ...FULL_DEFAULT_AXIS,
      suffix: '',
      base: AXES_SCALE_OPTIONS.BASE_RAW,
      avoidScientificNotation: true,
    },
  },
  'memory-available': {
    x: FULL_DEFAULT_AXIS,
    y: {
      ...FULL_DEFAULT_AXIS,
      suffix: '',
      base: AXES_SCALE_OPTIONS.BASE_RAW,
      avoidScientificNotation: true,
    },
  },
  'memory-sreclaimable': {
    x: FULL_DEFAULT_AXIS,
    y: {
      ...FULL_DEFAULT_AXIS,
      suffix: '',
      base: AXES_SCALE_OPTIONS.BASE_RAW,
      avoidScientificNotation: true,
    },
  },
  'memory-sunreclaim': {
    x: FULL_DEFAULT_AXIS,
    y: {
      ...FULL_DEFAULT_AXIS,
      suffix: '',
      base: AXES_SCALE_OPTIONS.BASE_RAW,
      avoidScientificNotation: true,
    },
  },
  'memory-slab': {
    x: FULL_DEFAULT_AXIS,
    y: {
      ...FULL_DEFAULT_AXIS,
      suffix: '',
      base: AXES_SCALE_OPTIONS.BASE_RAW,
      avoidScientificNotation: true,
    },
  },
  'memory-swap-percent': {
    x: FULL_DEFAULT_AXIS,
    y: {
      ...FULL_DEFAULT_AXIS,
      suffix: '',
      base: AXES_SCALE_OPTIONS.BASE_RAW,
      avoidScientificNotation: true,
    },
  },
  'memory-swap-used': {
    x: FULL_DEFAULT_AXIS,
    y: {
      ...FULL_DEFAULT_AXIS,
      suffix: '',
      base: AXES_SCALE_OPTIONS.BASE_RAW,
      avoidScientificNotation: true,
    },
  },
  'memory-page-faults': {
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
  {title: string; blockClassName?: string; autoScale?: boolean; isPercent?: boolean}
> = {
  'memory-usage': {title: 'Memory Usage (%)', autoScale: false, isPercent: true},
  'memory-used': {title: 'Memory Used (GiB)', autoScale: true},
  'memory-available': {title: 'Memory Available (GiB)', autoScale: true},
  'memory-sreclaimable': {title: 'Memory SReclaimable (MiB)', autoScale: true},
  'memory-sunreclaim': {title: 'Memory SUnreclaim (MiB)', autoScale: true},
  'memory-slab': {title: 'Memory Slab (MiB)', autoScale: true},
  'memory-swap-percent': {title: 'Memory Swap Used (%)', autoScale: false, isPercent: true},
  'memory-swap-used': {title: 'Memory Swap Used (GiB)', autoScale: true},
  'memory-page-faults': {title: 'Memory Page Faults (/s)', autoScale: true},
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

function resolveAxesForBlock(
  blockId: string,
  autoScale: boolean
): Axes {
  const baseAxes =
    MEMORY_BLOCK_AXES[blockId] ?? MEMORY_DETAIL_CHART_OPTIONS.axes
  if (autoScale) return baseAxes
  const isPercent = BLOCK_CONFIG[blockId]?.isPercent === true
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
      id: `memory-detail-${blockId}`,
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
