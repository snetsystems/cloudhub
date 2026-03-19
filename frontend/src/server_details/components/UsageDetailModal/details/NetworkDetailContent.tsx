import React, {useState, useEffect} from 'react'
import {createPortal} from 'react-dom'
import Dropdown from 'src/shared/components/Dropdown'
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

const BYTES_PER_MIB = 1048576

const NETWORK_Y_AXIS = {
  ...FULL_DEFAULT_AXIS,
  suffix: '',
  base: AXES_SCALE_OPTIONS.BASE_RAW,
  avoidScientificNotation: true,
}

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

const NETWORK_BASE_AXES: Axes = {
  x: FULL_DEFAULT_AXIS,
  y: NETWORK_Y_AXIS,
}


const BLOCK_CONFIG: Record<
  string,
  {title: string; bounds: [string, string]}
> = {
  'traffic-in-out': {title: 'Traffic In/Out (MiB/s)', bounds: ['0', '']},
  'packet-in-out': {title: 'Packet In/Out (/s)', bounds: ['0', '']},
  'error-in-out': {title: 'Error In/Out (/s)', bounds: ['0', '']},
  'dropped-in-out': {title: 'Dropped In/Out (/s)', bounds: ['0', '']},
}

const GRID_LAYOUT = [
  'traffic-in-out',
  'packet-in-out',
  'error-in-out',
  'dropped-in-out',
] as const

function resolveAxesForBlock(blockId: string): Axes {
  const bounds = BLOCK_CONFIG[blockId]?.bounds
  if (!bounds) return NETWORK_BASE_AXES
  return {...NETWORK_BASE_AXES, y: {...NETWORK_BASE_AXES.y, bounds}}
}

function DetailChartBlock({
  blockId,
  source,
  host,
  timeRange,
  templates,
  colors,
  manualRefresh,
}: {
  blockId: string
  source: Source | null
  host: string | null
  timeRange: TimeRange
  templates: Template[] | null
  colors: typeof LINE_COLOR_PALETTES_SEQUENCE[number]
  manualRefresh?: number
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
      id: `network-detail-${blockId}`,
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
        manualRefresh={manualRefresh}
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
  const [selectedInterface, setSelectedInterface] = useState<string>('all')
  const [headerPortalTarget, setHeaderPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setHeaderPortalTarget(document.getElementById('usage-detail-modal-header-portal'))
  }, [])

  const MOCK_INTERFACES = [
    { name: 'eth0', mac: '00:1A:2B:3C:4D:5E', ip: '192.168.1.10', status: 'UP' },
    { name: 'docker0', mac: '02:42:04:8b:0a:32', ip: '172.17.0.1', status: 'UP' },
    { name: 'lo', mac: '00:00:00:00:00:00', ip: '127.0.0.1', status: 'UNKNOWN' },
  ]

  const timeRange = serverContext.timeRange ?? DEFAULT_DETAIL_TIME_RANGE
  const source = serverContext.source
  const host = serverContext.selectedHost

  const selectedIf = MOCK_INTERFACES.find(i => i.name === selectedInterface) || null

  const networkHeaderContent = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
      <div style={{ width: 140, flexShrink: 0 }}>
        <Dropdown
          items={[{text: '전체'}, ...MOCK_INTERFACES.map(i => ({ text: i.name }))]}
          onChoose={(item) => setSelectedInterface(item.text === '전체' ? 'all' : item.text)}
          selected={selectedInterface === 'all' ? '전체' : selectedInterface}
        />
      </div>
      {selectedIf && (
        <div style={{
          display: 'flex', 
          gap: '16px', 
          fontSize: '12px',
          color: '#a0aab8',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          <div><span style={{color: '#6b7a90', paddingRight: '4px'}}>MAC:</span><span style={{color: '#e5e8ed'}}>{selectedIf.mac}</span></div>
          <div><span style={{color: '#6b7a90', paddingRight: '4px'}}>IP:</span><span style={{color: '#e5e8ed'}}>{selectedIf.ip}</span></div>
          <div><span style={{color: '#6b7a90', paddingRight: '4px'}}>Status:</span><span style={{color: '#e5e8ed'}}>{selectedIf.status}</span></div>
        </div>
      )}
    </div>
  )

  return (
    <div className="process-detail-modal__body">
      {headerPortalTarget && createPortal(networkHeaderContent, headerPortalTarget)}
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
                manualRefresh={serverContext.manualRefresh}
              />
            </UsageDetailBlock>
          )
        })}
      </div>
    </div>
  )
}
