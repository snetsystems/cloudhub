// Library
import React, {useEffect, useState} from 'react'
import _ from 'lodash'
import ReactObserver from 'react-resize-observer'
import {connect} from 'react-redux'

// Types
import {
  Cell,
  DeviceToOrgMapping,
  DeviceType,
  Layout,
  Ratio,
  Source,
  TimeRange,
} from 'src/types'
import {CloudAutoRefresh} from 'src/clouds/types/type'
// Constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
  GRAPH_BG_COLOR,
} from 'src/dashboards/constants'
import {notIncludeApps} from 'src/hosts/constants/apps'
import {LOG_ANALYSIS_TIME_SERIES_DEVICE_LAYOUT_IDS} from 'src/log_analysis/constants/'

// Components
import {timeRanges} from 'src/shared/data/timeRanges'
import TimeRangeShiftDropdown from 'src/shared/components/TimeRangeShiftDropdown'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import LogAnalysisDashboardHeader from 'src/log_analysis/components/LogAnalysisDashboardHeader'

// Utils
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {generateForHosts} from 'src/utils/tempVars'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {getDeep} from 'src/utils/wrappers'

// API
import {
  getLayout,
  getLayouts,
  getAppsForHost,
  getMeasurementsForHost,
} from 'src/hosts/apis'
import {getCellsReactive} from 'src/hosts/utils/getCellsReactive'
import {Cancel} from 'src/shared/components/ConfirmOrCancel'
import {bindActionCreators} from 'redux'
import {closePanel} from 'src/shared/actions/sidePanel'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

interface Props {
  ratio: Ratio
  source: Source
  title: string
  selectedTimeRangeLocalStorageKey: string
  cloudAutoRefresh?: CloudAutoRefresh
  selectedDevice?: DeviceToOrgMapping
  logAnalysisManualRefresh?: number
  closePanel?: () => void
  deviceType?: DeviceType
}

const LogAnalysisCellsGraphWrapper = ({
  ratio,
  title,
  source,
  selectedTimeRangeLocalStorageKey,
  selectedDevice,
  cloudAutoRefresh,
  logAnalysisManualRefresh,
  closePanel,
  deviceType = 'baremetal',
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
  }, [deviceType, selectedDevice?.aliasName])

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh?.logAnalysis)
  }, [cloudAutoRefresh?.logAnalysis])

  const getDeviceKeyValue = () => {
    switch (deviceType) {
      case 'baremetal':
        return {host: selectedDevice?.aliasName ?? ''}
      case 'vm':
        return {vmname: selectedDevice?.aliasName ?? ''}
      case 'switch':
        return {agent_host: selectedDevice?.aliasName ?? ''}
      default:
        return {host: selectedDevice?.aliasName ?? ''}
    }
  }

  useEffect(() => {
    if (!!layout) {
      setLayoutCells(
        getCellsReactive(layout, source, getDeviceKeyValue(), ratio, null)
      )
    }
  }, [layout, selfTimeRange, selectedDevice?.aliasName, deviceType])

  const fetchHostsAndMeasurements = async (
    layouts: Layout[],
    hostID: string
  ) => {
    const tempVars = generateForHosts(source)
    const fetchMeasurements = getMeasurementsForHost(source, hostID)

    const filterLayouts = _.filter(
      layouts,
      m => !_.includes(notIncludeApps, m.app)
    )

    const fetchHosts = getAppsForHost(
      source.links.proxy,
      hostID,
      filterLayouts,
      source.telegraf,
      tempVars
    )

    const [host, measurements] = await Promise.all([
      fetchHosts,
      fetchMeasurements,
    ])

    return {host, measurements}
  }

  const getLayoutsforHost = async (layouts: Layout[], hostID: string) => {
    const {host, measurements} = await fetchHostsAndMeasurements(
      layouts,
      hostID
    )

    const layoutsWithinHost = layouts.filter(layout => {
      return (
        host.apps &&
        host.apps.includes(layout.app) &&
        measurements.includes(layout.measurement)
      )
    })

    const filteredLayouts = layoutsWithinHost
      .filter(layout => {
        return (
          layout.app === 'system' ||
          layout.app === 'win_system' ||
          layout.app === 'ipmi_sensor'
        )
      })
      .sort((x, y) => {
        return x.measurement < y.measurement
          ? -1
          : x.measurement > y.measurement
          ? 1
          : 0
      })

    return {filteredLayouts}
  }

  const getLayoutsforVMWare = async (layouts: Layout[]) => {
    const filteredLayouts = _.filter(layouts, m => m.app === 'vsphere').sort(
      (x, y) => {
        return x.measurement < y.measurement
          ? -1
          : x.measurement > y.measurement
          ? 1
          : 0
      }
    )

    return {filteredLayouts}
  }

  const getLayoutForInstance = async () => {
    const aliasName = selectedDevice?.aliasName
    switch (deviceType) {
      case 'baremetal':
        if (aliasName) {
          const layoutResults = await getLayouts()
          const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

          if (layouts && layouts.length > 0) {
            const {filteredLayouts} = await getLayoutsforHost(
              layouts,
              aliasName
            )
            setLayout(filteredLayouts)
          } else {
            setLayout([])
          }
        } else {
          setLayout([])
        }
        break

      case 'vm':
        if (aliasName) {
          const layoutResults = await getLayouts()
          const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

          if (layouts && layouts.length > 0) {
            const {filteredLayouts} = await getLayoutsforVMWare(layouts)
            setLayout(filteredLayouts)
          } else {
            setLayout([])
          }
        } else {
          setLayout([])
        }
        break

      case 'switch':
        const layoutId = LOG_ANALYSIS_TIME_SERIES_DEVICE_LAYOUT_IDS[deviceType]
        if (layoutId) {
          const layoutResults = await getLayout(layoutId)
          const layout = getDeep<Layout>(layoutResults, 'data', null)
          setLayout(layout ? [layout] : [])
        } else {
          setLayout([])
        }
        break

      default:
        setLayout([])
        break
    }
  }

  const tempVars = generateForHosts(source)

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
        <LogAnalysisDashboardHeader
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
        </LogAnalysisDashboardHeader>
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
                    manualRefresh={logAnalysisManualRefresh}
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
      persisted: {cloudAutoRefresh, timeZone},
    },
    selectedDevice: {selectedDevice},
    logAnalysisDashboard: {logAnalysisManualRefresh},
  } = state
  return {
    cloudAutoRefresh,
    timeZone,
    selectedDevice,
    logAnalysisManualRefresh,
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
  connect(mstp, mdtp, null)(LogAnalysisCellsGraphWrapper),
  isEqual
)
