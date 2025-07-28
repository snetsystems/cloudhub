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
  DeviceType,
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
import MatchingAlias from 'src/log_analysis/components/MatchingAlias'
import {Cancel} from 'src/shared/components/ConfirmOrCancel'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import VendorDropdownWrapper from 'src/log_analysis/components/VendorDropdownWrapper'

// Utils
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {generateForHosts} from 'src/utils/tempVars'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {getDeep} from 'src/utils/wrappers'
import {getCellsReactive} from 'src/hosts/utils/getCellsReactive'
import {
  getVendorDropdownItemsByDeviceType,
  isInvalidVendorForDeviceType,
} from 'src/log_analysis/util'

// Actions
import {closePanel} from 'src/shared/actions/sidePanel'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {setSelectedDevice} from 'src/log_analysis/actions/'

// API
import {
  getLayouts,
  getTagValuesForDeviceType,
  getRecentActiveMeasurementsForHost,
} from 'src/hosts/apis'
import {updateDeviceMapping} from 'src/admin/apis/deviceMapping'
import {
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

  const [allLayouts, setAllLayouts] = useState<Layout[]>([])
  const deviceType = (selectedDevice?.deviceType as DeviceType) || 'baremetal'
  const [isFromAgent, setIsFromAgent] = useState(deviceType === 'baremetal')
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
  const [vendorDropdownItems, setVendorDropdownItems] = useState<
    DropdownItem[]
  >(getVendorDropdownItemsByDeviceType(deviceType))
  const [selectedVendor, setSelectedVendor] = useState<string>('')
  const [vendorDropdownIsOpen, setVendorDropdownIsOpen] = useState(false)

  useEffect(() => {
    if (selectedDevice?.aliasName && selectedDevice?.aliasName !== '') {
      setMatchingAliasSelectedDeviceAliasName(selectedDevice.aliasName)
    } else if (selectedDevice?.hostname) {
      setMatchingAliasSelectedDeviceAliasName(selectedDevice.hostname)
    } else {
      setMatchingAliasSelectedDeviceAliasName('')
    }
  }, [selectedDevice?.hostname])

  useEffect(() => {
    const fetchAllLayouts = async () => {
      try {
        const layoutResults = await getLayouts()
        const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])
        setAllLayouts(layouts || [])
      } catch (error) {
        setAllLayouts([])
      }
    }
    fetchAllLayouts()
  }, [])

  useEffect(() => {
    setLayout([])
    if (allLayouts.length > 0) {
      getLayoutForInstance()
    }
  }, [
    matchingAliasSelectedDeviceAliasName,
    deviceType,
    isFromAgent,
    selectedVendor,
    allLayouts,
  ])

  useEffect(() => {
    const fetchDropdownItems = async () => {
      if (!isAuthorized) {
        return
      }

      try {
        const tempVars = generateForHosts(source)
        const tagValues = await getTagValuesForDeviceType(
          source,
          deviceType,
          tempVars,
          isFromAgent,
          selectedVendor
        )
        setMatchingAliasDropdownItems(tagValues)
      } catch (error) {
        console.error('Error fetching dropdown items:', error)
        setMatchingAliasDropdownItems([])
      }
    }

    fetchDropdownItems()
  }, [deviceType, isFromAgent, source, isAuthorized, selectedVendor])

  useEffect(() => {
    const vendorItems = getVendorDropdownItemsByDeviceType(deviceType)
    setVendorDropdownItems(vendorItems)
    setSelectedVendor(selectedDevice?.vendor || '')
  }, [selectedDevice?.hostname, deviceType])

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh?.logAnalysis)
  }, [cloudAutoRefresh?.logAnalysis])

  const getDeviceKeyValue = (selectedDeviceAliasName: string) => {
    if (deviceType === 'ipmi') {
      return {hostname: selectedDeviceAliasName}
    }

    if (isFromAgent) {
      switch (deviceType) {
        case 'baremetal':
        case 'vm':
        case 'switch':
          return {host: selectedDeviceAliasName}
        default:
          return {host: selectedDeviceAliasName}
      }
    }

    switch (deviceType) {
      case 'baremetal':
        // TODO: Currently only VM is considered;
        // need to add support for Hypervisors based on Vendor in the future
        return {esxhostname: selectedDeviceAliasName}
      case 'vm':
        if (selectedVendor.toLowerCase() === 'openstack') {
          return {server_id: selectedDeviceAliasName}
        } else {
          return {vmname: selectedDeviceAliasName}
        }
      case 'switch':
        return {agent_host: selectedDeviceAliasName}
      default:
        return {host: selectedDeviceAliasName}
    }
  }

  useEffect(() => {
    if (!!layout) {
      if (isInvalidVendorForDeviceType(deviceType, selectedVendor)) {
        return
      }

      const deviceKeyValue = getDeviceKeyValue(
        matchingAliasSelectedDeviceAliasName
      )

      setLayoutCells(
        getCellsReactive(layout, source, deviceKeyValue, ratio, null)
      )
    }
  }, [
    layout,
    selfTimeRange,
    matchingAliasSelectedDeviceAliasName,
    deviceType,
    isFromAgent,
    selectedVendor,
  ])

  const fetchMeasurements = async (hostID: string) => {
    const measurements = await getRecentActiveMeasurementsForHost(
      source,
      hostID,
      ['win_cpu', 'cpu'],
      30
    )

    let filteredMeasurements: string[] = []

    if (measurements.includes('win_cpu')) {
      filteredMeasurements = ['win_cpu', 'win_mem', 'win_system', 'disk']
    } else {
      filteredMeasurements = ['cpu', 'mem', 'system', 'disk']
    }

    filteredMeasurements = Array.from(new Set(filteredMeasurements))

    return {filteredMeasurements}
  }

  const filterLayoutsByRule = async () => {
    let filtered: Layout[] = []

    if (deviceType.toLowerCase() === 'ipmi') {
      filtered = allLayouts.filter(layout => layout.app === 'ipmi_sensor')
      return filtered.sort((x, y) => {
        return x.measurement < y.measurement
          ? -1
          : x.measurement > y.measurement
          ? 1
          : 0
      })
    }

    if (isFromAgent) {
      if (
        deviceType.toLowerCase() === 'baremetal' ||
        deviceType.toLowerCase() === 'vm' ||
        deviceType.toLowerCase() === 'switch'
      ) {
        filtered = allLayouts.filter(
          layout => layout.app === 'system' || layout.app === 'win_system'
        )

        if (filtered.length > 0) {
          const {filteredMeasurements} = await fetchMeasurements(
            matchingAliasSelectedDeviceAliasName
          )
          filtered = filtered.filter(layout =>
            filteredMeasurements.includes(layout.measurement)
          )
        }
      }
    } else {
      if (isInvalidVendorForDeviceType(deviceType, selectedVendor)) {
        return []
      }

      if (deviceType.toLowerCase() === 'baremetal') {
        filtered = allLayouts.filter(
          layout =>
            layout.app === 'vsphere' &&
            layout.measurement.startsWith('vsphere_host')
        )
      } else if (deviceType.toLowerCase() === 'vm') {
        if (selectedVendor.toLowerCase() === 'openstack') {
          filtered = allLayouts.filter(layout => layout.app === 'openstack')
        } else {
          filtered = allLayouts.filter(
            layout =>
              layout.app === 'vsphere' &&
              layout.measurement.startsWith('vsphere_vm')
          )
        }
      } else if (deviceType.toLowerCase() === 'switch') {
        filtered = allLayouts.filter(layout => layout.app === 'snmp_nx')
      }
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

  const handleMatchingAliasDropdownOnChoose = (item: DropdownItem) => {
    setMatchingAliasSelectedDeviceAliasName(item.text)
    setMatchingAliasDropdownIsOpen(false)
  }

  const handleMatchingAliasDropdownOnClose = () => {
    setMatchingAliasDropdownIsOpen(false)
  }

  const handleMatchingAliasDropdownOnClick = () => {
    setMatchingAliasDropdownIsOpen(prev => !prev)
  }

  const handleMatchingAliasOnApply = async () => {
    if (selectedDevice?.hostname && matchingAliasSelectedDeviceAliasName) {
      try {
        const data: DeviceMeta = {
          hostname: selectedDevice.hostname,
          aliasName: matchingAliasSelectedDeviceAliasName,
          deviceType: '',
          ip: '',
          orgId: selectedDevice.orgId,
          vendor: selectedDevice.vendor ?? '',
          isDeletable: false,
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

  const handleVendorOnApply = async () => {
    if (selectedDevice?.hostname && selectedVendor) {
      try {
        const data: DeviceMeta = {
          hostname: selectedDevice.hostname,
          aliasName: selectedDevice.aliasName ?? '',
          deviceType: '',
          ip: '',
          orgId: selectedDevice.orgId,
          vendor: selectedVendor,
          isDeletable: false,
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

  const handleVendorDropdownChoose = (item: DropdownItem) => {
    setSelectedVendor(item.text)
    setVendorDropdownIsOpen(false)
  }
  const handleVendorDropdownClick = () => setVendorDropdownIsOpen(prev => !prev)
  const handleVendorDropdownClose = () => setVendorDropdownIsOpen(false)

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
            <VendorDropdownWrapper
              isFromAgent={isFromAgent}
              deviceType={deviceType}
              vendorItems={vendorDropdownItems}
              selectedVendor={selectedVendor}
              vendorIsOpen={vendorDropdownIsOpen}
              onVendorChoose={handleVendorDropdownChoose}
              onVendorClick={handleVendorDropdownClick}
              onVendorClose={handleVendorDropdownClose}
              onVendorApply={handleVendorOnApply}
              isAuthorized={isAuthorized}
            />
            <MatchingAlias
              deviceType={deviceType}
              dropdownItems={matchingAliasDropdownItems}
              dropdownIsOpen={matchingAliasDropdownIsOpen}
              isAuthorized={isAuthorized}
              dropdownOnChoose={handleMatchingAliasDropdownOnChoose}
              dropdownOnClick={handleMatchingAliasDropdownOnClick}
              dropdownOnClose={handleMatchingAliasDropdownOnClose}
              selectedDropdown={matchingAliasSelectedDeviceAliasName}
              onApply={handleMatchingAliasOnApply}
              toggleActive={isFromAgent}
              onToggleChange={onToggleChange}
              toggleDisabled={false}
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
              {/* // TODO Consider Toggle Disabled */}
              <VendorDropdownWrapper
                isFromAgent={isFromAgent}
                deviceType={deviceType}
                vendorItems={vendorDropdownItems}
                selectedVendor={selectedVendor}
                vendorIsOpen={vendorDropdownIsOpen}
                onVendorChoose={handleVendorDropdownChoose}
                onVendorClick={handleVendorDropdownClick}
                onVendorClose={handleVendorDropdownClose}
                onVendorApply={handleVendorOnApply}
                isAuthorized={isAuthorized}
              />
              <MatchingAlias
                deviceType={deviceType}
                dropdownItems={matchingAliasDropdownItems}
                dropdownIsOpen={matchingAliasDropdownIsOpen}
                isAuthorized={isAuthorized}
                dropdownOnChoose={handleMatchingAliasDropdownOnChoose}
                dropdownOnClick={handleMatchingAliasDropdownOnClick}
                dropdownOnClose={handleMatchingAliasDropdownOnClose}
                selectedDropdown={matchingAliasSelectedDeviceAliasName}
                onApply={handleMatchingAliasOnApply}
                toggleActive={isFromAgent}
                onToggleChange={onToggleChange}
                toggleDisabled={false}
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
