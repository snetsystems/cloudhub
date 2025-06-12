import React, {useCallback, useEffect, useState} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'

// Components
import LoadingDots from 'src/shared/components/LoadingDots'
import GPUMonitoringDashboardHeader from 'src/gpu_monitoring/components/GPUMonitoringDashboardHeader'
import GPUMonitoringTreeMap from 'src/gpu_monitoring/components/GPUMonitoringTreeMap'
import {ComponentSize, SlideToggle} from 'src/reusable_ui'

// Types
import {
  FilteredHostForGPUMonitoring,
  MigProfile,
  NotificationAction,
  FetchNVidiaGPUMigLgipResponse,
  FetchNvidiaLocalGrainItemsForGPUResponse,
  NvidiaLocalGrainItemForGPU,
  Source,
} from 'src/types'
import {CloudAutoRefresh} from 'src/clouds/types/type'
import {Addon} from 'src/types/auth'

// Utils
import {processMigProfiles} from 'src/gpu_monitoring/utils'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {generateForHosts} from 'src/utils/tempVars'

// API
import {
  getNVidiaGPUMigLgip,
  getNvidiaGrainsItem,
  getNVidiaSmiDataForHosts,
  getNVidiaSmiMIGDataForHosts,
} from 'src/gpu_monitoring/apis'

// ETC
import {setFilteredHostForGPUMonitoring} from 'src/gpu_monitoring/actions'
import {
  notifyGetNVidiaGPUMigLgipFailed,
  notifyGetNVidiaSmiDataForHostsFailed,
  notifyGetNVidiaSmiMIGDataForHostsFailed,
} from 'src/shared/copy/notifications'
import {notify as notifyAction} from 'src/shared/actions/notifications'

// Constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'
import {EMPTY_FILTERED_HOST_FOR_GPU_MONITORING} from 'src/gpu_monitoring/constants'
import {AddonType} from 'src/shared/constants'

interface Props {
  isMockActive: boolean
  source: Source
  addons?: Addon[]
  gpuMonitoringManualRefresh?: number
  cloudAutoRefresh?: CloudAutoRefresh
  filteredHostForGPUMonitoring?: FilteredHostForGPUMonitoring
  notify?: NotificationAction
  setIsMockActive: React.Dispatch<React.SetStateAction<boolean>>
  setFilteredHostForGPUMonitoring?: (
    filteredHostForGPUMonitoring: FilteredHostForGPUMonitoring
  ) => void
}

const isAddonUrlOn = (name: string, addons): boolean => {
  return addons && addons.some(item => item.name === name && item.url === 'on')
}
const getAddonToken = (name: string, addons): string => {
  return addons?.find(item => item.name === name)?.token ?? ''
}

function GPUMonitoringTreeMapWrapper({
  filteredHostForGPUMonitoring,
  isMockActive,
  cloudAutoRefresh,
  addons,
  gpuMonitoringManualRefresh,
  source,
  notify,
  setFilteredHostForGPUMonitoring,
  setIsMockActive,
}: Props) {
  const [hostsForGPUSmiData, setHostsForGPUSmiData] = useState<any>({})
  const [hostsForGPUSmiMIGData, setHostsForGPUSmiMIGData] = useState<any>({})
  const [
    gpuMonitoringTreeMapLoading,
    setGpuMonitoringTreeMapLoading,
  ] = useState<boolean>(true)
  const [minionHostnameMapping, setMinionHostnameMapping] = useState<
    Record<string, string>
  >({})
  const [migProfilesState, setMigProfilesState] = useState<
    Record<string, MigProfile[]>
  >({})
  const [error, setError] = useState<string>('')

  const isUsingNvidiaGpu = isAddonUrlOn(AddonType.nvidia, addons)
  const isUsingNvidiaProd = getAddonToken(AddonType.nvidia, addons)

  let intervalID

  useEffect(() => {
    fetchAllGpuData()
    fetchNvidiaLocalGrainItems()
    return () =>
      setFilteredHostForGPUMonitoring(EMPTY_FILTERED_HOST_FOR_GPU_MONITORING)
  }, [gpuMonitoringManualRefresh])

  useEffect(() => {
    const controller = new AbortController()

    GlobalAutoRefresher.poll(cloudAutoRefresh.gpuMonitoring)

    if (cloudAutoRefresh.gpuMonitoring) {
      intervalID = setInterval(() => {
        fetchAllGpuData()
        fetchNvidiaLocalGrainItems()
      }, cloudAutoRefresh.gpuMonitoring)
    }
    return () => {
      controller.abort()
      clearInterval(intervalID)
      intervalID = null
      GlobalAutoRefresher.stopPolling()
    }
  }, [cloudAutoRefresh.gpuMonitoring])

  const fetchNVidiaSmiDataForHosts = async () => {
    const tempVars = generateForHosts(source)
    const resp = await getNVidiaSmiDataForHosts(
      source.links.proxy,
      source.telegraf,
      tempVars
    )
    return resp
  }

  const fetchNVidiaSmiMIGDataForHosts = async () => {
    const tempVars = generateForHosts(source)
    const resp = await getNVidiaSmiMIGDataForHosts(
      source.links.proxy,
      source.telegraf,
      tempVars
    )
    return resp
  }

  const fetchNVidiaGPUMigLgip = useCallback(async () => {
    const addon = addons.find(addon => addon.name === 'salt')
    if (!addon) {
      throw new Error('Salt addon not found')
    }

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token

    const {data} = await getNVidiaGPUMigLgip(saltMasterUrl, saltMasterToken)
    const response = data as FetchNVidiaGPUMigLgipResponse
    const processedMigProfiles = processMigProfiles(response)
    return processedMigProfiles
  }, [addons])

  const fetchAllGpuData = async () => {
    setGpuMonitoringTreeMapLoading(true)

    const [
      smiDataResult,
      smiMIGDataResult,
      migLgipResult,
    ] = await Promise.allSettled([
      fetchNVidiaSmiDataForHosts(),
      fetchNVidiaSmiMIGDataForHosts(),
      fetchNVidiaGPUMigLgip(),
    ])

    let hasError = false
    if (smiDataResult.status === 'fulfilled') {
      setHostsForGPUSmiData(smiDataResult.value)
    } else {
      setHostsForGPUSmiData({})
      setError('Failed to fetch NVIDIA SMI data')
      hasError = true
      notify(notifyGetNVidiaSmiDataForHostsFailed())
      console.error(smiDataResult.reason)
    }

    if (smiMIGDataResult.status === 'fulfilled') {
      setHostsForGPUSmiMIGData(smiMIGDataResult.value)
    } else {
      setHostsForGPUSmiMIGData({})
      setError('Failed to fetch NVIDIA SMI MIG data')
      hasError = true
      notify(notifyGetNVidiaSmiMIGDataForHostsFailed())
      console.error(smiMIGDataResult.reason)
    }

    if (migLgipResult.status === 'fulfilled') {
      setMigProfilesState(migLgipResult.value)
    } else {
      setMigProfilesState({})
      setError('Failed to fetch NVIDIA MIG profiles')
      hasError = true
      notify(notifyGetNVidiaGPUMigLgipFailed())
      console.error(migLgipResult.reason)
    }

    if (!hasError) {
      setError('')
    }

    setGpuMonitoringTreeMapLoading(false)
  }

  const fetchNvidiaLocalGrainItems = useCallback(async () => {
    const addon = addons.find(addon => addon.name === 'salt')
    if (!addon) {
      console.error('Salt addon not found')
      return
    }
    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token

    try {
      const {data} = await getNvidiaGrainsItem(saltMasterUrl, saltMasterToken)
      const response = data as FetchNvidiaLocalGrainItemsForGPUResponse
      const mapping: Record<string, string> = {}

      response.return.forEach(item => {
        Object.keys(item).forEach(key => {
          const grainItem = item[key] as NvidiaLocalGrainItemForGPU
          const nvidiaGpu = grainItem.gpus.find(
            gpu => gpu.vendor.toLowerCase() === 'nvidia'
          )
          let displayName = grainItem.localhost
          if (nvidiaGpu) {
            displayName = `${displayName} : ${nvidiaGpu.model}`
          }
          mapping[key] = displayName
        })
      })
      setMinionHostnameMapping(mapping)
    } catch (error) {
      console.error(error)
      setError('Failed to fetch NVIDIA Local Grain Items')
    }
  }, [addons])

  const handleHostnameNodeClick = (
    filteredHost: string,
    filteredGPUIndex: number
  ) => {
    if (typeof filteredHost !== 'string' || filteredHost.trim() === '') {
      return
    }

    const isSameHostAndGPUIndex =
      filteredHostForGPUMonitoring?.hostname === filteredHost &&
      filteredHostForGPUMonitoring?.gpuIndex === filteredGPUIndex

    if (isSameHostAndGPUIndex) {
      setFilteredHostForGPUMonitoring(EMPTY_FILTERED_HOST_FOR_GPU_MONITORING)
      return
    }

    setFilteredHostForGPUMonitoring({
      hostname: filteredHost,
      gpuIndex: -1,
      gi: -1,
      ci: -1,
      migMode: 'N/A',
    })
  }

  const handleGPUIndexNodeClick = (
    filteredHost: string,
    filteredGPUIndex: number
  ) => {
    if (
      typeof filteredHost !== 'string' ||
      typeof filteredGPUIndex !== 'number'
    ) {
      return
    }

    const isSameHostAndGPUIndex =
      filteredHostForGPUMonitoring?.hostname === filteredHost &&
      filteredHostForGPUMonitoring?.gpuIndex === filteredGPUIndex

    if (isSameHostAndGPUIndex) {
      setFilteredHostForGPUMonitoring(EMPTY_FILTERED_HOST_FOR_GPU_MONITORING)
      return
    }

    const gpuData = hostsForGPUSmiData[filteredHost]?.find(
      item => item.gpuIndex === filteredGPUIndex
    )
    const migMode = gpuData ? gpuData.migMode : 'Disabled'

    setFilteredHostForGPUMonitoring({
      hostname: filteredHost,
      gpuIndex: filteredGPUIndex,
      gi: -1,
      ci: -1,
      migMode,
    })
  }

  const renderMockSlideToggle = (): JSX.Element => {
    return (
      <div
        className="gpu-monitoring-slide--inner"
        title={isMockActive ? 'Remove Mock Data' : 'Add Mock Data'}
      >
        <label className="gpu-monitoring-slide--label">
          {isMockActive ? 'Remove Mock Data' : 'Add Mock Data'}
        </label>
        <div
          className="gpu-monitoring-slide--toggle-wrapper"
          onMouseDown={e => e.stopPropagation()}
          onDragStart={e => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={e => {
            e.stopPropagation()
            setIsMockActive(!isMockActive)
          }}
        >
          <SlideToggle
            active={isMockActive}
            onChange={() => {
              setIsMockActive(!isMockActive)
            }}
            size={ComponentSize.ExtraSmall}
          />
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={{height: '100%', backgroundColor: '#292933'}}>
        <GPUMonitoringDashboardHeader
          cellName={`GPU Device Status`}
          cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
          cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        >
          {!error && gpuMonitoringTreeMapLoading && (
            <LoadingDots
              className={'graph-panel__refreshing openstack-dots--loading'}
            />
          )}
          {isUsingNvidiaGpu &&
            isUsingNvidiaProd === 'dev' &&
            renderMockSlideToggle()}
        </GPUMonitoringDashboardHeader>

        {error ? (
          <div style={{padding: '20px'}}>
            {'Unable to get GPU Device Status'}
          </div>
        ) : (
          <GPUMonitoringTreeMap
            isMockActive={isMockActive}
            filteredHostForGPUMonitoring={filteredHostForGPUMonitoring}
            hostsForGPUSmiData={hostsForGPUSmiData}
            hostsForGPUSmiMIGData={hostsForGPUSmiMIGData}
            migProfilesState={migProfilesState}
            onHostnameNodeClick={handleHostnameNodeClick}
            onGPUIndexNodeClick={handleGPUIndexNodeClick}
            minionHostnameMapping={minionHostnameMapping}
          />
        )}
      </div>
    </>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {cloudAutoRefresh},
    },
    links: {addons},
    gpuMonitoringDashboard: {
      gpuMonitoringManualRefresh,
      filteredHostForGPUMonitoring,
    },
  } = state
  return {
    cloudAutoRefresh,
    addons,
    filteredHostForGPUMonitoring,
    gpuMonitoringManualRefresh,
  }
}

const mdtp = dispatch => ({
  setFilteredHostForGPUMonitoring: bindActionCreators(
    setFilteredHostForGPUMonitoring,
    dispatch
  ),
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(mstp, mdtp, null)(GPUMonitoringTreeMapWrapper)
