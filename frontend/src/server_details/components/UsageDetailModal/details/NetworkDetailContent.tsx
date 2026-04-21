import React, {useState, useEffect} from 'react'
import {createPortal} from 'react-dom'
import Dropdown from 'src/shared/components/Dropdown'
import {executeQueries} from 'src/shared/apis/query'
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

function parseSeriesString(series: string): Record<string, string> {
  const parts = series.substring(series.indexOf(',') + 1)
  const tags: Record<string, string> = {}
  let currentKey = ''
  let currentValue = ''
  let inValue = false
  for (let i = 0; i < parts.length; i++) {
    const char = parts[i]
    if (char === '\\' && parts[i + 1] === ',') {
      currentValue += ','
      i++
      continue
    }
    if (char === '=' && !inValue) {
      inValue = true
      continue
    }
    if (char === ',' && inValue) {
      tags[currentKey] = currentValue
      currentKey = ''
      currentValue = ''
      inValue = false
      continue
    }
    if (inValue) {
      currentValue += char
    } else {
      currentKey += char
    }
  }
  if (currentKey && inValue) {
    tags[currentKey] = currentValue
  }
  return tags
}

// BYTES_PER_MIB removed as it is now handled in the backend queries

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

// Queries are now fetched from the backend (server-details.json)

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
  selectedInterface,
  queryText: originalQueryText,
}: {
  blockId: string
  source: Source | null
  host: string | null
  timeRange: TimeRange
  templates: Template[] | null
  colors: typeof LINE_COLOR_PALETTES_SEQUENCE[number]
  manualRefresh?: number
  selectedInterface?: string | null
  queryText?: string
}) {
  if (!originalQueryText) return null
  let queryText = originalQueryText

  if (selectedInterface && selectedInterface !== 'all') {
    queryText = queryText.replace('AND "host"=\':host:\'', `AND "host"=':host:' AND "interface"='${selectedInterface}'`)
  }

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
  const [availableInterfaces, setAvailableInterfaces] = useState<string[]>([])
  const [selectedInterface, setSelectedInterface] = useState<string>('')
  const [headerPortalTarget, setHeaderPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setHeaderPortalTarget(document.getElementById('usage-detail-modal-header-portal'))
  }, [])

  const timeRange = serverContext.timeRange ?? DEFAULT_DETAIL_TIME_RANGE
  const source = serverContext.source
  const host = serverContext.selectedHost
  const detailQueries = (serverContext.detailQueries ?? []).filter(
    q => !q.isSkip
  )


  useEffect(() => {
    if (!source || !host) return
    const fetchInterfaces = async () => {
      try {
        const hostName = templates?.find(t => t.tempVar === ':host:')?.values?.find((v: any) => v.selected)?.value || host
        const q = [{
          id: 'net-series',
          text: `SHOW SERIES FROM "net" WHERE "host"='${hostName}'`,
          db: source.telegraf ?? 'Default',
        }]
        const res = await executeQueries(source, q, [])
        const rawSeries: any[] = (res as any)?.[0]?.value?.results?.[0]?.series?.[0]?.values || []
        const interfaces = new Set<string>()
        for (const [seriesStr] of rawSeries) {
          if (typeof seriesStr !== 'string') continue
          const tags = parseSeriesString(seriesStr)
          if (tags.interface && tags.interface !== 'all') {
            interfaces.add(tags.interface)
          }
        }
        
        const sortedInterfaces = Array.from(interfaces).sort()
        setAvailableInterfaces(sortedInterfaces)
        if (sortedInterfaces.length > 0) {
          setSelectedInterface('all')
        }
      } catch (e) {
        console.error('Failed to fetch interfaces', e)
      }
    }
    fetchInterfaces()
  }, [source, host, templates])

  const networkHeaderContent = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
      {availableInterfaces.length > 0 ? (
        <div style={{ width: 140, flexShrink: 0 }}>
          <Dropdown
            items={[{text: '전체'}, ...availableInterfaces.map(i => ({ text: i }))]}
            onChoose={(item) => setSelectedInterface(item.text === '전체' ? 'all' : item.text)}
            selected={selectedInterface === 'all' ? '전체' : selectedInterface}
          />
        </div>
      ) : (
         <div style={{ color: '#aaa', fontSize: '13px' }}>Loading interfaces...</div>
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
          const queryText = detailQueries.find(q => q.label === blockId)?.query
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
                selectedInterface={selectedInterface}
                queryText={queryText}
              />
            </UsageDetailBlock>
          )
        })}
      </div>
    </div>
  )
}
