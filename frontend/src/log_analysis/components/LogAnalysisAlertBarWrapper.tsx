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
}: Props) {
  const chartRef = useRef<ChartJS<'bar', [], unknown>>(null)

  const [logsData, setLogsData] = useState<LogCountData[]>([])

  /** ① 클릭된 바의 위치를 기억하는 리액트 상태 */
  const [active, setActive] = useState<null | {
    index: number
    datasetIndex: number
  }>(null)

  /** ④ 캔버스 클릭 → getElementAtEvent 로 bar 요소 획득 */
  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const elem = getElementAtEvent(chartRef.current, e)[0] // 배열 중 첫 번째
    if (!elem) {
      setActive(null) // 빈 공간 클릭 시 선택 해제
      removeLogAnalysisRangeFilterClause('@timestamp')
      return
    }
    const {index, datasetIndex} = elem

    if (
      active &&
      active.index === index &&
      active.datasetIndex === datasetIndex
    ) {
      removeLogAnalysisRangeFilterClause('@timestamp')
      setActive(null)
    } else {
      setActive({index, datasetIndex})
      addLogAnalysisRangeFilter(
        '@timestamp',
        logsData[index].time,
        logsData[index].time + 86400000
      )
    }
  }

  const defaultTimeRange = timeRanges.find(i => i.inputValue === 'Past 30d')

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh?.logAnalysis)
    getLogsData(esSource)
  }, [cloudAutoRefresh?.logAnalysis, esSource])

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
    return {
      datasets: [
        {
          label: 'Count',
          data: logsData.map(i => ({x: i?.time, y: i?.value})),
          borderSkipped: false,
          backgroundColor: logsData.map((_, i) =>
            active && i === active.index
              ? '#F3852C'
              : i !== 0
              ? 'rgba(49, 192, 246, 0.8)'
              : 'rgba(49, 192, 246, 0.3)'
          ),
          borderColor: logsData.map((_, i) =>
            active && i === active.index ? '#F3852C' : 'rgba(0,0,0,0)'
          ),
          minBarLength: 3,
          borderWidth: logsData.map((_, i) =>
            active && i === active.index ? 2 : 1
          ),
          borderRadius: 4,
        },
      ],
      labels: logsData.map(i => moment(i.time).format('MMM DD')),
    }
  }, [logsData, active])

  const options = ({
    xAxisTitle,
    yAxisTitle,
  }: {
    xAxisTitle: string
    yAxisTitle: string
  }) => {
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
            text: xAxisTitle,
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
            text: yAxisTitle,
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
  }

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
            options={options({
              xAxisTitle: 'Time Stamp',
              yAxisTitle: 'Logs Count',
            })}
            ref={chartRef}
            data={chartData}
            onDrag={() => {
              console.log('onDrag')
            }}
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
