// Library
import React, {useEffect, useMemo, useState, useCallback} from 'react'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import _ from 'lodash'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

// Components
import {Page} from 'src/reusable_ui'
import GPUMonitoringTreeMapWrapper from 'src/gpu_monitoring/components/GPUMonitoringTreeMapWrapper'

// Type
import {CloudAutoRefresh} from 'src/clouds/types/type'
import * as DashboardsModels from 'src/types/dashboards'
import {
  Cell,
  Source,
  NotificationAction,
  FetchNvidiaLocalGrainItemsForGPUResponse,
  NvidiaLocalGrainItemForGPU,
  FetchNVidiaGPUMigLgipResponse,
  MigProfile,
} from 'src/types'
import {Addon} from 'src/types/auth'

// Constants
import {
  EMPTY_FILTERED_HOST_FOR_GPU_MONITORING,
  FIXTURE_GPU_MONITORING_CELLS,
} from 'src/gpu_monitoring/constants'
import {DASHBOARD_LAYOUT_ROW_HEIGHT, LAYOUT_MARGIN} from 'src/shared/constants'
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'

// Util
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {generateForHosts} from 'src/utils/tempVars'
import {processMigProfiles} from 'src/gpu_monitoring/utils'

// API
import {
  getNVidiaGPUMigLgip,
  getNvidiaGrainsItem,
  getNVidiaSmiDataForHosts,
  getNVidiaSmiMIGDataForHosts,
} from 'src/gpu_monitoring/apis'

// ETC
import {setFilteredHostForGPUMonitoring} from 'src/gpu_monitoring/actions'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  notifyGetNVidiaGPUMigLgipFailed,
  notifyGetNVidiaSmiDataForHostsFailed,
  notifyGetNVidiaSmiMIGDataForHostsFailed,
} from 'src/shared/copy/notifications'

interface Props {
  source: Source
  addons: Addon[]
  gpuMonitoringManualRefresh: number
  cloudAutoRefresh?: CloudAutoRefresh
  inPresentationMode?: boolean
  notify?: NotificationAction
}

interface TempProps {
  cell: Cell
  source: Source
}

function GPUMonitoringDashBoard({
  inPresentationMode,
  source,
  cloudAutoRefresh,
  addons,
  gpuMonitoringManualRefresh,
  notify,
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

  const GridLayout = WidthProvider(ReactGridLayout)
  const savedCells: DashboardsModels.Cell[] = JSON.parse(
    localStorage.getItem('GPU-Monitoring-cells')
  )
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

    if (smiDataResult.status === 'fulfilled') {
      setHostsForGPUSmiData(smiDataResult.value)
    } else {
      setHostsForGPUSmiData({})
      notify(notifyGetNVidiaSmiDataForHostsFailed())
      console.error(smiDataResult.reason)
    }

    if (smiMIGDataResult.status === 'fulfilled') {
      setHostsForGPUSmiMIGData(smiMIGDataResult.value)
    } else {
      setHostsForGPUSmiMIGData({})
      notify(notifyGetNVidiaSmiMIGDataForHostsFailed())
      console.error(smiMIGDataResult.reason)
    }

    if (migLgipResult.status === 'fulfilled') {
      setMigProfilesState(migLgipResult.value)
    } else {
      setMigProfilesState({})
      notify(notifyGetNVidiaGPUMigLgipFailed())
      console.error(migLgipResult.reason)
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
    }
  }, [addons])

  const cells = useMemo(() => {
    const defaultCells = FIXTURE_GPU_MONITORING_CELLS(source)

    if (!!savedCells) {
      return savedCells
    } else {
      return defaultCells
    }
  }, [savedCells])

  const setLocalCells = (cells: DashboardsModels.Cell[]) => {
    localStorage.setItem('GPU-Monitoring-cells', JSON.stringify(cells))
  }

  const handleLayoutChange = layout => {
    let changed = false

    const newCells = cells.map(cell => {
      const l = layout.find(ly => ly.i === cell.i)

      if (
        cell.x !== l.x ||
        cell.y !== l.y ||
        cell.h !== l.h ||
        cell.w !== l.w
      ) {
        changed = true
      }

      const newLayout = {
        x: l.x,
        y: l.y,
        h: l.h,
        w: l.w,
      }

      return {
        ...cell,
        ...newLayout,
      }
    })

    if (changed) {
      setLocalCells(newCells as DashboardsModels.Cell[])
    }
  }

  const layoutRender = ({cell}: TempProps) => {
    if (!cell) return null
    switch (cell.i) {
      case 'gpu-monitoring': {
        return (
          <Authorized
            requiredRole={EDITOR_ROLE}
            propsOverride={{
              isEditable: false,
            }}
          >
            <GPUMonitoringTreeMapWrapper
              minionHostnameMapping={minionHostnameMapping}
              hostsForGPUSmiData={hostsForGPUSmiData}
              hostsForGPUSmiMIGData={hostsForGPUSmiMIGData}
              migProfilesState={migProfilesState}
              isLoading={gpuMonitoringTreeMapLoading}
            />
          </Authorized>
        )
      }
      default:
        return null
    }
  }

  return (
    <>
      <Page className="gpu-monitoring-page">
        <Page.Contents fullWidth={true} inPresentationMode={inPresentationMode}>
          <div className="dashboard container-fluid full-width">
            {!!cells && cells.length > 0 && (
              <Authorized
                requiredRole={EDITOR_ROLE}
                propsOverride={{
                  isDraggable: false,
                  isResizable: false,
                  draggableHandle: null,
                }}
              >
                <GridLayout
                  className="layout"
                  layout={cells}
                  cols={96}
                  rowHeight={DASHBOARD_LAYOUT_ROW_HEIGHT}
                  margin={[LAYOUT_MARGIN, LAYOUT_MARGIN]}
                  containerPadding={[0, 0]}
                  draggableHandle={'.gpu-monitoring-dash-graph--draggable'}
                  onLayoutChange={handleLayoutChange}
                  useCSSTransforms={false}
                  isDraggable={true}
                  isResizable={true}
                  onResizeStop={(_, __, ___, ____, _____, resizeHandle) => {
                    const parentElement = resizeHandle?.parentElement

                    if (parentElement?.classList.contains('resizing')) {
                      parentElement.classList.remove('resizing')
                    }
                  }}
                >
                  {cells?.map(cell => {
                    return (
                      <div key={cell.i}>
                        {layoutRender({
                          cell: cell,
                          source: source,
                        })}
                      </div>
                    )
                  })}
                </GridLayout>
              </Authorized>
            )}
          </div>
        </Page.Contents>
      </Page>
    </>
  )
}

const mstp = state => {
  const {
    app: {
      ephemeral: {inPresentationMode},
      persisted: {cloudAutoRefresh},
    },
    auth: {isUsingAuth},
    links: {addons},
    gpuMonitoringDashboard: {gpuMonitoringManualRefresh},
  } = state

  return {
    isUsingAuth,
    cloudAutoRefresh,
    inPresentationMode,
    addons,
    gpuMonitoringManualRefresh,
  }
}

const mdtp = dispatch => ({
  notify: bindActionCreators(notifyAction, dispatch),
})

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(
  connect(mstp, mdtp, null)(GPUMonitoringDashBoard),
  isEqual
)
