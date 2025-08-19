// Library
import React, {useEffect, useState, useMemo, useRef} from 'react'
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
import {LogConfig} from 'src/types/logs'
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
import ChartOptionsOverlay from './ChartOptionsOverlay'
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import {getTimeRangeFromTimestamp} from './LogAnalysisSyslogTable'

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
  logConfig?: LogConfig
  timeStamp?: string
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
  logConfig,
  timeStamp,
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

  const [allLayouts, setAllLayouts] = useState<Layout[]>([])
  const [filteredLayouts, setFilteredLayouts] = useState<Layout[]>([])
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
  const [
    isFilterLayoutsByAppNameLoading,
    setIsFilterLayoutsByAppNameLoading,
  ] = useState(false)
  const [isDropdownItemsLoading, setIsDropdownItemsLoading] = useState(false)
  const [isChartOptionsOverlayOpen, setIsChartOptionsOverlayOpen] = useState(
    false
  )

  useEffect(() => {
    setSelfTimeRange(logTimeRange)
  }, [logTimeRange])

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

  const fetchAllLayouts = async () => {
    setIsAllLayoutsLoading(true)
    try {
      const layoutResults = await getLayouts()
      const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])
      setAllLayouts(layouts || [])

      if (layouts && layouts.length > 0) {
        await filterLayoutsByAppName(layouts)
      }
    } catch (error) {
      setAllLayouts([])
    } finally {
      setIsAllLayoutsLoading(false)
    }
  }

  useEffect(() => {
    fetchAllLayouts()
  }, [source])

  const filterLayoutsByAppName = async (layoutsToFilter?: Layout[]) => {
    const layouts = layoutsToFilter || allLayouts

    if (layouts.length === 0) {
      setFilteredLayouts([])
      setPreFilteredLayouts([])
      setAppDropdownItems([])
      return
    }

    setIsFilterLayoutsByAppNameLoading(true)
    try {
      const tempVars = generateForHosts(source)
      const filteredLayouts = await filterLayoutsByExistingMeasurements(
        layouts,
        source,
        tempVars,
        matchingAliasSelectedDeviceAliasName
      )

      if (!_.isEqual(preFilteredLayouts, filteredLayouts || [])) {
        setFilteredLayouts(filteredLayouts || [])
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
    } catch (error) {
      setFilteredLayouts([])
      setPreFilteredLayouts([])
      setAppDropdownItems([])
    } finally {
      setIsFilterLayoutsByAppNameLoading(false)
    }
  }

  useEffect(() => {
    if (appDropdownIsOpen && allLayouts.length > 0) {
      filterLayoutsByAppName()
    }
  }, [appDropdownIsOpen])

  useEffect(() => {
    if (matchingAliasDropdownIsOpen) {
      const fetchDropdownItems = async () => {
        if (filteredLayouts.length === 0) {
          return
        }

        setIsDropdownItemsLoading(true)
        try {
          const tempVars = generateForHosts(source)
          const tagValues = await getTagValuesForLayoutWhereTagKeys(
            source,
            filteredLayouts,
            tempVars,
            selfTimeRange
          )
          setMatchingAliasDropdownItems(tagValues)

          setTimeout(() => {
            if (matchingAliasInputRef.current) {
              matchingAliasInputRef.current.focus()
            }
          }, 0)
        } catch (error) {
          console.error('Error fetching dropdown items:', error)
          setMatchingAliasDropdownItems([])
        } finally {
          setIsDropdownItemsLoading(false)
        }
      }

      fetchDropdownItems()
    }
  }, [matchingAliasDropdownIsOpen])

  useEffect(() => {
    setLayout([])
    if (filteredLayouts.length > 0) {
      getLayoutForInstance()
    }
  }, [selectedApp, filteredLayouts])

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh?.logAnalysis)
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

      const cells = getCellsReactive(layout, source, whereTag, ratio, null)

      setLayoutCells(queriesFillHandler(cells))
    }
  }, [
    selfTimeRange,
    matchingAliasSelectedDeviceAliasName,
    layout,
    logConfig?.chartOptions?.queryFillOption,
  ])

  useEffect(() => {
    setSelfTimeRange(getTimeRangeFromTimestamp(timeStamp, logConfig))
  }, [logConfig?.chartOptions?.annotationPadding])

  const queriesFillHandler = (layout: Cell[]) => {
    const queries = layout.map(cell => {
      return {
        ...cell,
        queries: cell.queries.map(query => {
          return {
            ...query,
            fill: logConfig?.chartOptions?.queryFillOption ?? 'null',
          }
        }),
      }
    })

    return queries
  }

  const filterLayoutsByRule = async () => {
    let filtered: Layout[] = []

    if (selectedApp && selectedApp !== '') {
      filtered = filteredLayouts.filter(layout => layout.app === selectedApp)
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

  const handleApply = async () => {
    if (selectedDevice?.hostname) {
      try {
        const currentInputValue =
          matchingAliasInputRef.current?.value || selectedDevice.hostname

        const data: DeviceMeta = {
          hostname: selectedDevice.hostname,
          aliasName: currentInputValue,
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
    if (!timeStamp) {
      return null
    }

    try {
      const lowerTime = new Date(timeStamp).getTime()
      return lowerTime
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
        text: `Select Log Time (${timeZone})`,
      },
    ]
  }, [annotationTime, matchingAliasSelectedDeviceAliasName, timeZone])

  const matchingAliasInputRef = useRef<HTMLInputElement>(null)

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
            <Authorized requiredRole={EDITOR_ROLE}>
              <button
                className="btn btn-sm btn-square btn-default"
                onClick={() => setIsChartOptionsOverlayOpen(true)}
              >
                <span className="icon cog-thick" style={{top: '0.1em'}} />
              </button>
            </Authorized>
            <div className="close-button">
              <Cancel
                buttonSize="btn-sm"
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
              serverStoredAliasName={selectedDevice?.aliasName}
              appDropdownStatus={
                isAllLayoutsLoading || isFilterLayoutsByAppNameLoading
                  ? ComponentStatus.Loading
                  : ComponentStatus.Default
              }
              matchingAliasDropdownStatus={
                isAllLayoutsLoading || isDropdownItemsLoading
                  ? ComponentStatus.Loading
                  : ComponentStatus.Default
              }
              matchingAliasInputRef={matchingAliasInputRef}
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
            <div style={{height: 'calc(100% - 160px)'}}>
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
                serverStoredAliasName={selectedDevice?.aliasName}
                appDropdownStatus={
                  isAllLayoutsLoading || isFilterLayoutsByAppNameLoading
                    ? ComponentStatus.Loading
                    : ComponentStatus.Default
                }
                matchingAliasDropdownStatus={
                  isAllLayoutsLoading || isDropdownItemsLoading
                    ? ComponentStatus.Loading
                    : ComponentStatus.Default
                }
                matchingAliasInputRef={matchingAliasInputRef}
              />
              <div className="hostname-info">
                {`Hostname: ${selectedDevice.hostname}`}
              </div>
              <FancyScrollbar>
                <div
                  className="panel-body layout"
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
      {isChartOptionsOverlayOpen && (
        <ChartOptionsOverlay
          isOpen={isChartOptionsOverlayOpen}
          onClose={() => setIsChartOptionsOverlayOpen(false)}
        />
      )}
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
    logs: {logConfig},
  } = state
  return {
    timeZone,
    cloudAutoRefresh,
    selectedDevice,
    logAnalysisManualRefresh,
    logConfig,
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
