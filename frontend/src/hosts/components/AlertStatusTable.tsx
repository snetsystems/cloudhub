import React, {useState, useEffect, useMemo} from 'react'
import {Source, Template} from 'src/types'
import {executeQueries} from 'src/shared/apis/query'
import {generateForHosts} from 'src/utils/tempVars'
import {alertStatusQueries} from 'src/hosts/constants/alertStatusQueries'
import {alertStatusColumns} from 'src/hosts/constants/alertStatusColumns'
import TableComponent from 'src/device_management/components/TableComponent'
import {Radio, ButtonShape} from 'src/reusable_ui'
import {DEFAULT_LINE_COLORS} from 'src/shared/constants/graphColorPalettes'
import type {Cell, AnnotationViewer} from 'src/types'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import {CellType} from 'src/types/dashboards'
import {TemplateType, TemplateValueType} from 'src/types/tempVars'

interface Props {
  source: Source
  host: string
  time: string // ISO string timestamp of the alert
}

const AlertStatusTable = ({source, host, time}: Props) => {
  const [chartMode, setChartMode] = useState<'gauge' | 'trend'>('gauge')
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [tableData, setTableData] = useState<any[]>([])
  const [trendCells, setTrendCells] = useState<Cell[]>([])

  const targetTimeMs = useMemo(() => new Date(time).getTime(), [time])
  const windowRangeMs = 5 * 60 * 1000

  // Standard templates for LayoutRenderer
  const sharedTemplates: Template[] = useMemo(() => {
    const lower = new Date(targetTimeMs - windowRangeMs).toISOString()
    const upper = new Date(targetTimeMs + windowRangeMs).toISOString()

    return [
      ...generateForHosts(source),
      {
        tempVar: ':host:',
        id: 'host',
        type: TemplateType.Constant,
        label: '',
        values: [
          {
            value: host,
            type: TemplateValueType.Constant,
            selected: true,
            localSelected: true,
          },
        ],
      },
      {
        tempVar: ':interval:',
        id: 'interval',
        type: TemplateType.Constant,
        label: '',
        values: [
          {
            value: '10s',
            type: TemplateValueType.Constant,
            selected: true,
            localSelected: true,
          },
        ],
      },
      {
        tempVar: ':dashboardTime:',
        id: 'dashboardTime',
        type: TemplateType.Constant,
        label: '',
        values: [
          {
            value: `'${lower}'`,
            type: TemplateValueType.Constant,
            selected: true,
            localSelected: true,
          },
        ],
      },
      {
        tempVar: ':upperDashboardTime:',
        id: 'upperDashboardTime',
        type: TemplateType.Constant,
        label: '',
        values: [
          {
            value: `'${upper}'`,
            type: TemplateValueType.Constant,
            selected: true,
            localSelected: true,
          },
        ],
      },
    ]
  }, [source, host, targetTimeMs])

  useEffect(() => {
    fetchData()
  }, [host, time])

  const fetchData = async () => {
    setIsLoading(true)
    setIsError(false)

    try {
      const results: any[] = await executeQueries(
        source,
        alertStatusQueries,
        sharedTemplates
      )

      let parsedRow: any = {host}
      let disksArray: any[] = []
      let diskIosArray: any[] = []
      let netsArray: any[] = []

      let validCpuQuery = ''
      let validMemQuery = ''
      let validDiskQuery = ''
      let validDiskIoQuery = ''
      let validNetQuery = ''
      let isWinOs = false

      results.forEach((res, idx) => {
        if (!res || !res.value) return
        const qOriginal = alertStatusQueries[idx]
        const id = qOriginal.id
        const series = res.value.results?.[0]?.series ?? []

        series.forEach((s: any) => {
          const cols = s.columns || []
          const vals = s.values || []

          if (vals.length === 0) return

          // find closest point to target time for Gauge (snapshot)
          let closestRow =
            vals.find((v: any[]) =>
              v.some((val: any, idx: number) => idx > 0 && val !== null)
            ) || vals[0]
          let minDiff = Infinity
          vals.forEach((v: any[]) => {
            const hasData = v.some(
              (val: any, idx: number) => idx > 0 && val !== null
            )
            if (!hasData) return

            const vTime = new Date(v[0]).getTime()
            const diff = Math.abs(vTime - targetTimeMs)
            if (diff < minDiff) {
              minDiff = diff
              closestRow = v
            }
          })

          const getVal = (row: any[], colName: string) => {
            const idx = cols.indexOf(colName)
            return idx >= 0 ? row[idx] : null
          }

          if (
            id === 'alert-cpu' ||
            id === 'alert-win-cpu' ||
            id === 'alert-system' ||
            id === 'alert-win-system'
          ) {
            const usage_total = getVal(closestRow, 'usage_total')
            if (usage_total !== null) parsedRow.cpu_usage_total = usage_total

            const usage_user = getVal(closestRow, 'usage_user')
            if (usage_user !== null) parsedRow.cpu_usage_user = usage_user

            const usage_system = getVal(closestRow, 'usage_system')
            if (usage_system !== null) parsedRow.cpu_usage_system = usage_system

            const queue_length = getVal(closestRow, 'queue_length')
            if (queue_length !== null) parsedRow.queue_length = queue_length

            if (id === 'alert-cpu' || id === 'alert-win-cpu') {
              validCpuQuery = qOriginal.text
              if (id.includes('win')) isWinOs = true
            }
          }

          if (id === 'alert-mem' || id === 'alert-win-mem') {
            const used_percent = getVal(closestRow, 'used_percent')
            if (used_percent !== null) parsedRow.mem_used_percent = used_percent

            const used = getVal(closestRow, 'used')
            if (used !== null) parsedRow.mem_used = used

            const free = getVal(closestRow, 'free')
            if (free !== null) parsedRow.mem_free = free

            const cached = getVal(closestRow, 'cached')
            if (cached !== null) parsedRow.mem_cached = cached

            const pagefaults = getVal(closestRow, 'pagefaults')
            if (pagefaults !== null) parsedRow.mem_pagefaults = pagefaults

            const pool_paged = getVal(closestRow, 'pool_paged')
            if (pool_paged !== null) parsedRow.mem_pool_paged = pool_paged

            const pool_nonpaged = getVal(closestRow, 'pool_nonpaged')
            if (pool_nonpaged !== null)
              parsedRow.mem_pool_nonpaged = pool_nonpaged

            validMemQuery = qOriginal.text
          }

          if (id === 'alert-swap' || id === 'alert-win-swap') {
            const percent = getVal(closestRow, 'swap_used_percent')
            if (percent !== null) parsedRow.swap_used_percent = percent
            const used = getVal(closestRow, 'swap_used')
            if (used !== null) parsedRow.swap_used = used
          }

          if (id === 'alert-disk' || id === 'alert-win-disk') {
            const path = s.tags?.path || s.tags?.instance || 'Unknown'
            const usage = getVal(closestRow, 'Disk Usage')
            if (usage !== null) {
              if (!disksArray.some(d => d.path === path)) {
                disksArray.push({path, usage})
              }
            }
            validDiskQuery = qOriginal.text
          }

          if (id === 'alert-disk-io' || id === 'alert-win-disk-io') {
            const device =
              s.tags?.mount_path ||
              s.tags?.instance ||
              s.tags?.name ||
              'Unknown'
            const diskIo = getVal(closestRow, 'Disk I/O %')
            if (diskIo !== null) {
              if (!diskIosArray.some(d => d.device === device)) {
                diskIosArray.push({device, usage: diskIo})
              }
            }
            validDiskIoQuery = qOriginal.text
            if (id.includes('win')) isWinOs = true
          }

          if (id === 'alert-net' || id === 'alert-win-net') {
            const iface = s.tags?.interface || s.tags?.instance || 'Unknown'
            const traff = getVal(closestRow, 'traffic')
            if (traff !== null) {
              if (!netsArray.some(n => n.interface === iface)) {
                netsArray.push({interface: iface, traffic: traff})
              }
            }
            validNetQuery = qOriginal.text
          }
        })
      })

      parsedRow.disks = disksArray

      const maxDiskIo =
        diskIosArray.sort((a, b) => b.usage - a.usage)[0] ?? null
      parsedRow.diskIo = maxDiskIo
      const top5Nets = netsArray
        .sort((a, b) => b.traffic - a.traffic)
        .slice(0, 5)
      parsedRow.networks = top5Nets

      if (maxDiskIo && validDiskIoQuery) {
        const tagKey = isWinOs ? 'instance' : 'mount_path'
        validDiskIoQuery = validDiskIoQuery.replace(
          'GROUP BY',
          `AND "${tagKey}"='${maxDiskIo.device}'\nGROUP BY`
        )
      }

      // Filter line chart queries for Network to only show top 5
      if (top5Nets.length > 0 && validNetQuery) {
        const tagKey = isWinOs ? 'instance' : 'interface'
        const conditions = top5Nets
          .map(n => `"${tagKey}"='${n.interface}'`)
          .join(' OR ')
        validNetQuery = validNetQuery.replace(
          'GROUP BY',
          `AND (${conditions})\nGROUP BY`
        )
      }

      const emptyAxes = {
        x: {
          bounds: ['', ''] as [string, string],
          label: '',
          prefix: '',
          suffix: '',
          base: '10',
          scale: 'linear',
        },
        y: {
          bounds: ['', ''] as [string, string],
          label: '',
          prefix: '',
          suffix: '',
          base: '10',
          scale: 'linear',
        },
      }

      const createCell = (
        cid: string,
        name: string,
        queryStr: string,
        index: number
      ): Cell => {
        const x = (index % 2) * 48
        const y = Math.floor(index / 2) * 20
        return {
          i: cid,
          x,
          y,
          w: 48,
          h: 35,
          minW: 10,
          minH: 10,
          name,
          type: CellType.Line,
          note: '',
          noteVisibility: 'default' as any,
          tableOptions: {
            verticalTimeAxis: true,
            sortBy: {internalName: 'time', displayName: '', visible: true},
            fixFirstColumn: false,
          },
          fieldOptions: [],
          timeFormat: 'YYYY-MM-DD HH:mm:ss',
          decimalPlaces: {isEnforced: false, digits: 2},
          links: {self: ''},
          legend: {type: 'static', orientation: 'bottom'},
          inView: true,
          // Use queryConfig.rawText to bypass automatic WHERE appendage in buildQueriesForLayouts
          queries: [
            {
              query: queryStr,
              type: 'influxql',
              queryConfig: {rawText: queryStr} as any,
              source: '',
            },
          ],
          axes: emptyAxes,
          colors: DEFAULT_LINE_COLORS,
          graphOptions: {
            fillArea: true,
            showLine: true,
            showPoint: false,
            showTempVarCount: '',
          },
        }
      }

      const newTrendCells: Cell[] = []
      if (validCpuQuery)
        newTrendCells.push(
          createCell('c-cpu', 'CPU Usage (Total)', validCpuQuery, 0)
        )
      if (validMemQuery)
        newTrendCells.push(createCell('c-mem', 'Memory Used', validMemQuery, 1))
      if (validDiskQuery)
        newTrendCells.push(
          createCell('c-disk', 'Disk Usage', validDiskQuery, 2)
        )
      if (validDiskIoQuery)
        newTrendCells.push(
          createCell('c-disk-io', 'Disk I/O', validDiskIoQuery, 3)
        )
      if (validNetQuery)
        newTrendCells.push(
          createCell(
            'c-net',
            'Network Traffic',
            validNetQuery,
            validDiskIoQuery ? 4 : 3
          )
        )

      setTrendCells(newTrendCells)
      setTableData([parsedRow])
      setIsLoading(false)
    } catch (e) {
      console.error(e)
      setIsError(true)
      setIsLoading(false)
    }
  }

  const columns = useMemo(() => alertStatusColumns(), [])

  const annotationView: AnnotationViewer[] = useMemo(
    () => [
      {
        id: 'alert-trigger',
        startTime: targetTimeMs,
        endTime: targetTimeMs,
        text: 'Alert Triggered',
      },
    ],
    [targetTimeMs]
  )

  return (
    <div className="alert-status-table">
      <div className="alert-status-table--toggle">
        <Radio shape={ButtonShape.Default}>
          <Radio.Button
            id="alert-chart-mode-gauge"
            titleText="Gauge"
            value="gauge"
            active={chartMode === 'gauge'}
            onClick={() => setChartMode('gauge')}
          >
            Gauge
          </Radio.Button>
          <Radio.Button
            id="alert-chart-mode-trend"
            titleText="Trend"
            value="trend"
            active={chartMode === 'trend'}
            onClick={() => setChartMode('trend')}
          >
            Trend
          </Radio.Button>
        </Radio>
      </div>

      {isLoading && (
        <div className="alert-status-table--loading">Loading metrics...</div>
      )}
      {isError && (
        <div className="alert-status-table--error">Error loading data.</div>
      )}

      {!isLoading && !isError && chartMode === 'gauge' && (
        <div className="alert-status-table--gauge-wrapper">
          <TableComponent
            data={tableData}
            columns={columns}
            isLoading={false}
            isSearchDisplay={false}
            isDotKey={false}
          />
        </div>
      )}

      {!isLoading && !isError && chartMode === 'trend' && (
        <div className="alert-status-table--trend-wrapper">
          {trendCells.length > 0 && (
            <LayoutRenderer
              source={source}
              cells={trendCells}
              timeRange={{
                lower: new Date(targetTimeMs - windowRangeMs).toISOString(),
                upper: new Date(targetTimeMs + windowRangeMs).toISOString(),
              }}
              templates={sharedTemplates}
              sources={[source]}
              host={host}
              manualRefresh={0}
              isStatusPage={false}
              isStaticPage={true}
              isEditable={false}
              isUsingAnnotationViewer={true}
              annotationsViewMode={annotationView}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default AlertStatusTable
