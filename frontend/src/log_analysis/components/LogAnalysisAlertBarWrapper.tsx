//Library
import React, {
  useMemo,
  useEffect,
  useState,
  useRef,
  MouseEvent,
  useCallback,
} from 'react'

//Constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

//Components
import LogAnalysisDashboardHeader from 'src/log_analysis/components/LogAnalysisDashboardHeader'

//Types
import {Cell, TimeZones, BaseElasticSearchData} from 'src/types'

//Utils
import {timeRanges} from 'src/shared/data/timeRanges'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'

//Redux
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'

//Actions
import {
  addLogAnalysisRangeFilterClause,
  removeLogAnalysisRangeFilterClause,
} from 'src/log_analysis/actions'

//Utils
import moment from 'moment'
import {fetchLogsCount} from 'src/log_analysis/apis'

//Types
import {LogCountData} from 'src/dashboards/types'
import {Bar, getElementAtEvent} from 'react-chartjs-2'
import {Chart as ChartJS} from 'chart.js'
import {buildCombinedFilters, lowerToESRange} from 'src/log_analysis/util'
import {FilteredLogsForLogAnalysis} from 'src/types/logAnalysis'
import {stableSelectionPlugin} from 'src/shared/utils/esChart'
import {HistogramOptions} from 'src/log_analysis/util/HistogramOptions'
import LoadingDots from 'src/shared/components/LoadingDots'

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
  logAnalysisManualRefresh?: number
}
function LogAnalysisAlertBarWrapper({
  cell,
  cloudTimeRange,
  cloudAutoRefresh,
  esSource,
  addLogAnalysisRangeFilter,
  removeLogAnalysisRangeFilterClause,
  filteredLogsForLogAnalysis,
  logAnalysisManualRefresh,
}: Props) {
  const chartRef = useRef<ChartJS<'bar', [], unknown>>(null)

  const prevFilterRef = useRef<FilteredLogsForLogAnalysis>([])

  const prevTimeRangeRef = useRef<{gte: number; lte: number} | undefined>()

  const [logsData, setLogsData] = useState<LogCountData[]>([])

  const [timeRange, setTimeRange] = useState<{gte: number; lte: number}>()

  const [active, setActive] = useState<number[]>([])

  const [dragEndTime, setDragEndTime] = useState(0)

  const defaultTimeRange = timeRanges.find(i => i.inputValue === 'Past 30d')

  const [loading, setLoading] = useState(false)

  const getLogsData = useCallback(
    async (esSource: BaseElasticSearchData) => {
      if (!esSource) return
      setLoading(true)
      const {gteISO, lteISO} = lowerToESRange({
        lower: cloudTimeRange?.logAnalysis?.lower ?? defaultTimeRange.lower,
        upper: cloudTimeRange?.logAnalysis?.upper ?? 'now()',
      })

      const combinedFilters = buildCombinedFilters(filteredLogsForLogAnalysis)

      const res = await fetchLogsCount({
        esSource,
        gteISO,
        lteISO,
        filters: combinedFilters.filter(
          clause =>
            !(
              'range' in clause && Object.keys(clause.range)[0] === '@timestamp'
            )
        ),
      })
      setLogsData(res.data)
      setLoading(false)
    },
    [
      cloudTimeRange?.logAnalysis?.lower,
      cloudTimeRange?.logAnalysis?.upper,
      filteredLogsForLogAnalysis,
    ]
  )

  let intervalID

  useEffect(() => {
    getLogsData(esSource)
  }, [logAnalysisManualRefresh])

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
  }, [
    cloudAutoRefresh?.logAnalysis,
    esSource,
    getLogsData,
    logAnalysisManualRefresh,
  ])

  useEffect(() => {
    const hasFilterChanged =
      JSON.stringify(prevFilterRef.current) !==
      JSON.stringify(filteredLogsForLogAnalysis)
    if (hasFilterChanged) {
      prevFilterRef.current = filteredLogsForLogAnalysis
      getLogsData(esSource)
    }
  }, [filteredLogsForLogAnalysis, getLogsData, esSource])

  useEffect(() => {
    if (!logsData) return

    let result = filteredLogsForLogAnalysis.filter(filter => {
      if ('range' in filter) {
        const {gte, lte} = filter.range['@timestamp']
        const newGte = new Date(gte).getTime()
        const newLte = new Date(lte).getTime()
        const ary = []
        logsData.forEach((log, idx) => {
          if (
            new Date(log.time).getTime() >= newGte &&
            new Date(log.time).getTime() < newLte
          ) {
            ary.push(idx)
          }
        })

        setActive(ary)
        return ary.length > 0
      }
    })
    if (result.length === 0) {
      setActive([])
    }
  }, [logsData, filteredLogsForLogAnalysis])

  useEffect(() => {
    const hasTimeRangeChanged =
      JSON.stringify(prevTimeRangeRef.current) !== JSON.stringify(timeRange)

    if (
      hasTimeRangeChanged &&
      timeRange &&
      logsData &&
      logsData[timeRange.gte] &&
      logsData[timeRange.lte]
    ) {
      prevTimeRangeRef.current = timeRange
      removeLogAnalysisRangeFilterClause('@timestamp')
      addLogAnalysisRangeFilter(
        '@timestamp',
        new Date(logsData[timeRange.gte].time).toISOString(),
        new Date(logsData[timeRange.lte].time + 86400000).toISOString()
      )
    }
  }, [
    timeRange,
    logsData,
    addLogAnalysisRangeFilter,
    removeLogAnalysisRangeFilterClause,
  ])

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
    return HistogramOptions({
      setTimeRange: setTimeRange,
      setActive: setActive,
      setDragEndTime: setDragEndTime,
    })
  }, [setTimeRange, setActive, setDragEndTime, logsData])

  return (
    <div style={{height: '100%', backgroundColor: '#292933'}}>
      <LogAnalysisDashboardHeader
        cellName={`LogAnalysis Count Histogram`}
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
      >
        <div className="dash-graph--name"></div>
        {loading && (
          <LoadingDots className="graph-panel__refreshing openstack-dots--loading" />
        )}
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
    logAnalysisDashboard: {
      filteredLogsForLogAnalysis,
      logAnalysisManualRefresh,
    },
  } = state
  return {
    cloudTimeRange,
    cloudAutoRefresh,
    timeZone,
    esSource,
    filteredLogsForLogAnalysis,
    logAnalysisManualRefresh,
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
