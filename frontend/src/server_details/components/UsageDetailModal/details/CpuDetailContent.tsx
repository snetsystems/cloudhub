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

const CPU_DETAIL_CHART_OPTIONS = {
  graphOptions: {
    ...DEFAULT_GRAPH_OPTIONS,
    fillArea: false,
    showLine: true,
    showPoint: false,
  } as GraphOptions,
  decimalPlaces: {...DEFAULT_DECIMAL_PLACES, digits: 3, isEnforced: true},
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

const CPU_USAGE_AXES: Axes = {
  x: FULL_DEFAULT_AXIS,
  y: {
    ...FULL_DEFAULT_AXIS,
    suffix: '',
    base: AXES_SCALE_OPTIONS.BASE_RAW,
    avoidScientificNotation: true,
  },
}

const BLOCK_CONFIG: Record<
  string,
  {
    title: string
    bounds?: [string, string]
  }
> = {
  'cpu-usage': {title: 'CPU Usage (%)', bounds: ['0', '110']},
  'cpu-idle': {title: 'CPU Idle (%)', bounds: ['0', '110']},
  'cpu-nice': {title: 'CPU Nice (%)', bounds: ['0', '110']},
  'cpu-io-wait': {
    title: 'CPU I/O Wait (%)',
    bounds: ['0', '110'],
  },
  'cpu-steal': {title: 'CPU Steal (%)', bounds: ['0', '110']},
  'cpu-irq': {
    title: 'CPU IRQ (Interrupt Request, %)',
    bounds: ['0', '110'],
  },
  'cpu-soft-irq': {
    title: 'CPU Soft IRQ (Software Interrupt Request, %)',
    bounds: ['0', '110'],
  },
  'cpu-load': {
    title: 'CPU Load',
    bounds: ['0', ''],
  },
}

/** Windows: same flat order as NetworkDetailContent GRID_LAYOUT → 2×2 placement */
const WINDOWS_CPU_GRID = [
  'cpu-usage',
  'cpu-idle',
  'cpu-irq',
  'cpu-soft-irq',
] as const

/** Linux: two stacked 2×2 panels (Network-style matrix per panel) */
const LINUX_CPU_GRID_FIRST = [
  'cpu-usage',
  'cpu-idle',
  'cpu-nice',
  'cpu-io-wait',
] as const

const LINUX_CPU_GRID_SECOND_WITH_LOAD = [
  'cpu-steal',
  'cpu-irq',
  'cpu-soft-irq',
  'cpu-load',
] as const

const LINUX_CPU_GRID_SECOND_NO_LOAD = [
  'cpu-steal',
  'cpu-irq',
  'cpu-soft-irq',
] as const

function resolveAxesForBlock(blockId: string): Axes {
  const bounds = BLOCK_CONFIG[blockId]?.bounds
  if (!bounds) return CPU_USAGE_AXES
  return {...CPU_USAGE_AXES, y: {...CPU_USAGE_AXES.y, bounds}}
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
      id: `cpu-detail-${blockId}`,
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
        graphOptions={CPU_DETAIL_CHART_OPTIONS.graphOptions}
        staticLegend={CPU_DETAIL_CHART_OPTIONS.staticLegend}
        staticLegendPosition={CPU_DETAIL_CHART_OPTIONS.staticLegendPosition}
        staticLegendGap={CPU_DETAIL_CHART_OPTIONS.staticLegendGap}
        axisLabelWidth={CPU_DETAIL_CHART_OPTIONS.axisLabelWidth}
        containerStyle={CPU_DETAIL_CHART_OPTIONS.containerStyle}
        colors={colors}
        tableOptions={DEFAULT_TABLE_OPTIONS}
        fieldOptions={DEFAULT_FIELD_OPTIONS}
        decimalPlaces={CPU_DETAIL_CHART_OPTIONS.decimalPlaces}
        tableGaugeChartOptions={DEFAULT_TABLE_GAUGE_CHART_OPTIONS}
        cellID={`cpu-detail-${blockId}`}
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

export function CpuDetailContent({
  serverContext,
  templates,
}: {
  serverContext: UsageDetailServerContext
  templates: Template[] | null
}) {
  const timeRange = serverContext.timeRange ?? DEFAULT_DETAIL_TIME_RANGE
  const source = serverContext.source
  const host = serverContext.selectedHost
  const detailQueries = (serverContext.detailQueries ?? []).filter(
    q => !q.isSkip
  )
  const detailQueryLabels = new Set(detailQueries.map(q => q.label))
  const isWindowsLayout = !detailQueryLabels.has('cpu-nice')

  const hasCpuLoadQuery = detailQueryLabels.has('cpu-load')

  const renderChartBlocks = (
    blockIds: readonly string[],
    paletteOffset: number,
    options?: {linuxSecondGridNoLoad?: boolean}
  ) =>
    blockIds.map((blockId, i) => {
      const config = BLOCK_CONFIG[blockId]
      if (!config) return null
      const paletteIndex =
        (paletteOffset + i) % LINE_COLOR_PALETTES_SEQUENCE.length
      const colors = LINE_COLOR_PALETTES_SEQUENCE[paletteIndex]
      const queryText = detailQueries.find(q => q.label === blockId)?.query

      let blockClassName: string | undefined
      if (
        options?.linuxSecondGridNoLoad &&
        blockId === 'cpu-soft-irq'
      ) {
        blockClassName = 'process-detail-modal__block--span-cols-2'
      }

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

  if (isWindowsLayout) {
    return (
      <div className="process-detail-modal__body">
        <div className="process-detail-modal__grid process-detail-modal__grid--2x2">
          {renderChartBlocks(WINDOWS_CPU_GRID, 0)}
        </div>
      </div>
    )
  }

  const linuxSecondIds = hasCpuLoadQuery
    ? LINUX_CPU_GRID_SECOND_WITH_LOAD
    : LINUX_CPU_GRID_SECOND_NO_LOAD

  return (
    <div className="process-detail-modal__body">
      <div className="process-detail-modal__grid process-detail-modal__grid--2x2">
        {renderChartBlocks(LINUX_CPU_GRID_FIRST, 0)}
      </div>
      <div className="process-detail-modal__grid process-detail-modal__grid--2x2">
        {renderChartBlocks(linuxSecondIds, LINUX_CPU_GRID_FIRST.length, {
          linuxSecondGridNoLoad: !hasCpuLoadQuery,
        })}
      </div>
    </div>
  )
}
