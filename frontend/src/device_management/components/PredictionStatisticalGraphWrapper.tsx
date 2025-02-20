import React, {useEffect, useState} from 'react'

// Library
import _ from 'lodash'

// Components
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import TimeRangeShiftDropdown from 'src/shared/components/TimeRangeShiftDropdown'
import PredictionDashboardHeader from 'src/device_management/components/PredictionDashboardHeader'

// Type
import {AnomalyFactor, Cell, Layout, Source, TimeRange} from 'src/types'
import ReactObserver from 'react-resize-observer'
import {timeRanges} from 'src/shared/data/timeRanges'

// Redux
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {setAutoRefresh} from 'src/shared/actions/app'

// constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
  GRAPH_BG_COLOR,
} from 'src/dashboards/constants'
import {TIME_GAP} from 'src/device_management/constants'

// Utils
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {generateForHosts} from 'src/utils/tempVars'
import {getDeep} from 'src/utils/wrappers'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {getCellsWithWhere} from 'src/hosts/utils/getCellsWithWhere'

// ETC
import {getLayout} from 'src/hosts/apis'

interface Props {
  source: Source
  autoRefresh?: number
  predictionManualRefresh?: number
  filteredHexbinHost?: string
  selectedAnomaly?: AnomalyFactor
}

const PredictionStatisticalGraphWrapper = ({
  source,
  autoRefresh,
  predictionManualRefresh: manualRefresh,
  filteredHexbinHost,
  selectedAnomaly,
}: Props) => {
  const getTimeRangeFromLocalStorage = (): TimeRange => {
    if (!!localStorage.getItem('monitoring-static-chart')) {
      return JSON.parse(localStorage.getItem('monitoring-static-chart'))
    } else {
      return timeRanges.find(tr => tr.lower === 'now() - 1h')
    }
  }

  const [selfTimeRange, setSelfTimeRange] = useState<TimeRange>(
    getTimeRangeFromLocalStorage()
  )
  const [layout, setLayout] = useState<Layout[]>()
  const [layoutCells, setLayoutCells] = useState<Cell[]>([])

  const instance = []

  useEffect(() => {
    getLayoutForInstance()
  }, [])

  useEffect(() => {
    if (!!selectedAnomaly.time && !!layout) {
      setSelfTimeRange({
        upper: convertTime(Number(selectedAnomaly.time) + TIME_GAP),
        lower: convertTime(Number(selectedAnomaly.time) - TIME_GAP),
      })
    } else {
      setSelfTimeRange(getTimeRangeFromLocalStorage())
    }
  }, [selectedAnomaly])

  useEffect(() => {
    GlobalAutoRefresher.poll(autoRefresh)
  }, [autoRefresh])

  useEffect(() => {
    if (!!layout) {
      setLayoutCells(
        getCellsWithWhere(layout, source, filteredHexbinHost ?? '', null, true)
      )
    }
  }, [layout, filteredHexbinHost, selfTimeRange])

  const saveTimeRangeToLocalStorage = (timeRange: TimeRange) => {
    localStorage.setItem(
      'monitoring-static-chart',
      JSON.stringify({
        lower: timeRange?.lower ?? 'now() - 1h',
        lowerFlux: timeRange?.lowerFlux,
        upper: timeRange?.upper ?? null,
      })
    )
  }

  const convertTime = (number: number) => {
    return new Date(number).toISOString()
  }

  const getLayoutForInstance = async () => {
    // app_id: snmp_nx_static
    const SNMP_STATIC_LAYOUT_ID = 'd61cdfb1-babd-459a-87b9-5c271360655e'
    const layoutResults = await getLayout(SNMP_STATIC_LAYOUT_ID)
    const layout = getDeep<Layout>(layoutResults, 'data', null)

    setLayout(layout ? [layout] : [])
  }

  const tempVars = generateForHosts(source)

  const debouncedFit = _.debounce(() => {
    WindowResizeEventTrigger()
  }, 150)

  const handleOnResize = (): void => {
    debouncedFit()
  }

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

  return (
    <>
      <div
        className="panel"
        style={{height: '100%', backgroundColor: GRAPH_BG_COLOR}}
      >
        <PredictionDashboardHeader
          cellName={`Statistic Graph`}
          cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
          cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        >
          <div
            onMouseDown={e => e.stopPropagation()}
            className="page-header--right"
            style={{zIndex: 3}}
          >
            <TimeRangeShiftDropdown
              onChooseTimeRange={handleChooseTimeRange}
              selected={selfTimeRange}
            />
          </div>
        </PredictionDashboardHeader>
        {!_.isEmpty(instance) ? (
          <div className="panel-body">
            <div className="generic-empty-state">
              <h4 style={{margin: '90px 0'}}>No Instances found</h4>
            </div>
          </div>
        ) : (
          <>
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
      persisted: {autoRefresh},
    },
    predictionDashboard: {
      filteredHexbinHost,
      selectedAnomaly,
      predictionManualRefresh,
    },
    links,
  } = state
  return {
    links,
    autoRefresh,
    filteredHexbinHost,
    selectedAnomaly,
    predictionManualRefresh,
  }
}

const mdtp = dispatch => ({
  onChooseAutoRefresh: bindActionCreators(setAutoRefresh, dispatch),
})

const areEqual = (prevProps, nextProps) => {
  return prevProps.value === nextProps.value
}

export default React.memo(
  connect(mstp, mdtp, null)(PredictionStatisticalGraphWrapper),
  areEqual
)
