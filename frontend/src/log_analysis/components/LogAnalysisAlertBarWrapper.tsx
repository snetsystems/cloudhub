import React, {useMemo, useEffect, useState, useRef, MouseEvent} from 'react'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'
import LogAnalysisDashboardHeader from './LogAnalysisDashboardHeader'

import {Cell, TimeZones, BaseElasticSearchData} from 'src/types'

import {timeRanges} from 'src/shared/data/timeRanges'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {
  addLogAnalysisRangeFilterClause,
  removeLogAnalysisRangeFilterClause,
} from '../actions'
import moment from 'moment'
import {fetchLogsCount} from '../apis'
import {LogCountData} from 'src/dashboards/types'
import {Bar, getElementAtEvent} from 'react-chartjs-2'
import {Chart as ChartJS} from 'chart.js'
import {lowerToESRange} from '../util'
import {FilteredLogsForLogAnalysis} from 'src/types/logAnalysis'
import {stableSelectionPlugin} from 'src/shared/utils/esChart'

//chart plugin
ChartJS.register(stableSelectionPlugin)

interface Props {
  cell: Cell
  esSource?: BaseElasticSearchData
  cloudTimeRange?: CloudTimeRange
  cloudAutoRefresh?: CloudAutoRefresh
  timeZone?: TimeZones
  setCloudTimeRange?: (value: CloudTimeRange) => void
  addLogAnalysisRangeFilter?: (
    field: string,
    gte?: string,
    lte?: string,
    format?: string
  ) => void
  filteredLogsForLogAnalysis?: FilteredLogsForLogAnalysis
  removeLogAnalysisRangeFilterClause?: (field: string) => void
}
function LogAnalysisAlertBarWrapper({
  cell,
  cloudTimeRange,
  cloudAutoRefresh,
  esSource,
  addLogAnalysisRangeFilter,
  removeLogAnalysisRangeFilterClause,
  filteredLogsForLogAnalysis,
}: Props) {
  const chartRef = useRef<ChartJS<'bar', [], unknown>>(null)

  const [logsData, setLogsData] = useState<LogCountData[]>([])

  const [timeRange, setTimeRange] = useState<{gte: number; lte: number}>()

  const [active, setActive] = useState<number[]>([])

  const [dragEndTime, setDragEndTime] = useState(0)

  let intervalID

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh?.logAnalysis)
    const controller = new AbortController()

    if (!!cloudAutoRefresh?.logAnalysis) {
      clearInterval(intervalID)
      intervalID = window.setInterval(() => {
        getLogsData(esSource)
      }, cloudAutoRefresh?.logAnalysis)
    }

    GlobalAutoRefresher.poll(cloudAutoRefresh?.logAnalysis)
    return () => {
      controller.abort()
      clearInterval(intervalID)
      intervalID = null
      GlobalAutoRefresher.stopPolling()
    }
  }, [cloudAutoRefresh?.logAnalysis, esSource])

  useEffect(() => {
    getLogsData(esSource)
  }, [])

  useEffect(() => {
    if (active.length > 0 || !logsData) return

    filteredLogsForLogAnalysis.forEach(filter => {
      if ('range' in filter) {
        const {gte, lte} = filter.range['@timestamp']
        const newGte = new Date(gte).getTime()
        const newLte = new Date(lte).getTime()
        const ary = []
        logsData.filter((log, idx) => {
          if (
            new Date(log.time).getTime() >= newGte &&
            new Date(log.time).getTime() < newLte
          ) {
            ary.push(idx)
          }
        })

        setActive(ary)
      }
    })
  }, [logsData, filteredLogsForLogAnalysis])

  useEffect(() => {
    if (
      timeRange &&
      logsData &&
      logsData[timeRange.gte] &&
      logsData[timeRange.lte]
    ) {
      addLogAnalysisRangeFilter(
        '@timestamp',
        new Date(logsData[timeRange.gte].time).toISOString(),
        new Date(logsData[timeRange.lte].time + 86400000).toISOString()
      )
    }
  }, [timeRange, logsData])

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (Date.now() - dragEndTime < 200) {
      return
    }

    const elem = getElementAtEvent(chartRef.current, e)[0]
    if (!elem) {
      if (active.length <= 1) {
        return
      } else if (active.length > 1) {
        removeLogAnalysisRangeFilterClause('@timestamp')
        setActive([])
        return
      }
    }

    const {index} = elem

    if (!logsData || !logsData[index] || !logsData[index].time) {
      return
    }

    if (active && active.includes(index)) {
      removeLogAnalysisRangeFilterClause('@timestamp')
      setActive([])
    } else {
      setActive([index])
      addLogAnalysisRangeFilter(
        '@timestamp',
        logsData[index].time,
        logsData[index].time + 86400000
      )
    }
  }

  const defaultTimeRange = timeRanges.find(i => i.inputValue === 'Past 30d')

  const getLogsData = async (esSource: BaseElasticSearchData) => {
    if (!esSource) return

    const {gteISO, lteISO} = lowerToESRange({
      lower: cloudTimeRange?.logAnalysis?.lower ?? defaultTimeRange.lower,
      upper: cloudTimeRange?.logAnalysis?.upper ?? 'now()',
    })

    const res = await fetchLogsCount({
      esSource,
      gteISO,
      lteISO,
    })

    setLogsData(res.data)
  }

  const chartData = useMemo(() => {
    if (!logsData || logsData.length === 0) {
      return {
        datasets: [
          {
            label: 'Count',
            data: [],
            borderSkipped: false,
            backgroundColor: [],
            borderColor: [],
            minBarLength: 5,
            borderWidth: [],
            borderRadius: 4,
          },
        ],
        labels: [],
      }
    }

    return {
      datasets: [
        {
          label: 'Count',
          data: logsData.map(i => ({x: i?.time, y: i?.value})),
          borderSkipped: false,
          backgroundColor: logsData.map((_, i) =>
            active?.includes(i)
              ? '#F3852C'
              : logsData.length === 1
              ? 'rgba(49, 192, 246, 0.8)'
              : i === 0
              ? 'rgba(49, 192, 246, 0.3)'
              : 'rgba(49, 192, 246, 0.8)'
          ),
          borderColor: logsData.map((_, i) =>
            active?.includes(i) ? '#F3852C' : 'rgba(0,0,0,0)'
          ),
          minBarLength: 5,
          borderWidth: logsData.map((_, i) => (active?.includes(i) ? 2 : 1)),
          borderRadius: 4,
        },
      ],
      labels: logsData.map(i => moment(i?.time).format('MMM DD')),
    }
  }, [logsData, active])

  const options = useMemo(() => {
    return {
      layout: {
        padding: {
          right: 10,
        },
      },
      animation: {
        duration: 0,
      },
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        'stable-selection': {
          threshold: 8,
          onSelect: ({gte, lte, indices}) => {
            setTimeRange({gte, lte})
            setActive(indices)
          },

          onDragEnd: () => {
            setDragEndTime(Date.now())
          },
        },
        zoom: {
          zoom: {
            drag: {
              enabled: false,
            },
            wheel: {
              enabled: false,
            },
            pinch: {
              enabled: true,
            },

            mode: 'x' as const,
          },
        },
        tooltip: {
          borderWidth: 0,
          cornerRadius: 4,
          pointStyle: 'circle',
          usePointStyle: true,
          boxWidth: 10,
          boxHeight: 10,
          callbacks: {},
        },
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          title: {
            color: '#999dab',
            display: true,
            font: {
              size: 11,
              weight: '600',
            },
            padding: {
              top: 15,
              left: 0,
              right: 0,
              bottom: 0,
            },
            text: 'Time Stamp',
          },

          barThickness: 1,
          grid: {
            color: '#383846',
          },
          ticks: {
            font: {
              size: 11,
              weight: '600',
            },
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
            autoSkipPadding: 25,
            sampleSize: 8,
          },
          stacked: false,
        },
        y: {
          title: {
            color: '#999dab',
            display: true,
            font: {
              size: 11,
              weight: '600',
            },

            position: 'left',
            text: 'Logs Count',
          },
          grid: {
            color: '#383846',
          },
          ticks: {
            font: {
              size: 11,
              weight: '600',
            },
          },
          stacked: false,
        },
      },
    }
  }, [logsData])

  const onResetZoom = () => {
    if (chartRef && chartRef.current) {
      chartRef.current.resetZoom()
    }
  }

  return (
    <div style={{height: '100%', backgroundColor: '#292933'}}>
      <LogAnalysisDashboardHeader
        cellName={`Anomaly LogAnalysis Counts Histogram`}
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
      >
        <div className="dash-graph--name"></div>
      </LogAnalysisDashboardHeader>

      {!!cell && (
        <div className="histogram-graph--chart">
          <Bar
            options={options}
            ref={chartRef}
            data={chartData}
            onClick={handleClick}
          />
        </div>
      )}
    </div>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {cloudAutoRefresh, timeZone, cloudTimeRange, esSource},
    },
    logAnalysisDashboard: {filteredLogsForLogAnalysis},
  } = state
  return {
    cloudTimeRange,
    cloudAutoRefresh,
    timeZone,
    esSource,
    filteredLogsForLogAnalysis,
  }
}

const mdtp = dispatch => ({
  addLogAnalysisRangeFilter: bindActionCreators(
    addLogAnalysisRangeFilterClause,
    dispatch
  ),
  removeLogAnalysisRangeFilterClause: bindActionCreators(
    removeLogAnalysisRangeFilterClause,
    dispatch
  ),
})

export default connect(mstp, mdtp)(LogAnalysisAlertBarWrapper)
