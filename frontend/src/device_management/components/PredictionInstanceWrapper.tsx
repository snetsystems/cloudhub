import React, {useEffect, useState} from 'react'

// Library
import _ from 'lodash'

// Components
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import PredictionDashboardHeader from 'src/device_management/components/PredictionDashboardHeader'

// Type
import {
  AnomalyFactor,
  Cell,
  Layout,
  Source,
  TimeRange,
  TimeZones,
} from 'src/types'
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
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {generateForHosts} from 'src/utils/tempVars'
import {getLayouts} from 'src/hosts/apis'
import {getDeep} from 'src/utils/wrappers'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {getCellsWithWhere} from 'src/hosts/utils/getCellsWithWhere'
import {setSelectedAnomaly} from '../actions'

interface Props {
  source: Source
  autoRefresh?: number
  manualRefresh: number
  filteredHexbinHost?: string
  selectedAnomaly?: AnomalyFactor
  timeZone?: TimeZones
  setSelectedAnomaly?: (value: AnomalyFactor) => void
}

const TIME_GAP = 1500000

const PredictionInstanceWrapper = ({
  source,
  autoRefresh,
  manualRefresh,
  filteredHexbinHost,
  selectedAnomaly,
  timeZone,
  setSelectedAnomaly,
}: Props) => {
  const getTimeRangeFromLocalStorage = (): TimeRange => {
    if (!!localStorage.getItem('monitoring-chart')) {
      return JSON.parse(localStorage.getItem('monitoring-chart'))
    } else {
      return timeRanges.find(tr => tr.lower === 'now() - 1h')
    }
  }

  const [selfTimeRange, setSelfTimeRange] = useState<TimeRange>(
    getTimeRangeFromLocalStorage()
  )

  const [layouts, setLayouts] = useState<Layout[]>()

  const [layoutCells, setLayoutCells] = useState<Cell[]>([])

  const instance = []

  useEffect(() => {
    getLayout()
  }, [filteredHexbinHost, selfTimeRange])

  useEffect(() => {
    if (!!selectedAnomaly.time && !!layouts) {
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

  const saveTimeRangeToLocalStorage = (timeRange: TimeRange) => {
    localStorage.setItem(
      'monitoring-chart',
      JSON.stringify({
        lower: timeRange.lower,
        lowerFlux: timeRange.lowerFlux,
        upper: null,
      })
    )
  }

  const convertTime = (number: number) => {
    return new Date(number).toISOString()
  }

  const getLayout = async () => {
    const layoutResults = await getLayouts()
    const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

    getLayoutsforInstance(layouts)
  }

  const getLayoutsforInstance = async (layouts: Layout[]) => {
    const filteredLayouts = layouts
      .filter(layout => {
        return layout.app === 'snmp_nx'
      })
      .sort((x, y) => {
        return x.measurement < y.measurement
          ? -1
          : x.measurement > y.measurement
          ? 1
          : 0
      })

    setLayouts(filteredLayouts)

    setLayoutCells(
      getCellsWithWhere(
        filteredLayouts,
        source,
        filteredHexbinHost ?? '',
        !!selectedAnomaly.time ?? false
      )
    )
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
    } else {
      const timeRange = timeRanges.find(range => range.lower === lower)
      setSelfTimeRange(timeRange)
      saveTimeRangeToLocalStorage(timeRange)
    }

    //annotation set null
    setSelectedAnomaly({
      host: null,
      time: null,
    })
  }

  return (
    <>
      <div
        className="panel"
        style={{height: '100%', backgroundColor: GRAPH_BG_COLOR}}
      >
        <PredictionDashboardHeader
          cellName={`Time Series Monitoring`}
          cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
          cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        >
          <div className="page-header--right" style={{zIndex: 3}}>
            <TimeRangeDropdown
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
                  isUsingAnnotationViewer={true}
                  annotationsViewMode={[
                    {
                      id: selectedAnomaly.host,
                      startTime: Number(selectedAnomaly.time),
                      text: `Anomaly Time (${timeZone})`,
                    },
                  ]}
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
    // src\clouds\containers\OpenStackPage.tsx
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {autoRefresh, timeZone},
      ephemeral: {inPresentationMode},
    },
    predictionDashboard: {filteredHexbinHost, selectedAnomaly},
    links,
  } = state
  return {
    links,
    timeZone,
    autoRefresh,
    inPresentationMode,
    filteredHexbinHost,
    selectedAnomaly,
  }
}

const mdtp = dispatch => ({
  onChooseAutoRefresh: bindActionCreators(setAutoRefresh, dispatch),
  setSelectedAnomaly: bindActionCreators(setSelectedAnomaly, dispatch),
})

const areEqual = (prevProps, nextProps) => {
  return prevProps.value === nextProps.value
}

export default React.memo(
  connect(mstp, mdtp, null)(PredictionInstanceWrapper),
  areEqual
)
