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

// BYTES_PER_GIB removed as it is now handled in the backend queries

const MEMORY_Y_AXIS = {
  ...FULL_DEFAULT_AXIS,
  suffix: '',
  base: AXES_SCALE_OPTIONS.BASE_RAW,
  avoidScientificNotation: true,
}

// Queries are now fetched from the backend (server-details.json)

const MEMORY_BASE_AXES: Axes = {
  x: FULL_DEFAULT_AXIS,
  y: MEMORY_Y_AXIS,
}

type MemoryBlockConfig = {
  title: string
  blockClassName?: string
  isPercent?: boolean
  bounds?: [string, string]
  yLabel?: string
}

const LINUX_BLOCK_CONFIG: Record<
  string,
  MemoryBlockConfig
> = {
  'memory-usage': {title: 'Memory Usage (%)', isPercent: true, bounds: ['0', '110']},
  'memory-used': {title: 'Memory Used (GiB)', bounds: ['0', ''], yLabel: 'GiB'},
  'memory-available': {title: 'Memory Available (GiB)', bounds: ['0', ''], yLabel: 'GiB'},
  'memory-sreclaimable': {title: 'Memory SReclaimable (GiB)', bounds: ['0', ''], yLabel: 'GiB'},
  'memory-sunreclaim': {title: 'Memory SUnreclaim (GiB)', bounds: ['0', ''], yLabel: 'GiB'},
  'memory-slab': {title: 'Memory Slab (GiB)', bounds: ['0', ''], yLabel: 'GiB'},
  'memory-swap-percent': {title: 'Memory Swap Used (%)', isPercent: true, bounds: ['0', '110']},
  'memory-swap-used': {title: 'Memory Swap Used (GiB)', bounds: ['0', ''], yLabel: 'GiB'},
  'memory-page-faults': {title: 'Memory Page Faults (/s)', bounds: ['0', '']},
}

const WINDOWS_BLOCK_CONFIG: Record<string, MemoryBlockConfig> = {
  'memory-usage': {title: 'Memory Usage(%)', isPercent: true, bounds: ['0', '110']},
  'memory-available': {title: 'Memory Available', bounds: ['0', ''], yLabel: 'GiB'},
  'memory-paged-pool': {title: 'Paged Pool(Byte)', bounds: ['0', '']},
  'memory-nonpaged-pool': {title: 'Nonpaged Pool(Byte)', bounds: ['0', '']},
  'memory-swap-percent': {title: 'Memory Swap Used(%)', isPercent: true, bounds: ['0', '110']},
  'memory-page-faults': {title: 'Memory Page Faults', bounds: ['0', '']},
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

const WINDOWS_GRID_LAYOUT = {
  top: ['memory-usage', 'memory-available', 'memory-paged-pool'] as const,
  middle: ['memory-nonpaged-pool', 'memory-swap-percent', 'memory-page-faults'] as const,
  bottom: [] as const,
}

const WINDOWS_BLOCK_TO_QUERY_LABEL: Record<string, string> = {
  'memory-paged-pool': 'memory-sreclaimable',
  'memory-nonpaged-pool': 'memory-sunreclaim',
}

function resolveAxesForBlock(blockId: string): Axes {
  const config = LINUX_BLOCK_CONFIG[blockId] ?? WINDOWS_BLOCK_CONFIG[blockId]
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
  manualRefresh,
  queryText,
}: {
  blockId: string
  source: Source | null
  host: string | null
  timeRange: TimeRange
  templates: Template[] | null
  colors: typeof LINE_COLOR_PALETTES_SEQUENCE[number]
  manualRefresh?: number
  queryText?: string
}) {
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
        manualRefresh={manualRefresh}
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
  const detailQueries = serverContext.detailQueries ?? []
  const detailQueryLabels = new Set(detailQueries.map(q => q.label))
  const isWindowsLayout =
    !detailQueryLabels.has('memory-used') &&
    !detailQueryLabels.has('memory-slab') &&
    detailQueryLabels.has('memory-page-faults')
  const gridLayout = isWindowsLayout ? WINDOWS_GRID_LAYOUT : GRID_LAYOUT
  const blockConfig = isWindowsLayout ? WINDOWS_BLOCK_CONFIG : LINUX_BLOCK_CONFIG


  const renderGridSection = (blockIds: readonly string[], startIndex: number) =>
    blockIds.map((blockId, i) => {
      const config = blockConfig[blockId]
      if (!config) return null
      const queryLabel = WINDOWS_BLOCK_TO_QUERY_LABEL[blockId] ?? blockId
      if (!detailQueryLabels.has(queryLabel)) return null
      const paletteIndex =
        (startIndex + i) % LINE_COLOR_PALETTES_SEQUENCE.length
      const colors = LINE_COLOR_PALETTES_SEQUENCE[paletteIndex]
      const queryText = detailQueries.find(q => q.label === queryLabel)?.query
      const blockClassName = config.blockClassName

      return (
        <UsageDetailBlock
          key={blockId}
          title={config.title}
          blockClassName={blockClassName}
        >
          <DetailChartBlock
            blockId={blockId}
            source={source}
            host={host}
            timeRange={timeRange}
            templates={templates}
            colors={colors}
            manualRefresh={serverContext.manualRefresh}
            queryText={queryText}
          />
        </UsageDetailBlock>
      )
    })

  return (
    <div className="process-detail-modal__body">
      <div className="process-detail-modal__grid process-detail-modal__grid--top">
        {renderGridSection(gridLayout.top, 0)}
      </div>
      <div className="process-detail-modal__grid process-detail-modal__grid--middle">
        {renderGridSection(gridLayout.middle, gridLayout.top.length)}
      </div>
      {gridLayout.bottom.length > 0 && (
        <div className="process-detail-modal__grid process-detail-modal__grid--bottom">
          {renderGridSection(
            gridLayout.bottom,
            gridLayout.top.length + gridLayout.middle.length
          )}
        </div>
      )}
    </div>
  )
}
