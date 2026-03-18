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

const BLOCK_QUERIES: Record<string, string> = {
  'cpu-usage': `SELECT mean("usage_system") AS "system", mean("usage_user") AS "user"
FROM ":db:".":rp:"."cpu"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "cpu"='cpu-total' AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'cpu-idle': `SELECT mean("usage_idle") AS "idle"
FROM ":db:".":rp:"."cpu"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "cpu"='cpu-total' AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'cpu-nice': `SELECT mean("usage_nice") AS "nice"
FROM ":db:".":rp:"."cpu"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "cpu"='cpu-total' AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'cpu-io-wait': `SELECT mean("usage_iowait") AS "iowait"
FROM ":db:".":rp:"."cpu"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "cpu"='cpu-total' AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'cpu-steal': `SELECT mean("usage_steal") AS "steal"
FROM ":db:".":rp:"."cpu"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "cpu"='cpu-total' AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'cpu-irq': `SELECT mean("usage_irq") AS "irq"
FROM ":db:".":rp:"."cpu"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "cpu"='cpu-total' AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'cpu-soft-irq': `SELECT mean("usage_softirq") AS "softirq"
FROM ":db:".":rp:"."cpu"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "cpu"='cpu-total' AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,

  'cpu-load': `SELECT mean("load1") AS "load1", mean("load5") AS "load5", mean("load15") AS "load15"
FROM ":db:".":rp:"."system"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:'
GROUP BY time(:interval:)
FILL(null)`,
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
const CPU_BLOCK_AXES: Record<string, Axes> = {
  'cpu-usage': CPU_USAGE_AXES,
  'cpu-idle': CPU_USAGE_AXES,
  'cpu-nice': CPU_USAGE_AXES,
  'cpu-io-wait': CPU_USAGE_AXES,
  'cpu-steal': CPU_USAGE_AXES,
  'cpu-irq': CPU_USAGE_AXES,
  'cpu-soft-irq': CPU_USAGE_AXES,
}

const BLOCK_CONFIG: Record<
  string,
  {title: string; blockClassName?: string; autoScale?: boolean; isPercent?: boolean}
> = {
  'cpu-usage': {title: 'CPU Usage (%)', autoScale: false, isPercent: true},
  'cpu-idle': {title: 'CPU Idle (%)', autoScale: false, isPercent: true},
  'cpu-nice': {title: 'CPU Nice (%)', autoScale: false, isPercent: true},
  'cpu-io-wait': {title: 'CPU I/O Wait (%)', autoScale: false, isPercent: true},
  'cpu-steal': {title: 'CPU Steal (%)', autoScale: false, isPercent: true},
  'cpu-irq': {title: 'CPU IRQ (Interrupt Request, %)', autoScale: false, isPercent: true},
  'cpu-soft-irq': {
    title: 'CPU Soft IRQ (Software Interrupt Request, %)',
    autoScale: false,
    isPercent: true,
  },
  'cpu-load': {
    title: 'CPU Load',
    blockClassName: 'process-detail-modal__block--span-2',
    autoScale: true,
  },
}

const GRID_LAYOUT = {
  top: ['cpu-usage', 'cpu-idle', 'cpu-nice'] as const,
  middle: ['cpu-io-wait', 'cpu-steal', 'cpu-irq'] as const,
  bottom: ['cpu-soft-irq', 'cpu-load'] as const,
}

function resolveAxesForBlock(blockId: string, autoScale: boolean): Axes {
  const baseAxes = CPU_BLOCK_AXES[blockId] ?? CPU_DETAIL_CHART_OPTIONS.axes
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
      id: `cpu-detail-${blockId}`,
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
