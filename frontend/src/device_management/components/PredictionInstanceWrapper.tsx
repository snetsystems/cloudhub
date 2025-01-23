import React, {useEffect, useRef, useState} from 'react'

// Library
import _ from 'lodash'

// Components
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import TimeRangeShiftDropdown from 'src/shared/components/TimeRangeShiftDropdown'
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
import {timeRanges, timeRangesGroupBys} from 'src/shared/data/timeRanges'

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
import {DEFAULT_GROUP_BY, TIME_GAP} from 'src/device_management/constants'

// Utils
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {generateForHosts} from 'src/utils/tempVars'
import {getDeep} from 'src/utils/wrappers'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

// ETC
import {getLayouts} from 'src/hosts/apis'
import {getCellsWithWhere} from 'src/hosts/utils/getCellsWithWhere'
import PredictionHexbinToggle from 'src/device_management/components/PredictionHexbinToggle'
import {setSelectedAnomaly} from 'src/device_management/actions'

interface Props {
  source: Source
  autoRefresh?: number
  predictionManualRefresh?: number
  filteredHexbinHost?: string
  selectedAnomaly?: AnomalyFactor
  timeZone?: TimeZones
  setSelectedAnomaly?: (value: AnomalyFactor) => void
}

const PredictionInstanceWrapper = ({
  source,
  autoRefresh,
  predictionManualRefresh: manualRefresh,
  filteredHexbinHost,
  selectedAnomaly,
  timeZone,
}: Props) => {
  const intervalRef = useRef(null)

  const getTimeRangeFromLocalStorage = (): TimeRange => {
    if (!!localStorage.getItem('monitoring-chart')) {
      return JSON.parse(localStorage.getItem('monitoring-chart'))
    } else {
      return timeRanges.find(tr => tr.lower === 'now() - 1h')
    }
  }

  const [tempInterval, setTempInterval] = useState(DEFAULT_GROUP_BY)

  const [interval, setInterval] = useState(DEFAULT_GROUP_BY)

  const [isIntervalManual, setIsIntervalManual] = useState(false)
  const [
    showFilteredHostLayoutsByInterfaces,
    setShowFilteredHostLayoutsByInterfaces,
  ] = useState(false)

  const [selfTimeRange, setSelfTimeRange] = useState<TimeRange>(
    getTimeRangeFromLocalStorage()
  )

  const [layouts, setLayouts] = useState<Layout[]>()
  const [
    filteredHostLayoutsByInterfaces,
    setFilteredHostLayoutsByInterfaces,
  ] = useState<Layout[]>()

  const [layoutCells, setLayoutCells] = useState<Cell[]>([])

  const instance = []

  useEffect(() => {
    getLayout()
  }, [])

  useEffect(() => {
    if (
      !!selectedAnomaly.time &&
      !!layouts &&
      !!filteredHostLayoutsByInterfaces
    ) {
      setSelfTimeRange({
        upper: convertTime(Number(selectedAnomaly.time) + TIME_GAP),
        lower: convertTime(Number(selectedAnomaly.time) - TIME_GAP),
      })
    } else {
      setSelfTimeRange(getTimeRangeFromLocalStorage())
      setIsIntervalManual(false)
    }
  }, [selectedAnomaly])

  useEffect(() => {
    GlobalAutoRefresher.poll(autoRefresh)
  }, [autoRefresh])

  const getCurrentLayouts = () => {
    const hasFilteredHost = isFilteredHost(filteredHexbinHost)

    if (!hasFilteredHost) {
      return layouts
    }

    return showFilteredHostLayoutsByInterfaces
      ? filteredHostLayoutsByInterfaces
      : layouts
  }

  useEffect(() => {
    const currentLayouts = getCurrentLayouts()

    if (!!currentLayouts) {
      setLayoutCells(
        getCellsWithWhere(
          currentLayouts,
          source,
          filteredHexbinHost ?? '',
          isIntervalManual ? interval : null
        )
      )
    }
  }, [
    layouts,
    interval,
    filteredHexbinHost,
    isIntervalManual,
    selfTimeRange,
    showFilteredHostLayoutsByInterfaces,
  ])

  const saveTimeRangeToLocalStorage = (timeRange: TimeRange) => {
    localStorage.setItem(
      'monitoring-chart',
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

  const getLayout = async () => {
    const layoutResults = await getLayouts()
    const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

    getLayoutsforInstance(layouts)
  }

  const getLayoutsforInstance = async (layouts: Layout[]) => {
    const filteredLayouts = layouts
      .filter(layout => layout.app === 'snmp_nx')
      .sort((x, y) => {
        return x.measurement < y.measurement
          ? -1
          : x.measurement > y.measurement
          ? 1
          : 0
      })

    const filteredHostLayoutsByInterfaces = layouts
      .filter(layout => layout.app === 'snmp_nx_by_interfaces')
      .sort((x, y) => {
        return x.measurement < y.measurement
          ? -1
          : x.measurement > y.measurement
          ? 1
          : 0
      })

    setLayouts(filteredLayouts)
    setFilteredHostLayoutsByInterfaces(filteredHostLayoutsByInterfaces)
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
      // saveTimeRangeToLocalStorage({lower, upper})
    } else {
      setIsIntervalManual(false)
      const timeRange = timeRanges.find(range => range.lower === lower)
      setSelfTimeRange(timeRange)
      saveTimeRangeToLocalStorage(timeRange)
    }
  }

  const onToggleShowFilteredHostDerivativeLayouts = () => {
    setShowFilteredHostLayoutsByInterfaces(prevState => !prevState)
  }

  const onToggleChangeHandler = () => {
    const groupBy =
      timeRangesGroupBys.find(tr => tr.lower === selfTimeRange.lower)
        ?.defaultGroupBy ?? DEFAULT_GROUP_BY
    setIsIntervalManual(!isIntervalManual)
    setTempInterval(groupBy)
    setInterval(groupBy)
  }

  const onIntervalHandler = value => {
    const numericValue = Number(value)
    if (!isNaN(numericValue)) {
      setTempInterval(numericValue)
    } else {
      setTempInterval(0)
    }
  }

  const onFocusOutHandler = () => {
    if (tempInterval > 0) {
      setInterval(tempInterval)
    } else {
      setIsIntervalManual(false)
    }
  }

  const onKeyUpHandler = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!!intervalRef.current) {
      if (e.keyCode === 13) {
        intervalRef.current.blur()
      }
    }
  }

  const isFilteredHost = (filteredHexbinHost: string | undefined): boolean => {
    return filteredHexbinHost !== undefined && filteredHexbinHost !== ''
  }

  return (
    <>
      <div
        className="panel"
        style={{height: '100%', backgroundColor: GRAPH_BG_COLOR}}
      >
        <PredictionDashboardHeader
          cellName={`Time Series Graph`}
          cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
          cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        >
          <div
            onMouseDown={e => e.stopPropagation()}
            className="page-header--right"
            style={{zIndex: 3}}
          >
            <PredictionHexbinToggle
              isHide={!isFilteredHost(filteredHexbinHost)}
              isActive={showFilteredHostLayoutsByInterfaces}
              onChange={() => {
                onToggleShowFilteredHostDerivativeLayouts()
              }}
              label="By Interfaces"
            />
            {/* Deprecated */}
            <PredictionHexbinToggle
              isHide={true}
              isActive={isIntervalManual}
              onChange={() => {
                onToggleChangeHandler()
              }}
              label="Manual Interval"
            />
            {isIntervalManual && (
              <>
                <input
                  ref={intervalRef}
                  type="number"
                  min="1"
                  className="form-control input-sm prediction-interval--input"
                  placeholder="Interval..."
                  onChange={e => onIntervalHandler(e.currentTarget.value)}
                  value={`${tempInterval}`}
                  autoComplete={'off'}
                  spellCheck={false}
                  onBlur={() => {
                    onFocusOutHandler()
                  }}
                  onKeyUp={e => {
                    onKeyUpHandler(e)
                  }}
                />
                <span>min</span>
              </>
            )}
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
                  isUsingAnnotationViewer={!!selectedAnomaly.time}
                  annotationsViewMode={[
                    {
                      id: selectedAnomaly.host,
                      startTime: Number(selectedAnomaly.time),
                      endTime: Number(selectedAnomaly.time),
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
    predictionDashboard: {
      filteredHexbinHost,
      selectedAnomaly,
      predictionManualRefresh,
    },
    links,
  } = state
  return {
    links,
    timeZone,
    autoRefresh,
    inPresentationMode,
    filteredHexbinHost,
    selectedAnomaly,
    predictionManualRefresh,
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
