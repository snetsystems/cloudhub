import React from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'

// Components
import LoadingDots from 'src/shared/components/LoadingDots'
import GPUMonitoringDashboardHeader from 'src/gpu_monitoring/components/GPUMonitoringDashboardHeader'
import GPUMonitoringTreeMap from 'src/gpu_monitoring/components/GPUMonitoringTreeMap'
import {ComponentSize, SlideToggle} from 'src/reusable_ui'

// Types
import {
  HostsForGPUSmiData,
  HostsForGPUSmiMIGData,
  FilteredHostForGPUMonitoring,
  MigProfile,
} from 'src/types'

// ETC
import {setFilteredHostForGPUMonitoring} from 'src/gpu_monitoring/actions'

// Constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'
import {EMPTY_FILTERED_HOST_FOR_GPU_MONITORING} from 'src/gpu_monitoring/constants'

interface Props {
  minionHostnameMapping: Record<string, string>
  hostsForGPUSmiData: HostsForGPUSmiData
  hostsForGPUSmiMIGData: HostsForGPUSmiMIGData
  migProfilesState: Record<string, MigProfile[]>
  isLoading: boolean
  isMockActive: boolean
  filteredHostForGPUMonitoring?: FilteredHostForGPUMonitoring
  setIsMockActive: React.Dispatch<React.SetStateAction<boolean>>
  setFilteredHostForGPUMonitoring?: (
    filteredHostForGPUMonitoring: FilteredHostForGPUMonitoring
  ) => void
}

function GPUMonitoringTreeMapWrapper({
  filteredHostForGPUMonitoring,
  minionHostnameMapping,
  hostsForGPUSmiData,
  hostsForGPUSmiMIGData,
  migProfilesState,
  isMockActive,
  isLoading,
  setFilteredHostForGPUMonitoring,
  setIsMockActive,
}: Props) {
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
          {isLoading && (
            <LoadingDots
              className={'graph-panel__refreshing openstack-dots--loading'}
            />
          )}
          {renderMockSlideToggle()}
        </GPUMonitoringDashboardHeader>

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
      </div>
    </>
  )
}

const mstp = state => {
  const {
    app: {
      ephemeral: {inPresentationMode},
    },
    gpuMonitoringDashboard: {filteredHostForGPUMonitoring},
  } = state
  return {
    inPresentationMode,
    filteredHostForGPUMonitoring,
  }
}

const mdtp = dispatch => ({
  setFilteredHostForGPUMonitoring: bindActionCreators(
    setFilteredHostForGPUMonitoring,
    dispatch
  ),
})

export default connect(mstp, mdtp, null)(GPUMonitoringTreeMapWrapper)
