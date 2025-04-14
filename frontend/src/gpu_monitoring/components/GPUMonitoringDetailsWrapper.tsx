// Library
import React, {useCallback, useEffect, useRef, useState} from 'react'
import {connect} from 'react-redux'
import ReactJson from 'react-json-view'

// Components
import LoadingDots from 'src/shared/components/LoadingDots'
import GPUMonitoringDashboardHeader from 'src/gpu_monitoring/components/GPUMonitoringDashboardHeader'
import {Page, Radio} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import GPUMonitoringDetailsHost from 'src/gpu_monitoring/components/GPUMonitoringDetailsHost'
import {Addon} from 'src/types/auth'
import {getAgentDetails} from 'src/hosts/utils'
import {HostDetailTable} from 'src/hosts/types/agent'

// Types
import {FilteredHostForGPUMonitoring} from 'src/types'
import {GPU_DETAIL_TAB_TYPES} from 'src/gpu_monitoring/constants/gpu-monitoring'

// ETC
import {fetchNVidiaInfoJson} from 'src/gpu_monitoring/apis'

// Constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

// Utils
import {getGpuDetails} from 'src/gpu_monitoring/utils'

interface Props {
  filteredHostForGPUMonitoring?: FilteredHostForGPUMonitoring
  addons?: Addon[]
}

function GPUMonitoringDetailsWrapper({
  addons,
  filteredHostForGPUMonitoring,
}: Props) {
  const [activeEditorTab, setActiveEditorTab] = useState<GPU_DETAIL_TAB_TYPES>(
    GPU_DETAIL_TAB_TYPES.GPU
  )
  const [isLoading, setIsLoading] = useState(false)
  const [originalHostNvidiaInfo, setOriginalHostNvidiaInfo] = useState(null)
  const [selectedGpuInfo, setSelectedGpuInfo] = useState(null)
  const [hostInfo, setHostInfo] = useState<Partial<HostDetailTable> | {}>(null)
  const [gpuOverView, setGpuOverView] = useState<Partial<HostDetailTable> | {}>(
    null
  )

  const focusedHost = filteredHostForGPUMonitoring?.hostname
  const focusedHostGPU = filteredHostForGPUMonitoring?.gpuIndex ?? -1
  const previousHost = useRef<string | null>(null)

  const shouldUpdateHost =
    focusedHost &&
    (focusedHost !== previousHost.current ||
      (activeEditorTab === GPU_DETAIL_TAB_TYPES.HOST
        ? !hostInfo
        : !originalHostNvidiaInfo))

  useEffect(() => {
    if (shouldUpdateHost) {
      activeEditorTab === GPU_DETAIL_TAB_TYPES.HOST
        ? fetchHostDetails()
        : fetchNVidiaInfoJSON()

      if (focusedHost !== previousHost.current) {
        setHostInfo(null)
        setOriginalHostNvidiaInfo(null)
      }
      previousHost.current = focusedHost
    }
  }, [focusedHost, shouldUpdateHost, activeEditorTab])

  useEffect(() => {
    if (focusedHostGPU !== -1 && originalHostNvidiaInfo?.gpu) {
      const gpuData = originalHostNvidiaInfo?.gpu

      if (!Array.isArray(gpuData) || gpuData.length <= focusedHostGPU) {
        return
      }
      const updateGpuInfo = {
        ...originalHostNvidiaInfo,
        gpu: gpuData[focusedHostGPU],
      }

      const updateGpuTableInfo = {
        ...originalHostNvidiaInfo,
        gpu: [gpuData[focusedHostGPU]],
      }
      setSelectedGpuInfo(updateGpuInfo)
      setGpuOverView(updateGpuTableInfo)
    } else {
      setGpuOverView(null)
      setSelectedGpuInfo(null)
    }
  }, [focusedHostGPU, originalHostNvidiaInfo])

  const fetchNVidiaInfoJSON = useCallback(async () => {
    const addon = addons.find(addon => addon.name === 'salt')
    if (!addon) {
      console.error('Salt addon not found')
      return
    }

    setIsLoading(true)
    try {
      const data = await fetchNVidiaInfoJson(
        addon.url,
        addon.token,
        focusedHost
      )
      setOriginalHostNvidiaInfo(data ? data : null)
      setGpuOverView(data ? data : null)
      setSelectedGpuInfo(null)
    } catch (error) {
      console.error('Error fetching NVidia Info JSON:', error)
    } finally {
      setIsLoading(false)
    }
  }, [addons, focusedHost])

  const fetchHostDetails = useCallback(async () => {
    const addon = addons.find(addon => addon.name === 'salt')
    if (!addon) {
      console.error('Salt addon not found')
      return
    }

    setIsLoading(true)
    try {
      const hostInfo = await getAgentDetails(
        addon.url,
        addon.token,
        focusedHost
      )
      setHostInfo(hostInfo)
    } catch (error) {
      console.error('Error fetching Host Info:', error)
    } finally {
      setIsLoading(false)
    }
  }, [addons, focusedHost])

  const handleActiveEditorTab = (tab: GPU_DETAIL_TAB_TYPES) => {
    setActiveEditorTab(tab)
  }

  const renderEmptyContent = (message: string) => {
    return (
      <div className="tab-pannel gpu-monitoring-detail-empty">{message}</div>
    )
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <LoadingDots className="graph-panel__refreshing openstack-dots--loading" />
      )
    }

    switch (activeEditorTab) {
      case GPU_DETAIL_TAB_TYPES.HOST:
        return focusedHost ? (
          <div className="gpu-monitoring-detail-table-wrap">
            <FancyScrollbar>
              <GPUMonitoringDetailsHost
                selectInstanceData={hostInfo}
                instanceTypeModal={null}
              />
            </FancyScrollbar>
          </div>
        ) : (
          renderEmptyContent('Please select a Host')
        )

      case GPU_DETAIL_TAB_TYPES.GPU:
        return focusedHost ? (
          <div className="gpu-monitoring-detail-table-wrap">
            <FancyScrollbar>
              <GPUMonitoringDetailsHost
                selectInstanceData={getGpuDetails(
                  gpuOverView || originalHostNvidiaInfo
                )}
                instanceTypeModal={null}
              />
            </FancyScrollbar>
          </div>
        ) : (
          renderEmptyContent('Please select a Host')
        )

      case GPU_DETAIL_TAB_TYPES.GPU_OBJECT:
        return focusedHost ? (
          <div style={{height: 'calc(100% - 40.5px)'}}>
            <FancyScrollbar>
              {originalHostNvidiaInfo && (
                <ReactJson
                  name={false}
                  displayDataTypes={false}
                  theme={'summerfruit'}
                  style={{
                    fontFamily:
                      'Roboto, Helvetica, Arial, Tahoma, Verdana, sans-serif',
                    fontSize: '11px',
                    height: '100%',
                    margin: '12px',
                    backgroundColor: '#292933',
                  }}
                  collapsed={3}
                  src={selectedGpuInfo || originalHostNvidiaInfo}
                />
              )}
              {!originalHostNvidiaInfo && renderEmptyContent('No Data')}
            </FancyScrollbar>
          </div>
        ) : (
          renderEmptyContent('Please select a Host')
        )

      default:
        return null
    }
  }

  return (
    <div className="gpu-monitoring-detail-wrap">
      <GPUMonitoringDashboardHeader
        cellName="Details"
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
      >
        <div className="gpu-monitoring-detail-header radio-buttons radio-buttons--default radio-buttons--sm">
          <Radio.Button
            id="details-tab-HOST"
            titleText="HOST"
            value={GPU_DETAIL_TAB_TYPES.HOST}
            active={activeEditorTab === GPU_DETAIL_TAB_TYPES.HOST}
            onClick={() => handleActiveEditorTab(GPU_DETAIL_TAB_TYPES.HOST)}
          >
            <span className="gpu-monitoring-detail-header-title">
              Host Info
            </span>
          </Radio.Button>
          <Radio.Button
            id="details-tab-GPU"
            titleText="GPU OverView"
            value={GPU_DETAIL_TAB_TYPES.GPU}
            active={activeEditorTab === GPU_DETAIL_TAB_TYPES.GPU}
            onClick={() => handleActiveEditorTab(GPU_DETAIL_TAB_TYPES.GPU)}
          >
            <span className="gpu-monitoring-detail-header-title">
              GPU OverView
            </span>
          </Radio.Button>
          <Radio.Button
            id="details-tab-GPU"
            titleText="GPU Details"
            value={GPU_DETAIL_TAB_TYPES.GPU_OBJECT}
            active={activeEditorTab === GPU_DETAIL_TAB_TYPES.GPU_OBJECT}
            onClick={() =>
              handleActiveEditorTab(GPU_DETAIL_TAB_TYPES.GPU_OBJECT)
            }
          >
            <span className="gpu-monitoring-detail-header-title">
              GPU Details
            </span>
          </Radio.Button>
        </div>
        {isLoading && (
          <LoadingDots className="graph-panel__refreshing openstack-dots--loading" />
        )}
      </GPUMonitoringDashboardHeader>

      <Page className="inventory-hosts-list-page">
        <div style={{height: '100%'}}>{renderContent()}</div>
      </Page>
    </div>
  )
}

const mstp = state => ({
  filteredHostForGPUMonitoring:
    state.gpuMonitoringDashboard.filteredHostForGPUMonitoring,
  addons: state.links.addons,
})

export default connect(mstp, null, null)(GPUMonitoringDetailsWrapper)
