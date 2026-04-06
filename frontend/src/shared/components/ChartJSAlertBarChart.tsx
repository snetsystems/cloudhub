//Library
import React, {useEffect, useState, useMemo, useRef, MouseEvent} from 'react'
import {Bar, getElementAtEvent} from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import moment from 'moment'
import {v4 as uuidv4} from 'uuid'

//API
import {proxy} from 'src/utils/queryUrlGenerator'

//Types
import {INPUT_TIME_TYPE} from 'src/types'
import {TimeRange} from 'src/types/queries'

export function buildAlertHistogramTimeWhere(
  timeRange?: TimeRange | null
): string {
  if (!timeRange?.lower) {
    return 'time > now() - 30d'
  }
  if (timeRange.format === INPUT_TIME_TYPE.TIMESTAMP) {
    const upperClause =
      timeRange.upper && timeRange.upper !== 'now()'
        ? ` AND time <= '${timeRange.upper}'`
        : ' AND time <= now()'
    return `time >= '${timeRange.lower}'${upperClause}`
  }
  if (timeRange.upper) {
    return `time >= '${timeRange.lower}' AND time <= '${timeRange.upper}'`
  }
  return `time >= ${timeRange.lower} AND time <= ${timeRange.upper ?? 'now()'}`
}
import {Cell} from 'src/types/dashboards'
import {Source} from 'src/types/sources'

//Utils
import {DEFAULT_CELL_BG_COLOR} from 'src/dashboards/constants'
import {convertTimeFormat} from 'src/utils/timeSeriesTransformers'
import {stableSelectionPlugin} from 'src/shared/utils/esChart'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  stableSelectionPlugin
)

export interface ChartJSAlertBarChartProps {
  cell: Cell
  source: Source
  timeZone?: string
  queryTimeRange?: TimeRange | null
  histogramDate?: TimeRange | null
  onDateClick?: (timeRange: TimeRange) => void
  onDateRangeSelect?: (timeRange: TimeRange) => void
  onDateClear?: () => void
  onLoadingChange?: (loading: boolean) => void
}

export const ChartJSAlertBarChart = ({
  cell,
  source,
  queryTimeRange,
  histogramDate,
  onDateClick,
  onDateRangeSelect,
  onDateClear,
  onLoadingChange,
  timeZone = 'UTC',
}: ChartJSAlertBarChartProps) => {
  const chartRef = useRef<ChartJS<'bar', [], unknown>>(null)
  const hadChartDataRef = useRef(false)
  const staleChartIdentityRef = useRef('')
  const [data, setData] = useState<
    {time: string; CRITICAL: number; WARNING: number; OK: number}[]
  >([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<number[]>([])
  const [dragEndTime, setDragEndTime] = useState(0)

  const queryTimeKey = [
    queryTimeRange?.lower,
    queryTimeRange?.upper ?? '',
    queryTimeRange?.format ?? '',
  ].join('|')

  useEffect(() => {
    setActive([])
  }, [queryTimeKey])

  useEffect(() => {
    if (histogramDate === null) {
      setActive([])
    }
  }, [histogramDate])

  const handleClickDate = (time: number) => {
    if (!onDateClick) return

    const oneDayLater = time + 86400000
    const timeRange: TimeRange =
      timeZone === 'UTC'
        ? {
            lower: convertTimeFormat(time),
            upper: convertTimeFormat(oneDayLater),
            format: INPUT_TIME_TYPE.TIMESTAMP,
          }
        : {
            lower: convertTimeFormat(moment(time).format('YYYY-MM-DD')),
            upper: convertTimeFormat(moment(oneDayLater).format('YYYY-MM-DD')),
            format: INPUT_TIME_TYPE.TIMESTAMP,
          }

    onDateClick(timeRange)
  }

  const handleDragDateRange = (startTime: number, endTime: number) => {
    if (!onDateRangeSelect) return

    const endTimePlusOneDay = endTime + 86400000

    const timeRange: TimeRange =
      timeZone === 'UTC'
        ? {
            lower: convertTimeFormat(startTime),
            upper: convertTimeFormat(endTimePlusOneDay),
            format: INPUT_TIME_TYPE.TIMESTAMP,
          }
        : {
            lower: convertTimeFormat(moment(startTime).format('YYYY-MM-DD')),
            upper: convertTimeFormat(
              moment(endTimePlusOneDay).format('YYYY-MM-DD')
            ),
            format: INPUT_TIME_TYPE.TIMESTAMP,
          }

    onDateRangeSelect(timeRange)
  }

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (Date.now() - dragEndTime < 200) {
      return
    }

    const elem = getElementAtEvent(chartRef.current, e)[0]
    if (!elem) {
      if (active.length > 0) {
        setActive([])
        if (onDateClear) {
          onDateClear()
        }
      }
      return
    }

    const {index} = elem

    if (!data || !data[index] || !data[index].time) {
      return
    }

    if (active && active.includes(index) && active.length === 1) {
      setActive([])
      if (onDateClear) {
        onDateClear()
      }
    } else {
      setActive([index])
      const timestamp = moment(data[index].time).valueOf()
      handleClickDate(timestamp)
    }
  }

  useEffect(() => {
    const chartIdentity = [
      source?.id ?? '',
      cell?.queries?.[0]?.query ?? '',
      queryTimeKey,
    ].join('\0')

    if (staleChartIdentityRef.current !== chartIdentity) {
      staleChartIdentityRef.current = chartIdentity
      hadChartDataRef.current = false
    }

    const fetchData = async () => {
      if (!cell?.queries?.[0] || !source?.id) return
      const showBlockingLoad = !hadChartDataRef.current
      try {
        if (showBlockingLoad) {
          setLoading(true)
          onLoadingChange?.(true)
        }
        setError(null)

        const tz =
          cell.queries[0]?.tz ||
          (timeZone === 'UTC'
            ? 'UTC'
            : Intl.DateTimeFormat().resolvedOptions().timeZone)

        const timeWhere = buildAlertHistogramTimeWhere(queryTimeRange)

        const fullQuery = `
          SELECT count("value") AS "count_value"
          FROM "Default"."autogen"."cloudhub_alerts"
          WHERE ${timeWhere}
          GROUP BY time(1d), "level"
          tz('${tz}')
        `.trim()

        const {data: res} = await proxy({
          source: source.links.proxy,
          query: fullQuery,
          db: 'Default',
          uuid: uuidv4(),
        })
        const series = res?.results?.[0]?.series ?? []

        if (!series.length) {
          setData([])
          hadChartDataRef.current = false
          return
        }

        const allDates = Array.from(
          new Set(
            series.flatMap(s =>
              s.values.map(([time]) => moment(time).format('YYYY-MM-DD'))
            )
          )
        ).sort()

        const grouped = allDates.map(date => ({
          time: date,
          CRITICAL: 0,
          WARNING: 0,
          OK: 0,
        }))

        series.forEach(s => {
          const level = (s.tags?.level || 'OK').toUpperCase()
          s.values.forEach(([time, value]) => {
            const dateKey = moment(time).format('YYYY-MM-DD')
            const target = grouped.find(d => d.time === dateKey)
            if (!target) return
            if (level.includes('CRIT')) target.CRITICAL += value || 0
            else if (level.includes('WARN')) target.WARNING += value || 0
            else target.OK += value || 0
          })
        })

        setData(
          grouped as {
            time: string
            CRITICAL: number
            WARNING: number
            OK: number
          }[]
        )
        hadChartDataRef.current = grouped.length > 0
      } catch (e) {
        console.error('Query failed:', e)
        setError('Query failed.')
      } finally {
        if (showBlockingLoad) {
          setLoading(false)
          onLoadingChange?.(false)
        }
      }
    }

    fetchData()
  }, [
    cell?.queries?.[0]?.query,
    cell?.queries?.[0]?.tz,
    source?.id,
    timeZone,
    queryTimeKey,
  ])

  const chartData = useMemo(() => {
    if (!data.length) return {labels: [], datasets: []}
    return {
      labels: data.map(d => moment(d.time).format('DD / MMM').toUpperCase()),
      datasets: [
        {
          label: 'ok',
          data: data.map(d => d.OK),
          backgroundColor: data.map((_, i) =>
            active?.includes(i) ? '#F3852C' : '#4ed8a0'
          ),
          stack: 'alerts',
        },
        {
          label: 'warning',
          data: data.map(d => d.WARNING),
          backgroundColor: data.map((_, i) =>
            active?.includes(i) ? '#F3852C' : '#ffb94a'
          ),
          stack: 'alerts',
        },
        {
          label: 'critical',
          data: data.map(d => d.CRITICAL),
          backgroundColor: data.map((_, i) =>
            active?.includes(i) ? '#F3852C' : '#BF3D5E'
          ),
          stack: 'alerts',
        },
      ],
    }
  }, [data, active])

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {mode: 'index' as const, intersect: false},
      plugins: {
        'stable-selection': {
          threshold: 8,
          onSelect: ({gte, lte, indices}) => {
            if (gte >= 0 && lte >= 0) {
              if (indices.length > 1 && data && data.length > 0) {
                setActive(indices)
                const sortedIndices = [...indices].sort((a, b) => a - b)
                const startIndex = sortedIndices[0]
                const endIndex = sortedIndices[sortedIndices.length - 1]

                if (data[startIndex] && data[endIndex]) {
                  const startTime = moment(data[startIndex].time).valueOf()
                  const endTime = moment(data[endIndex].time).valueOf()
                  handleDragDateRange(startTime, endTime)
                }
              }
            } else {
              setActive([])
              if (onDateClear) {
                onDateClear()
              }
            }
          },
          onDragEnd: () => {
            setDragEndTime(Date.now())
          },
        },
        legend: {
          display: false,
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
          padding: {top: 8, bottom: 8, left: 10, right: 10},
          bodyFont: {size: 11},
          titleFont: {size: 11, weight: '600'},
          footerFont: {size: 12, weight: '600'},
          itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y ?? 0
              return `${ctx.dataset.label}: ${v.toLocaleString()}`
            },

            labelFont: () => {
              return {
                size: 5,
                weight: '500',
              }
            },

            labelTextColor: ctx => {
              const fixedColors: Record<string, string> = {
                ok: '#4ed8a0',
                warning: '#ffb94a',
                critical: '#BF3D5E',
              }
              return fixedColors[ctx.dataset.label.toLowerCase()] || '#fff'
            },

            labelColor: ctx => {
              const fixedColors: Record<string, string> = {
                ok: '#4ed8a0',
                warning: '#ffb94a',
                critical: '#BF3D5E',
              }
              const color =
                fixedColors[ctx.dataset.label.toLowerCase()] || '#ccc'
              return {
                borderColor: color,
                backgroundColor: color,
              }
            },

            footer: ctx => {
              if (!ctx.length) return ''
              const total = ctx.reduce((sum, i) => sum + (i.parsed.y ?? 0), 0)
              return `Total: ${total.toLocaleString()}`
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: '#ccc',
            maxTicksLimit: 8,
            font: {
              size: 11,
              weight: '600',
            },
            maxRotation: 0,
            minRotation: 0,
          },
          grid: {display: false},
        },
        y: {
          stacked: true,
          title: {
            display: true,
            text: 'Alert Count',
            color: '#ddd',
            font: {
              size: 13,
              weight: '600',
            },
          },
          ticks: {color: '#ccc', padding: 6},
          grid: {
            color: 'rgba(255,255,255,0.1)',
          },
        },
      },
      animation: false as const,
    }),
    [data, handleDragDateRange, onDateClear]
  )

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        backgroundColor: DEFAULT_CELL_BG_COLOR,
        padding: '8px',
      }}
    >
      {loading ? (
        <div
          style={{
            color: '#aaa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          Loading...
        </div>
      ) : error ? (
        <div
          style={{
            color: 'red',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          {error}
        </div>
      ) : !data.length ? (
        <div
          style={{
            color: '#aaa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          No data available
        </div>
      ) : (
        <Bar
          ref={chartRef}
          data={chartData}
          options={options}
          onClick={handleClick}
        />
      )}
    </div>
  )
}
