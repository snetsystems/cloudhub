import React, {useEffect, useMemo, useState} from 'react'
import type {Source} from 'src/types/sources'
import type {Addon} from 'src/types/auth'
import type {DataTableObject} from 'src/types/tableType'
import RefreshingGraph from 'src/shared/components/RefreshingGraph'
import {CellType, QueryType} from 'src/types'
import type {CellQuery} from 'src/types'
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
import type {Template} from 'src/types'
import type {TimeRange} from 'src/types'
import {
  buildDetailTemplates,
  DEFAULT_DETAIL_TIME_RANGE,
} from 'src/server_details/components/UsageDetailModal/utils'

const PROCESS_DETAIL_CHART_QUERIES: Record<string, string> = {
  cpu: `SELECT sum("cpu_usage_pct") AS "CPU"
FROM ":db:".":rp:"."procstat_top"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:' AND "process_name"=':process_name:'
GROUP BY time(:interval:)
FILL(null)`,
  memory: `SELECT sum("memory_usage_pct") AS "Memory"
FROM ":db:".":rp:"."procstat_top"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:' AND "process_name"=':process_name:'
GROUP BY time(:interval:)
FILL(null)`,
  io: `SELECT mean("io_read_bps") AS "mean_io_read_bps", mean("io_write_bps") AS "mean_io_write_bps", mean("io_total_bps") AS "Process I/O"
FROM ":db:".":rp:"."procstat_top"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "host"=':host:' AND "process_name"=':process_name:' AND "user"=':user:'
GROUP BY "host", "process_name", "user", time(:interval:)
FILL(null)`,
}

export interface ProcessDetailServerDetail {
  selectedHost: string | null
  source: Source | null
  addons?: Addon[]
  timeRange?: TimeRange
}

interface ProcessDetailModalProps {
  isOpen: boolean
  onClose: () => void
  serverDetail: ProcessDetailServerDetail
  nameInfo: DataTableObject | null
}

const PROCESS_DETAIL_CHART_OPTIONS = {
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

const PROCESS_axes: Axes = {
  x: FULL_DEFAULT_AXIS,
  y: {
    ...FULL_DEFAULT_AXIS,
    suffix: '',
    base: AXES_SCALE_OPTIONS.BASE_RAW,
  },
}

const BLOCK_CONFIG: Record<
  string,
  {title: string; bounds?: [string, string]; suffix?: string}
> = {
  cpu: {title: 'CPU (%)', bounds: ['0', '100'], suffix: '%'},
  memory: {title: 'Memory (%)', bounds: ['0', '100'], suffix: '%'},
  io: {
    title: 'Process I/O(bps)',
    bounds: ['0', ''],
    suffix: 'bps',
  },
}

function ProcessDetailBlock({
  title,
  children,
}: {
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="process-detail-modal__block">
      <h3 className="process-detail-modal__block-title">{title}</h3>
      <div className="process-detail-modal__block-content">{children}</div>
    </div>
  )
}

function ProcessDetailChartBlock({
  blockId,
  source,
  host,
  processName,
  timeRange,
  templates,
  colors,
}: {
  blockId: string
  source: Source | null
  host: string | null
  processName: string | null
  timeRange: TimeRange
  templates: Template[] | null
  colors: typeof LINE_COLOR_PALETTES_SEQUENCE[number]
}) {
  const queryText = PROCESS_DETAIL_CHART_QUERIES[blockId]

  if (!queryText) return null

  if (!source) {
    return (
      <div className="process-detail-modal__placeholder">
        Source가 없습니다.
      </div>
    )
  }

  if (!host || !processName || !templates) {
    return (
      <div className="process-detail-modal__placeholder">
        프로세스를 선택하세요.
      </div>
    )
  }

  const config = BLOCK_CONFIG[blockId]
  const axes: Axes = config?.bounds
    ? {...PROCESS_axes, y: {...PROCESS_axes.y, bounds: config.bounds}}
    : PROCESS_axes

  const queries: CellQuery[] = [
    {
      query: queryText,
      text: queryText,
      id: `process-detail-${blockId}`,
      type: QueryType.InfluxQL,
      queryConfig: null as CellQuery['queryConfig'],
      source: source.id,
    },
  ]

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
        graphOptions={PROCESS_DETAIL_CHART_OPTIONS.graphOptions}
        staticLegend={PROCESS_DETAIL_CHART_OPTIONS.staticLegend}
        staticLegendPosition={PROCESS_DETAIL_CHART_OPTIONS.staticLegendPosition}
        staticLegendGap={PROCESS_DETAIL_CHART_OPTIONS.staticLegendGap}
        axisLabelWidth={PROCESS_DETAIL_CHART_OPTIONS.axisLabelWidth}
        containerStyle={PROCESS_DETAIL_CHART_OPTIONS.containerStyle}
        colors={colors}
        tableOptions={DEFAULT_TABLE_OPTIONS}
        fieldOptions={DEFAULT_FIELD_OPTIONS}
        decimalPlaces={PROCESS_DETAIL_CHART_OPTIONS.decimalPlaces}
        tableGaugeChartOptions={DEFAULT_TABLE_GAUGE_CHART_OPTIONS}
        cellID={`process-detail-${blockId}`}
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

function ProcessDetailModal({
  isOpen,
  onClose,
  serverDetail,
  nameInfo,
}: ProcessDetailModalProps) {
  const [isMounted, setIsMounted] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(isOpen)

  const timeRange = serverDetail.timeRange ?? DEFAULT_DETAIL_TIME_RANGE
  const source = serverDetail.source
  const host = serverDetail.selectedHost
  const processName = (nameInfo?.process_name as string) ?? null
  const user = (nameInfo?.user as string) ?? ''

  const templates = useMemo(() => {
    if (!source || !host || !processName) return null
    return buildDetailTemplates(source, timeRange, host, processName, user)
  }, [source, timeRange, host, processName, user])

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true)
      requestAnimationFrame(() => setIsVisible(true))
      return
    }
    setIsVisible(false)
    const timeoutId = setTimeout(() => setIsMounted(false), 250)
    return () => clearTimeout(timeoutId)
  }, [isOpen])

  if (!isMounted) return null

  const chartBlocks = ['cpu', 'memory', 'io'] as const

  return (
    <>
      <div
        className={`modal-wrapper ${
          isVisible ? 'modal-wrapper--open' : 'modal-wrapper--closing'
        }`}
        onClick={onClose}
        onKeyDown={e => e.key === 'Escape' && onClose()}
        role="presentation"
      />
      <div
        className={`modal-content process-detail-modal ${
          isVisible ? 'modal-content--open' : 'modal-content--closing'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="process-detail-modal-title"
      >
        <div className="process-detail-modal__header">
          <h2
            id="process-detail-modal-title"
            className="process-detail-modal__title"
          >
            프로세스 상세 {processName ? `- ${processName}` : ''}
          </h2>
        </div>
        <div className="process-detail-modal__scroll">
          <div className="process-detail-modal__body">
            <div className="process-detail-modal__grid process-detail-modal__grid--stacked">
              {chartBlocks.map((blockId, i) => {
                const config = BLOCK_CONFIG[blockId]
                const colors =
                  LINE_COLOR_PALETTES_SEQUENCE[
                    i % LINE_COLOR_PALETTES_SEQUENCE.length
                  ]
                return (
                  <ProcessDetailBlock
                    key={blockId}
                    title={config?.title ?? blockId}
                  >
                    <ProcessDetailChartBlock
                      blockId={blockId}
                      source={source}
                      host={host}
                      processName={processName}
                      timeRange={timeRange}
                      templates={templates}
                      colors={colors}
                    />
                  </ProcessDetailBlock>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default ProcessDetailModal
