// Library
import React, {useEffect, useState, useCallback, useMemo, useRef} from 'react'
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
  TimeZones,
} from 'src/types'
import {CloudAutoRefresh} from 'src/clouds/types/type'

// Constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
  GRAPH_BG_COLOR,
} from 'src/dashboards/constants'

// Components
import {timeRanges} from 'src/shared/data/timeRanges'
import TimeRangeShiftDropdown from 'src/shared/components/TimeRangeShiftDropdown'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import LogAnalysisDashboardHeader from 'src/log_analysis/components/LogAnalysisDashboardHeader'
import {Cancel} from 'src/shared/components/ConfirmOrCancel'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import AppNameMatchingAliasWrapper from 'src/log_analysis/components/AppNameMatchingAliasWrapper'
import {ComponentStatus} from 'src/reusable_ui'

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
  getLayouts,
  getTagValuesForLayoutWhereTagKeys,
  filterLayoutsByExistingMeasurements,
} from 'src/hosts/apis'
import {updateDeviceMapping} from 'src/admin/apis/deviceMapping'
import {
  notifyNoSelectedDevice,
  notifyUpdateDeviceMappingFailed,
  notifyUpdateDeviceMappingSuccess,
} from 'src/shared/copy/notifications'

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
  timeZone?: TimeZones
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
  timeZone,
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

  let intervalID: number | null = null

  useEffect(() => {
    setSelfTimeRange(logTimeRange)
  }, [logTimeRange])

  const [allLayouts, setAllLayouts] = useState<Layout[]>([])
  const [preFilteredLayouts, setPreFilteredLayouts] = useState<Layout[]>([])
  const [matchingAliasDropdownItems, setMatchingAliasDropdownItems] = useState<
    DropdownItem[]
  >([])
  const [
    matchingAliasSelectedDeviceAliasName,
    setMatchingAliasSelectedDeviceAliasName,
  ] = useState(() => {
    if (selectedDevice?.aliasName && selectedDevice?.aliasName !== '') {
      return selectedDevice.aliasName
    }
    return selectedDevice?.hostname ?? ''
  })
  const [
    matchingAliasDropdownIsOpen,
    setMatchingAliasDropdownIsOpen,
  ] = useState(false)
  const [appDropdownItems, setAppDropdownItems] = useState<DropdownItem[]>()
  const [selectedApp, setSelectedApp] = useState<string>(
    selectedDevice?.appName ?? ''
  )
  const [appDropdownIsOpen, setAppDropdownIsOpen] = useState(false)

  const [isAllLayoutsLoading, setIsAllLayoutsLoading] = useState(false)
  const [isDropdownItemsLoading, setIsDropdownItemsLoading] = useState(false)

  useEffect(() => {
    if (selectedDevice?.aliasName && selectedDevice?.aliasName !== '') {
      setMatchingAliasSelectedDeviceAliasName(selectedDevice.aliasName)
    } else if (selectedDevice?.hostname) {
      setMatchingAliasSelectedDeviceAliasName(selectedDevice.hostname)
    } else {
      setMatchingAliasSelectedDeviceAliasName('')
    }
  }, [selectedDevice?.hostname, selectedDevice?.aliasName])

  useEffect(() => {
    if (selectedDevice?.appName) {
      setSelectedApp(selectedDevice.appName)
    } else {
      setSelectedApp('')
    }
  }, [selectedDevice?.hostname, selectedDevice?.appName])

  const fetchAllLayouts = useCallback(async () => {
    setIsAllLayoutsLoading(true)
    try {
      const layoutResults = await getLayouts()
      const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

      if (layouts && layouts.length > 0) {
        const tempVars = generateForHosts(source)
        const filteredLayouts = await filterLayoutsByExistingMeasurements(
          layouts,
          source,
          tempVars
        )

        if (!_.isEqual(preFilteredLayouts, filteredLayouts || [])) {
          setAllLayouts(filteredLayouts || [])
          setPreFilteredLayouts(filteredLayouts || [])
        }

        if (filteredLayouts && filteredLayouts.length > 0) {
          const uniqueApps = [
            ...new Set(filteredLayouts.map(layout => layout.app)),
          ].filter(Boolean)
          const appItems: DropdownItem[] = uniqueApps.map(app => ({
            text: app,
          }))
          setAppDropdownItems(appItems)
        } else {
          setAppDropdownItems([])
        }
      } else {
        if (!_.isEqual(preFilteredLayouts, [])) {
          setAllLayouts([])
          setPreFilteredLayouts([])
        }
        setAppDropdownItems([])
      }
    } catch (error) {
      if (!_.isEqual(preFilteredLayouts, [])) {
        setAllLayouts([])
        setPreFilteredLayouts([])
      }
      setAppDropdownItems([])
    } finally {
      setIsAllLayoutsLoading(false)
    }
  }, [source, preFilteredLayouts])

  const fetchDropdownItems = useCallback(async () => {
    if (allLayouts.length === 0) {
      return
    }

    setIsDropdownItemsLoading(true)
    try {
      const tempVars = generateForHosts(source)
      const tagValues = await getTagValuesForLayoutWhereTagKeys(
        source,
        allLayouts,
        tempVars
      )
      setMatchingAliasDropdownItems(tagValues)
    } catch (error) {
      console.error('Error fetching dropdown items:', error)
      setMatchingAliasDropdownItems([])
    } finally {
      setIsDropdownItemsLoading(false)
    }
  }, [allLayouts])

  useEffect(() => {
    fetchAllLayouts()
  }, [fetchAllLayouts])

  const prevManualRefreshRef = useRef<number>(logAnalysisManualRefresh)

  useEffect(() => {
    const prev = prevManualRefreshRef.current
    if (prev !== logAnalysisManualRefresh) {
      fetchAllLayouts()
    }
    prevManualRefreshRef.current = logAnalysisManualRefresh
  }, [logAnalysisManualRefresh, fetchAllLayouts])

  useEffect(() => {
    fetchDropdownItems()
  }, [fetchDropdownItems])

  useEffect(() => {
    setLayout([])
    if (allLayouts.length > 0) {
      getLayoutForInstance()
    }
  }, [selectedApp, allLayouts])

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh?.logAnalysis)
    const controller = new AbortController()

    if (!!cloudAutoRefresh?.logAnalysis) {
      clearInterval(intervalID)
      intervalID = window.setInterval(() => {
        fetchAllLayouts()
      }, cloudAutoRefresh.logAnalysis)
    }

    return () => {
      controller.abort()
      clearInterval(intervalID)
      intervalID = null
      GlobalAutoRefresher.stopPolling()
    }
  }, [cloudAutoRefresh?.logAnalysis])

  useEffect(() => {
    if (!!layout) {
      const whereTag = {
        _operator: 'OR' as const,
      }

      const deviceAlias =
        matchingAliasSelectedDeviceAliasName || selectedDevice?.hostname || ''

      if (!deviceAlias) {
        notify(notifyNoSelectedDevice())
        return
      }

      layout.forEach(layoutItem => {
        if (layoutItem.whereTagKey && Array.isArray(layoutItem.whereTagKey)) {
          layoutItem.whereTagKey.forEach(key => {
            whereTag[key.trim()] = deviceAlias
          })
        }
      })

      setLayoutCells(getCellsReactive(layout, source, whereTag, ratio, null))
    }
  }, [selfTimeRange, matchingAliasSelectedDeviceAliasName, layout])

  const filterLayoutsByRule = async () => {
    let filtered: Layout[] = []

    if (selectedApp && selectedApp !== '') {
      filtered = allLayouts.filter(layout => layout.app === selectedApp)
    } else {
      filtered = []
    }

    return filtered.sort((x, y) => {
      return x.measurement < y.measurement
        ? -1
        : x.measurement > y.measurement
        ? 1
        : 0
    })
  }

  const getLayoutForInstance = async () => {
    const filteredLayouts = await filterLayoutsByRule()
    setLayout(filteredLayouts)
  }

  const tempVars = useMemo(() => generateForHosts(source), [source])

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

  const handleMatchingAliasDropdownOnChoose = (item: DropdownItem) => {
    if (item && item.text) {
      setMatchingAliasSelectedDeviceAliasName(item.text)
      setMatchingAliasDropdownIsOpen(false)
    }
  }

  const handleMatchingAliasDropdownOnClose = () => {
    setMatchingAliasDropdownIsOpen(false)
  }

  const handleMatchingAliasDropdownOnClick = () => {
    setMatchingAliasDropdownIsOpen(prev => !prev)
  }

  const handleMatchingAliasInputDropdownChange = useCallback(
    _.debounce((value: string) => {
      setMatchingAliasSelectedDeviceAliasName(value)
    }, 1000),
    []
  )

  const handleApply = async () => {
    if (selectedDevice?.hostname) {
      try {
        const data: DeviceMeta = {
          hostname: selectedDevice.hostname,
          aliasName: matchingAliasSelectedDeviceAliasName,
          deviceType: '',
          ip: '',
          orgId: selectedDevice.orgId,
          appName: selectedApp,
          isDeletable: selectedDevice.isDeletable,
        }

        const updatedDevice = await updateDeviceMapping(data)

        if (updatedDevice) {
          setSelectedDevice(updatedDevice.data)
          notify(notifyUpdateDeviceMappingSuccess())
        }
      } catch (error) {
        const errorMsg =
          error?.response?.data?.message ||
          error?.data?.message ||
          error?.message ||
          ''
        notify(notifyUpdateDeviceMappingFailed(errorMsg))
      }
    }
  }

  const handleAppDropdownChoose = (item: DropdownItem) => {
    setSelectedApp(item.text)
    setAppDropdownIsOpen(false)
  }
  const handleAppDropdownClick = () => setAppDropdownIsOpen(prev => !prev)
  const handleAppDropdownClose = () => setAppDropdownIsOpen(false)

  const getAnnotationTime = (): number | null => {
    if (!selfTimeRange.lower || !selfTimeRange.upper) {
      return null
    }

    try {
      const lowerTime = new Date(selfTimeRange.lower).getTime()
      const upperTime = new Date(selfTimeRange.upper).getTime()
      return (lowerTime + upperTime) / 2
    } catch (error) {
      return null
    }
  }

  const annotationTime = getAnnotationTime()

  const annotationsViewMode = useMemo(() => {
    if (!annotationTime) return undefined

    return [
      {
        id: matchingAliasSelectedDeviceAliasName,
        startTime: annotationTime,
        endTime: annotationTime,
        text: `Log Analysis Time (${timeZone})`,
      },
    ]
  }, [annotationTime, matchingAliasSelectedDeviceAliasName, timeZone])

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
            <AppNameMatchingAliasWrapper
              appItems={appDropdownItems}
              selectedApp={selectedApp}
              appIsOpen={appDropdownIsOpen}
              onAppChoose={handleAppDropdownChoose}
              onAppClick={handleAppDropdownClick}
              onAppClose={handleAppDropdownClose}
              onApply={handleApply}
              isAuthorized={isAuthorized}
              matchingAliasDropdownItems={matchingAliasDropdownItems}
              selectedMatchingAliasDropdown={
                matchingAliasSelectedDeviceAliasName
              }
              matchingAliasDropdownIsOpen={matchingAliasDropdownIsOpen}
              matchingAliasDropdownOnChoose={
                handleMatchingAliasDropdownOnChoose
              }
              matchingAliasDropdownOnClick={handleMatchingAliasDropdownOnClick}
              matchingAliasDropdownOnClose={handleMatchingAliasDropdownOnClose}
              onMatchingAliasInputDropdownChange={
                handleMatchingAliasInputDropdownChange
              }
              selectedDeviceHostname={selectedDevice?.hostname}
              serverStoredAliasName={selectedDevice?.aliasName}
              appDropdownStatus={
                isAllLayoutsLoading
                  ? ComponentStatus.Loading
                  : ComponentStatus.Default
              }
              matchingAliasDropdownStatus={
                isDropdownItemsLoading
                  ? ComponentStatus.Loading
                  : ComponentStatus.Default
              }
            />

            <div className="hostname-info">
              {`Hostname: ${selectedDevice.hostname}`}
            </div>
            <div className="panel-body" style={{margin: '15px 15px 0 15px'}}>
              <div className="generic-empty-state">
                <h4 style={{margin: '90px 0'}}>
                  {!selectedApp
                    ? 'Please select an App Name'
                    : 'No Results Found'}
                </h4>
              </div>
            </div>
          </>
        ) : (
          <>
            <FancyScrollbar
              style={{height: 'calc(100% - 45px)'}}
              autoHide={true}
            >
              <AppNameMatchingAliasWrapper
                appItems={appDropdownItems}
                selectedApp={selectedApp}
                appIsOpen={appDropdownIsOpen}
                onAppChoose={handleAppDropdownChoose}
                onAppClick={handleAppDropdownClick}
                onAppClose={handleAppDropdownClose}
                onApply={handleApply}
                isAuthorized={isAuthorized}
                matchingAliasDropdownItems={matchingAliasDropdownItems}
                selectedMatchingAliasDropdown={
                  matchingAliasSelectedDeviceAliasName
                }
                matchingAliasDropdownIsOpen={matchingAliasDropdownIsOpen}
                matchingAliasDropdownOnChoose={
                  handleMatchingAliasDropdownOnChoose
                }
                matchingAliasDropdownOnClick={
                  handleMatchingAliasDropdownOnClick
                }
                matchingAliasDropdownOnClose={
                  handleMatchingAliasDropdownOnClose
                }
                onMatchingAliasInputDropdownChange={
                  handleMatchingAliasInputDropdownChange
                }
                selectedDeviceHostname={selectedDevice?.hostname}
                serverStoredAliasName={selectedDevice?.aliasName}
                appDropdownStatus={
                  isAllLayoutsLoading
                    ? ComponentStatus.Loading
                    : ComponentStatus.Default
                }
                matchingAliasDropdownStatus={
                  isDropdownItemsLoading
                    ? ComponentStatus.Loading
                    : ComponentStatus.Default
                }
              />
              <div className="hostname-info">
                {`Hostname: ${selectedDevice.hostname}`}
              </div>
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
                    isUsingAnnotationViewer={!!annotationTime}
                    host={''}
                    annotationsViewMode={annotationsViewMode}
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
    timeZone,
    cloudAutoRefresh,
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
