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

interface DiskMetadata {
  path: string
  device: string
  fstype: string
  mode: string
}

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

const DISK_DETAIL_CHART_OPTIONS = {
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

// Constants removed as they are now handled in the backend queries

const DISK_Y_AXIS = {
  ...FULL_DEFAULT_AXIS,
  suffix: '',
  base: AXES_SCALE_OPTIONS.BASE_RAW,
  avoidScientificNotation: true,
}

// Queries are now fetched from the backend (server-details.json)

const DISK_BASE_AXES: Axes = {
  x: FULL_DEFAULT_AXIS,
  y: DISK_Y_AXIS,
}

const BLOCK_CONFIG: Record<
  string,
  {title: string; blockClassName?: string; isPercent?: boolean; bounds?: [string, string]; yLabel?: string}
> = {
  'disk-io-percent': {title: 'Disk I/O(%)', isPercent: true, bounds: ['0', '100']},
  'disk-iops': {title: 'IOPS Read/Write(ops/s)', bounds: ['0', '']},
  'disk-throughput': {title: 'Disk Bps Read/Write(MiB/s)', bounds: ['0', '']},
  'disk-used-percent': {title: 'Used Space(%)', isPercent: true, bounds: ['0', '100']},
  'disk-used-gib': {title: 'Used Space(GiB)', bounds: ['0', '']},
  'disk-queue-length': {title: 'Queue Length', bounds: ['0', '']},
  'disk-inode-used-percent': {title: 'Inode Used (%)', isPercent: true, bounds: ['0', '100']},
  'disk-free-percent': {title: 'Free Space(%)', isPercent: true, bounds: ['0', '100']},
  'disk-free-gib': {title: 'Free Space(GiB)', bounds: ['0', '']},
}

const GRID_LAYOUT = {
  top: ['disk-io-percent', 'disk-iops', 'disk-throughput'] as const,
  middle: ['disk-used-percent', 'disk-used-gib', 'disk-queue-length'] as const,
  bottom: [
    'disk-inode-used-percent',
    'disk-free-percent',
    'disk-free-gib',
  ] as const,
}

function resolveAxesForBlock(blockId: string): Axes {
  const config = BLOCK_CONFIG[blockId]
  const bounds = config?.bounds
  if (!bounds) return DISK_BASE_AXES
  const yOverrides: Partial<typeof DISK_Y_AXIS> = {bounds}
  if (config?.yLabel) yOverrides.suffix = ` ${config.yLabel}`
  return {...DISK_BASE_AXES, y: {...DISK_BASE_AXES.y, ...yOverrides}}
}

function DetailChartBlock({
  blockId,
  source,
  host,
  timeRange,
  templates,
  colors,
  manualRefresh,
  selectedDisk,
  queryText: originalQueryText,
}: {
  blockId: string
  source: Source | null
  host: string | null
  timeRange: TimeRange
  templates: Template[] | null
  colors: typeof LINE_COLOR_PALETTES_SEQUENCE[number]
  manualRefresh?: number
  selectedDisk?: DiskMetadata | null
  queryText?: string
}) {
  if (!originalQueryText) return null
  let queryText = originalQueryText

  if (selectedDisk) {
    if (queryText.includes('"diskio"')) {
      const deviceName = selectedDisk.device.split('/').pop() || ''
      queryText = queryText.replace('AND "host"=\':host:\'', `AND "host"=':host:' AND "name"='${deviceName}'`)
      queryText = queryText.replace('GROUP BY "name", time(:interval:)', 'GROUP BY time(:interval:)')
    } else if (queryText.includes('"disk"')) {
      queryText = queryText.replace('AND "host"=\':host:\'', `AND "host"=':host:' AND "path"='${selectedDisk.path}'`)
      queryText = queryText.replace('GROUP BY "path", time(:interval:)', 'GROUP BY time(:interval:)')
    }
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
      id: `disk-detail-${blockId}`,
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
        graphOptions={DISK_DETAIL_CHART_OPTIONS.graphOptions}
        staticLegend={DISK_DETAIL_CHART_OPTIONS.staticLegend}
        staticLegendPosition={DISK_DETAIL_CHART_OPTIONS.staticLegendPosition}
        staticLegendGap={DISK_DETAIL_CHART_OPTIONS.staticLegendGap}
        axisLabelWidth={DISK_DETAIL_CHART_OPTIONS.axisLabelWidth}
        containerStyle={DISK_DETAIL_CHART_OPTIONS.containerStyle}
        colors={colors}
        tableOptions={DEFAULT_TABLE_OPTIONS}
        fieldOptions={DEFAULT_FIELD_OPTIONS}
        decimalPlaces={DISK_DETAIL_CHART_OPTIONS.decimalPlaces}
        tableGaugeChartOptions={DEFAULT_TABLE_GAUGE_CHART_OPTIONS}
        cellID={`disk-detail-${blockId}`}
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

export function DiskDetailContent({
  serverContext,
  templates,
}: {
  serverContext: UsageDetailServerContext
  templates: Template[] | null
}) {
  const [availableDisks, setAvailableDisks] = useState<DiskMetadata[]>([])
  const [selectedDiskPath, setSelectedDiskPath] = useState<string>('')
  const [headerPortalTarget, setHeaderPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setHeaderPortalTarget(document.getElementById('usage-detail-modal-header-portal'))
  }, [])

  const timeRange = serverContext.timeRange ?? DEFAULT_DETAIL_TIME_RANGE
  const source = serverContext.source
  const host = serverContext.selectedHost
  const detailQueries = serverContext.detailQueries ?? []


  useEffect(() => {
    if (!source || !host) return
    const fetchDisks = async () => {
      try {
        const hostName = templates?.find(t => t.tempVar === ':host:')?.values?.find((v: any) => v.selected)?.value || host
        const q = [{
          id: 'disk-series',
          text: `SHOW SERIES FROM "disk" WHERE "host"='${hostName}'`,
          db: source.telegraf ?? 'Default',
        }]
        const res = await executeQueries(source, q, [])
        const rawSeries: any[] = (res as any)?.[0]?.value?.results?.[0]?.series?.[0]?.values || []
        const disks: DiskMetadata[] = []
        for (const [seriesStr] of rawSeries) {
          if (typeof seriesStr !== 'string') continue
          const tags = parseSeriesString(seriesStr)
          if (tags.path) {
            disks.push({
              path: tags.path,
              device: tags.device || '',
              fstype: tags.fstype || '',
              mode: tags.mode || ''
            })
          }
        }
        
        const uniqueDisks = Array.from(new Map(disks.map(d => [d.path, d])).values())
        uniqueDisks.sort((a, b) => {
          if (a.path === '/') return -1
          if (b.path === '/') return 1
          return a.path.localeCompare(b.path)
        })

        setAvailableDisks(uniqueDisks)
        if (uniqueDisks.length > 0) {
          setSelectedDiskPath('all')
        }
      } catch (e) {
        console.error('Failed to fetch disks', e)
      }
    }
    fetchDisks()
  }, [source, host, templates])

  const selectedDisk = availableDisks.find(d => d.path === selectedDiskPath) || null

  const renderGridSection = (blockIds: readonly string[], startIndex: number) =>
    blockIds.map((blockId, i) => {
      const config = BLOCK_CONFIG[blockId]
      if (!config) return null
      const paletteIndex =
        (startIndex + i) % LINE_COLOR_PALETTES_SEQUENCE.length
      const colors = LINE_COLOR_PALETTES_SEQUENCE[paletteIndex]
      const queryText = detailQueries.find(q => q.label === blockId)?.query
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
            manualRefresh={serverContext.manualRefresh}
            selectedDisk={selectedDisk}
            queryText={queryText}
          />
        </UsageDetailBlock>
      )
    })

  const diskHeaderContent = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
      {availableDisks.length > 0 ? (
        <div style={{ width: 140, flexShrink: 0 }}>
          <Dropdown
            items={[{text: '전체'}, ...availableDisks.map(d => ({ text: d.path }))]}
            onChoose={(item) => setSelectedDiskPath(item.text === '전체' ? 'all' : item.text)}
            selected={selectedDiskPath === 'all' ? '전체' : selectedDiskPath}
          />
        </div>
      ) : (
         <div style={{ color: '#aaa', fontSize: '13px' }}>Loading disks...</div>
      )}
      {selectedDisk && (
        <div style={{
          display: 'flex', 
          gap: '16px', 
          fontSize: '12px',
          color: '#a0aab8',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          <div><span style={{color: '#6b7a90', paddingRight: '4px'}}>ID:</span><span style={{color: '#e5e8ed'}}>{selectedDisk.device.split('/').pop() || selectedDisk.device}</span></div>
          <div><span style={{color: '#6b7a90', paddingRight: '4px'}}>FS:</span><span style={{color: '#e5e8ed'}}>{selectedDisk.fstype}</span></div>
          <div><span style={{color: '#6b7a90', paddingRight: '4px'}}>Mount:</span><span style={{color: '#e5e8ed'}}>{selectedDisk.path}</span></div>
          <div style={{overflow: 'hidden', textOverflow: 'ellipsis'}} title={selectedDisk.mode}><span style={{color: '#6b7a90', paddingRight: '4px'}}>Opt:</span><span style={{color: '#e5e8ed'}}>{selectedDisk.mode}</span></div>
        </div>
      )}
    </div>
  )

  return (
    <div className="process-detail-modal__body">
      {headerPortalTarget && createPortal(diskHeaderContent, headerPortalTarget)}


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
