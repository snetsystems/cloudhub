// Library
import React, {useCallback, useEffect, useRef, useState} from 'react'
import {bindActionCreators} from 'redux'
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

// ETC
import {setFilteredHostForGPUMonitoring} from 'src/gpu_monitoring/actions'
import {fetchNVidiaInfoJson} from 'src/gpu_monitoring/apis'

// Constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

enum TabTypes {
  HOST = 'HOST',
  GPU = 'GPU',
}
interface Props {
  filteredHostForGPUMonitoring?: FilteredHostForGPUMonitoring
  addons?: Addon[]
  setFilteredHostForGPUMonitoring?: (
    filteredHostForGPUMonitoring: FilteredHostForGPUMonitoring
  ) => void
}

function GPUMonitoringDetailsWrapper({
  addons,
  filteredHostForGPUMonitoring,
}: Props) {
  const [activeEditorTab, setActiveEditorTab] = useState<TabTypes>(TabTypes.GPU)
  const [isLoading, setIsLoading] = useState(false)
  const [originalHostNvidiaInfo, setOriginalHostNvidiaInfo] = useState<any>(
    null
  )
  const [selectedGpuInfo, setSelectedGpuInfo] = useState<any>(null)
  const [hostInfo, setHostInfo] = useState<Partial<HostDetailTable> | {}>(null)

  const focusedHost = filteredHostForGPUMonitoring?.hostname
  const focusedHostGPU = filteredHostForGPUMonitoring?.gpuIndex ?? -1
  const previousHost = useRef<string | null>(null)

  const shouldUpdateHost =
    focusedHost &&
    (focusedHost !== previousHost.current ||
      (activeEditorTab === TabTypes.HOST ? !hostInfo : !originalHostNvidiaInfo))

  useEffect(() => {
    if (shouldUpdateHost) {
      activeEditorTab === TabTypes.HOST
        ? fetchHostDetails()
        : fetchNVidiaInfoXML()

      if (focusedHost !== previousHost.current) {
        setHostInfo(null)
        setOriginalHostNvidiaInfo(null)
      }
      previousHost.current = focusedHost
    }
  }, [focusedHost, shouldUpdateHost, activeEditorTab])

  useEffect(() => {
    if (focusedHostGPU !== -1 && originalHostNvidiaInfo?.nvidia_smi_log?.gpu) {
      const gpuData = originalHostNvidiaInfo.nvidia_smi_log.gpu

      if (!Array.isArray(gpuData) || gpuData.length <= focusedHostGPU) {
        return
      }

      setSelectedGpuInfo({
        nvidia_smi_log: {
          ...originalHostNvidiaInfo.nvidia_smi_log,
          gpu: [gpuData[focusedHostGPU]],
        },
      })
    } else {
      setSelectedGpuInfo(null)
    }
  }, [focusedHostGPU, originalHostNvidiaInfo])

  const fetchNVidiaInfoXML = useCallback(async () => {
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
      setSelectedGpuInfo(null)
    } catch (error) {
      console.error('Error fetching NVidia Info XML:', error)
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

  const handleActiveEditorTab = (tab: TabTypes) => {
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
      case TabTypes.HOST:
        return focusedHost ? (
          <div style={{height: 'calc(100% - 40.5px)'}}>
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

      case TabTypes.GPU:
        return focusedHost ? (
          <div style={{height: 'calc(100% - 40.5px)'}}>
            <FancyScrollbar>
              {originalHostNvidiaInfo && (
                <ReactJson
                  displayDataTypes={false}
                  theme={'summerfruit'}
                  style={{
                    fontFamily:
                      'Roboto, Helvetica, Arial, Tahoma, Verdana, sans-serif',
                    height: '100%',
                    margin: '16px',
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
    <div style={{height: '100%', backgroundColor: '#292933'}}>
      <GPUMonitoringDashboardHeader
        cellName="Details"
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
      >
        <div className="gpu-monitoring-detail-header radio-buttons radio-buttons--default radio-buttons--sm">
          <Radio.Button
            id="hostspage-tab-HOST"
            titleText="HOST"
            value={TabTypes.HOST}
            active={activeEditorTab === TabTypes.HOST}
            onClick={() => handleActiveEditorTab(TabTypes.HOST)}
          >
            HOST
          </Radio.Button>
          <Radio.Button
            id="hostspage-tab-GPU"
            titleText="GPU"
            value={TabTypes.GPU}
            active={activeEditorTab === TabTypes.GPU}
            onClick={() => handleActiveEditorTab(TabTypes.GPU)}
          >
            GPU
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

const mdtp = dispatch => ({
  setFilteredHostForGPUMonitoring: bindActionCreators(
    setFilteredHostForGPUMonitoring,
    dispatch
  ),
})

export default connect(mstp, mdtp, null)(GPUMonitoringDetailsWrapper)
