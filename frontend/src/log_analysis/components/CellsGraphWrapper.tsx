// Library
import React, {useEffect, useMemo, useState} from 'react'
import _ from 'lodash'
import ReactObserver from 'react-resize-observer'
import {connect} from 'react-redux'

// Types
import {
  Cell,
  FilteredHostForGPUMonitoring,
  Layout,
  Ratio,
  Source,
  TimeRange,
} from 'src/types'

// Constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
  GRAPH_BG_COLOR,
} from 'src/dashboards/constants'
// Components
import GPUMonitoringDashboardHeader from 'src/gpu_monitoring/components/GPUMonitoringDashboardHeader'
import {timeRanges} from 'src/shared/data/timeRanges'
import TimeRangeShiftDropdown from 'src/shared/components/TimeRangeShiftDropdown'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'

// Utils
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {generateForHostsForStatisticalGraph} from 'src/utils/tempVars'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {getDeep} from 'src/utils/wrappers'

// API
import {getLayout} from 'src/hosts/apis'
import {getCellsReactive} from 'src/hosts/utils/getCellsReactive'
import {Cancel} from 'src/shared/components/ConfirmOrCancel'
import {bindActionCreators} from 'redux'
import {closePanel} from 'src/shared/actions/sidePanel'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

interface Props {
  ratio: Ratio
  title: string
  source: Source
  selectedTimeRangeLocalStorageKey: string
  filteredHostForGPUMonitoring?: FilteredHostForGPUMonitoring
  autoRefresh?: number
  gpuMonitoringManualRefresh?: number
  isStatisticsGraph?: boolean
  statisticGraphHeight?: number
  timeSeriesGraphHeight?: number
  closePanel?: () => void
}

const TestCellsGraphWrapper = ({
  ratio,
  title,
  source,
  selectedTimeRangeLocalStorageKey,
  filteredHostForGPUMonitoring,
  autoRefresh,
  gpuMonitoringManualRefresh: manualRefresh,
  isStatisticsGraph,
  statisticGraphHeight,
  timeSeriesGraphHeight,
  closePanel,
}: Props) => {
  const getTimeRangeFromLocalStorage = (): TimeRange => {
    if (!!localStorage.getItem(selectedTimeRangeLocalStorageKey)) {
      return JSON.parse(localStorage.getItem(selectedTimeRangeLocalStorageKey))
    } else {
      return timeRanges.find(tr => tr.lower === 'now() - 1h')
    }
  }

  const [layout, setLayout] = useState<Layout[]>()

  const [layoutCells, setLayoutCells] = useState<Cell[]>([])

  const [selfTimeRange, setSelfTimeRange] = useState<TimeRange>(
    getTimeRangeFromLocalStorage()
  )

  const instance = []

  useEffect(() => {
    getLayoutForInstance()
  }, [])

  useEffect(() => {
    GlobalAutoRefresher.poll(autoRefresh)
  }, [autoRefresh])

  useEffect(() => {
    if (isStatisticsGraph) return
    // prepare rollback
    // const whereTags = {
    //   host: filteredHostForGPUMonitoring.hostname,
    //   index: filteredHostForGPUMonitoring.gpuIndex,
    // }

    if (!!layout) {
      // setLayoutCells(getCellsWithRatio(layout, source, whereTags, xNum, null))
      setLayoutCells(
        getCellsReactive(
          layout,
          source,
          {host: filteredHostForGPUMonitoring.hostname ?? ''},
          ratio,
          null
        )
      )
    }
  }, [
    layout,
    selfTimeRange,
    filteredHostForGPUMonitoring.hostname,
    filteredHostForGPUMonitoring.gpuIndex,
    timeSeriesGraphHeight,
  ])

  useEffect(() => {
    if (!isStatisticsGraph) return

    if (!!layout) {
      setLayoutCells(getCellsReactive(layout, source, {host: ''}, ratio, null))
    }
  }, [layout, selfTimeRange, statisticGraphHeight])

  const getLayoutForInstance = async () => {
    const layoutResults = await getLayout(
      'a3cfadab-56dc-48b8-9161-c6e9d82555c1' // canned layout id 입력 or 변수명으로 선언
    )
    const layout = getDeep<Layout>(layoutResults, 'data', null)

    setLayout(layout ? [layout] : [])
  }

  const tempVars = generateForHostsForStatisticalGraph(source)

  const handleChooseTimeRange = ({lower, upper}) => {
    if (upper) {
      setSelfTimeRange({lower, upper})
      saveTimeRangeToLocalStorage({lower, upper})
    } else {
      const timeRange = timeRanges.find(range => range.lower === lower)
      setSelfTimeRange(timeRange)
      saveTimeRangeToLocalStorage(timeRange)
    }
  }

  const saveTimeRangeToLocalStorage = (timeRange: TimeRange) => {
    localStorage.setItem(
      selectedTimeRangeLocalStorageKey,
      JSON.stringify({
        lower: timeRange?.lower ?? 'now() - 1h',
        lowerFlux: timeRange?.lowerFlux,
        upper: timeRange?.upper ?? null,
      })
    )
  }

  const debouncedFit = _.debounce(() => {
    WindowResizeEventTrigger()
  }, 150)

  const handleOnResize = (): void => {
    debouncedFit()
  }

  return (
    <>
      <div
        className="panel"
        style={{height: '100%', backgroundColor: GRAPH_BG_COLOR}}
      >
        <GPUMonitoringDashboardHeader
          cellName={title}
          cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
          cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        >
          <div
            onMouseDown={e => e.stopPropagation()}
            className="page-header--right"
            style={{zIndex: 3, marginRight: '4px'}}
          >
            <TimeRangeShiftDropdown
              onChooseTimeRange={handleChooseTimeRange}
              selected={selfTimeRange}
            />
            <div className="close-button">
              <Cancel
                buttonSize="btn-xs"
                onCancel={closePanel}
                icon="icon remove"
                title="close"
              />
            </div>
          </div>
        </GPUMonitoringDashboardHeader>
        {!_.isEmpty(instance) ? (
          <div className="panel-body">
            <div className="generic-empty-state">
              <h4 style={{margin: '90px 0'}}>No Instances found</h4>
            </div>
          </div>
        ) : (
          <>
            <FancyScrollbar
              style={{height: 'calc(100% - 45px)'}}
              autoHide={true}
            >
              <div
                className="panel-body"
                style={{backgroundColor: GRAPH_BG_COLOR}}
              >
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <ReactObserver onResize={handleOnResize} />
                  <LayoutRenderer
                    source={source}
                    sources={[source]}
                    isStatusPage={false}
                    isStaticPage={true}
                    isEditable={false}
                    cells={layoutCells}
                    templates={tempVars}
                    timeRange={selfTimeRange}
                    manualRefresh={manualRefresh}
                    host={''}
                  />
                </div>
              </div>
            </FancyScrollbar>
            <div className="dash-graph--gradient-border">
              <div className="dash-graph--gradient-top-left" />
              <div className="dash-graph--gradient-top-right" />
              <div className="dash-graph--gradient-bottom-left" />
              <div className="dash-graph--gradient-bottom-right" />
            </div>
          </>
        )}
      </div>
    </>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {autoRefresh, timeZone},
    },
    gpuMonitoringDashboard: {
      filteredHostForGPUMonitoring,
      gpuMonitoringManualRefresh,
      statisticGraphHeight,
      timeSeriesGraphHeight,
    },
    links,
  } = state
  return {
    links,
    timeZone,
    autoRefresh,
    filteredHostForGPUMonitoring,
    gpuMonitoringManualRefresh,
    statisticGraphHeight,
    timeSeriesGraphHeight,
  }
}

const mdtp = dispatch => {
  return {
    closePanel: () => bindActionCreators(closePanel, dispatch)(),
  }
}

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(
  connect(mstp, mdtp, null)(TestCellsGraphWrapper),
  isEqual
)
