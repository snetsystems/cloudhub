// Library
import React, {useEffect, useState} from 'react'
import _ from 'lodash'
import ReactObserver from 'react-resize-observer'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

// Types
import {
  Cell,
  DeviceMeta,
  DropdownItem,
  Layout,
  Ratio,
  Source,
  TimeRange,
  Notification,
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
import MatchingAlias from 'src/log_analysis/components/MatchingAlias'
import {Cancel} from 'src/shared/components/ConfirmOrCancel'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

// Utils
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {generateForHosts} from 'src/utils/tempVars'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {getDeep} from 'src/utils/wrappers'
import {getCellsReactive} from 'src/hosts/utils/getCellsReactive'

// Actions
import {closePanel} from 'src/shared/actions/sidePanel'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {setSelectedDevice} from 'src/log_analysis/actions/'

// API
import {
  getLayout,
  getLayouts,
  getAppsForHost,
  getMeasurementsForHost,
  getTagValuesForDeviceType,
} from 'src/hosts/apis'
import {updateDeviceMapping} from 'src/admin/apis/deviceMapping'
import {notifyUpdateDeviceMappingFailed} from 'src/shared/copy/notifications'

interface Props {
  ratio: Ratio
  source: Source
  title: string
  selectedTimeRangeLocalStorageKey: string
  isAuthorized: boolean
  cloudAutoRefresh?: CloudAutoRefresh
  selectedDevice?: DeviceMeta
  logAnalysisManualRefresh?: number
  closePanel?: () => void
  notify?: (message: Notification) => void
  setSelectedDevice?: (device: DeviceMeta) => void
  logTimeRange: TimeRange
}

const LogAnalysisCellsGraphWrapper = ({
  ratio,
  title,
  source,
  selectedTimeRangeLocalStorageKey,
  isAuthorized,
  selectedDevice,
  cloudAutoRefresh,
  logAnalysisManualRefresh,
  closePanel,
  notify,
  setSelectedDevice,
  logTimeRange,
}: Props) => {
  const getTimeRangeFromLocalStorage = (): TimeRange => {
    if (logTimeRange) {
      return logTimeRange
    } else if (!!localStorage.getItem(selectedTimeRangeLocalStorageKey)) {
      return JSON.parse(localStorage.getItem(selectedTimeRangeLocalStorageKey))
    } else {
      return {lower: 'now() - 1h', upper: null}
    }
  }

  const [layout, setLayout] = useState<Layout[]>()

  const [layoutCells, setLayoutCells] = useState<Cell[]>([])

  const [selfTimeRange, setSelfTimeRange] = useState<TimeRange>(
    getTimeRangeFromLocalStorage()
  )

  useEffect(() => {
    setSelfTimeRange(logTimeRange)
  }, [logTimeRange])

  const deviceType = selectedDevice?.deviceType || 'baremetal'
  const [isFromAgent, setIsFromAgent] = useState(deviceType === 'baremetal')
  const [dropdownItems, setDropdownItems] = useState<DropdownItem[]>([])
  const [selectedDeviceAliasName, setSelectedDeviceAliasName] = useState(() => {
    if (selectedDevice?.aliasName && selectedDevice?.aliasName !== '') {
      return selectedDevice.aliasName
    }
    return selectedDevice?.hostname ?? ''
  })
  const [dropdownIsOpen, setDropdownIsOpen] = useState(false)

  useEffect(() => {
    if (selectedDevice?.aliasName && selectedDevice?.aliasName !== '') {
      setSelectedDeviceAliasName(selectedDevice.aliasName)
    } else if (selectedDevice?.hostname) {
      setSelectedDeviceAliasName(selectedDevice.hostname)
    } else {
      setSelectedDeviceAliasName('')
    }
  }, [selectedDevice?.hostname])

  const currentDeviceType = isFromAgent ? 'baremetal' : deviceType

  useEffect(() => {
    setLayout([])
    getLayoutForInstance()
  }, [selectedDeviceAliasName, currentDeviceType])

  useEffect(() => {
    if (selectedDeviceAliasName) {
      setSelectedDeviceAliasName(selectedDeviceAliasName)
    }
  }, [selectedDeviceAliasName])

  useEffect(() => {
    const fetchDropdownItems = async () => {
      if (!isAuthorized) {
        return
      }

      try {
        const tempVars = generateForHosts(source)
        const tagValues = await getTagValuesForDeviceType(
          source,
          currentDeviceType,
          tempVars
        )
        setDropdownItems(tagValues)
      } catch (error) {
        console.error('Error fetching dropdown items:', error)
        setDropdownItems([])
      }
    }

    fetchDropdownItems()
  }, [currentDeviceType, source, isAuthorized])

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh?.logAnalysis)
  }, [cloudAutoRefresh?.logAnalysis])

  const getDeviceKeyValue = (selectedDeviceAliasName: string) => {
    switch (currentDeviceType) {
      case 'baremetal':
        return {host: selectedDeviceAliasName}
      case 'vm':
        return {vmname: selectedDeviceAliasName}
      case 'switch':
        return {agent_host: selectedDeviceAliasName}
      default:
        return {host: selectedDeviceAliasName}
    }
  }

  useEffect(() => {
    if (!!layout) {
      setLayoutCells(
        getCellsReactive(
          layout,
          source,
          getDeviceKeyValue(selectedDeviceAliasName),
          ratio,
          null
        )
      )
    }
  }, [layout, selfTimeRange, selectedDeviceAliasName, currentDeviceType])

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
    const filteredLayouts = _.filter(
      layouts,
      m => m.app === 'vsphere' && m.measurement.startsWith('vsphere_vm')
    ).sort((x, y) => {
      return x.measurement < y.measurement
        ? -1
        : x.measurement > y.measurement
        ? 1
        : 0
    })

    return {filteredLayouts}
  }

  const getLayoutForInstance = async () => {
    switch (currentDeviceType) {
      case 'baremetal':
        if (selectedDeviceAliasName) {
          const layoutResults = await getLayouts()
          const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

          if (layouts && layouts.length > 0) {
            const {filteredLayouts} = await getLayoutsforHost(
              layouts,
              selectedDeviceAliasName
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
        if (selectedDeviceAliasName) {
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

  const onToggleChange = () => {
    setIsFromAgent(prev => !prev)
  }

  const handleDropdownOnChoose = (item: DropdownItem) => {
    setSelectedDeviceAliasName(item.text)
    setDropdownIsOpen(false)
  }

  const handleDropdownOnClose = () => {
    setDropdownIsOpen(false)
  }

  const handleDropdownOnClick = () => {
    setDropdownIsOpen(prev => !prev)
  }

  const handleOnApply = async () => {
    if (selectedDevice?.hostname && selectedDeviceAliasName) {
      try {
        const data = {
          aliasName: selectedDeviceAliasName,
          deviceType: '',
          ip: '',
          orgId: '',
        }

        const updatedDevice = await updateDeviceMapping(
          selectedDevice.hostname,
          data,
          []
        )

        if (updatedDevice) {
          setSelectedDevice(updatedDevice.data)
        }
      } catch (error) {
        notify(notifyUpdateDeviceMappingFailed(error.message || ''))
      }
    }
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
        {_.isEmpty(layout) ? (
          <>
            {/* // TODO Consider Toggle Disabled */}
            <MatchingAlias
              toggleActive={isFromAgent}
              onToggleChange={onToggleChange}
              dropdownItems={dropdownItems}
              selectedDropdown={selectedDeviceAliasName}
              dropdownOnChoose={handleDropdownOnChoose}
              dropdownOnClick={handleDropdownOnClick}
              dropdownOnClose={handleDropdownOnClose}
              dropdownIsOpen={dropdownIsOpen}
              isAuthorized={isAuthorized}
              toggleDisabled={false}
              onApply={handleOnApply}
            />
            <div className="panel-body" style={{margin: '0 15px'}}>
              <div className="generic-empty-state">
                <h4 style={{margin: '90px 0'}}>No Results Found</h4>
              </div>
            </div>
          </>
        ) : (
          <>
            <FancyScrollbar
              style={{height: 'calc(100% - 45px)'}}
              autoHide={true}
            >
              <MatchingAlias
                dropdownItems={dropdownItems}
                toggleActive={isFromAgent}
                dropdownIsOpen={dropdownIsOpen}
                isAuthorized={isAuthorized}
                dropdownOnChoose={handleDropdownOnChoose}
                dropdownOnClick={handleDropdownOnClick}
                dropdownOnClose={handleDropdownOnClose}
                onToggleChange={onToggleChange}
                selectedDropdown={selectedDeviceAliasName}
                toggleDisabled={false}
                onApply={handleOnApply}
              />
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
    notify: bindActionCreators(notifyAction, dispatch),
    setSelectedDevice: bindActionCreators(setSelectedDevice, dispatch),
  }
}

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(
  connect(mstp, mdtp, null)(LogAnalysisCellsGraphWrapper),
  isEqual
)
