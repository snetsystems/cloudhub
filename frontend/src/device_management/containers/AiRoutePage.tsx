import React, {useEffect, useState} from 'react'
import {InjectedRouter, RouterState} from 'react-router'

import _ from 'lodash'
import {Page, Radio} from 'src/reusable_ui'
import {
  HeaderNavigationObj,
  INPUT_TIME_TYPE,
  Me,
  Organization,
  PredictionManualRefresh,
  RefreshRate,
  TimeRange,
  TimeZones,
} from 'src/types'
import * as SourcesModels from 'src/types/sources'
import TimeZoneToggle from 'src/shared/components/time_zones/TimeZoneToggle'
import {LOGIN_AUTH_TYPE} from 'src/auth/constants'

// Container
import GPUMonitoringPage from 'src/gpu_monitoring/containers/GPUMonitoringPage'
import PredictionPage from 'src/device_management/containers/PredictionPage'

//page
import DeviceManagement from './DeviceManagement'

//action
import {setAutoRefresh} from 'src/shared/actions/app'
import {setCloudAutoRefresh} from 'src/clouds/actions'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import * as appActions from 'src/shared/actions/app'
import DeviceManagementModal from 'src/device_management/components/DeviceManagementModal'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'
import {
  setHistogramDate,
  setPredictionManualRefresh,
  setStateInitAction,
} from 'src/device_management/actions'
import {
  setGPUMonitoringManualRefresh,
  setGPUMonitoringStateInit,
} from 'src/gpu_monitoring/actions'

//component
import ManualRefresh, {
  ManualRefreshProps,
} from 'src/shared/components/ManualRefresh'
import SourceIndicator from 'src/shared/components/SourceIndicator'
import {getTimeOptionByGroup} from 'src/clouds/constants/autoRefresh'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import {setCloudTimeRange} from 'src/clouds/actions/clouds'
import {CLOUD_TIME_RANGE} from 'src/shared/data/timeRanges'

interface RouterProps extends InjectedRouter {
  params: RouterState['params']
}

interface Props extends ManualRefreshProps {
  me: Me
  source: SourcesModels.Source
  links: any
  isUsingAuth: boolean
  notify: (n: Notification) => void
  organizations: Organization[]
  timeZone: TimeZones
  setTimeZone: typeof appActions.setTimeZone
  params: {tab: string}
  autoRefresh: number
  cloudAutoRefresh: CloudAutoRefresh
  onChooseAutoRefresh: (milliseconds: RefreshRate) => void
  onChooseCloudAutoRefresh: (autoRefreshGroup: CloudAutoRefresh) => void
  router: RouterProps
  cloudTimeRange: CloudTimeRange
  onChooseCloudTimeRange: (value: CloudTimeRange) => void
  setPredictionManualRefresh: () => void
  setStateInitAction: () => void
  setHistogramDate: (value: TimeRange) => void
  setGPUMonitoringManualRefresh: () => void
  setGPUMonitoringStateInit: () => void
}

const defaultHeaderRadioButtons: HeaderNavigationObj[] = [
  {
    id: 'hostspage-tab-device-management',
    titleText: 'Device Management',
    value: 'device-management',
    active: 'device-management',
    label: 'Device Management',
  },
  {
    id: 'hostspage-tab-prediction',
    titleText: 'Anomaly Prediction',
    value: 'prediction',
    active: 'prediction',
    label: 'Anomaly Prediction',
  },
]

const AiRoutePage = (props: Props) => {
  const {
    me,
    source,
    links: {auth, loginAuthType},
    isUsingAuth,
    organizations,
    timeZone,
    setTimeZone,
    router,
    autoRefresh,
    onChooseCloudTimeRange,
    cloudAutoRefresh,
    onChooseCloudAutoRefresh,
    onChooseAutoRefresh,
    cloudTimeRange,
    setPredictionManualRefresh,
    setStateInitAction,
    setHistogramDate,
    setGPUMonitoringManualRefresh,
    setGPUMonitoringStateInit,
  } = props

  const currentRoute = router.params?.tab

  const [
    manualRefreshState,
    setManualRefreshState,
  ] = useState<PredictionManualRefresh>({
    key: 'network-device',
    value: Date.now(),
  })

  useEffect(() => {
    if (typeof cloudAutoRefresh?.prediction !== 'number') {
      onChooseCloudAutoRefresh({
        prediction: 5000,
      })
    }

    if (typeof cloudAutoRefresh?.gpuMonitoring !== 'number') {
      onChooseCloudAutoRefresh({
        gpuMonitoring: 5000,
      })
    }
  }, [])

  let providers = []

  if (loginAuthType !== LOGIN_AUTH_TYPE.OAUTH) {
    providers.push('cloudhub')
  }

  if (loginAuthType !== LOGIN_AUTH_TYPE.BASIC) {
    _.forEach(auth, authObj => {
      providers.push(authObj.name)
    })
  }

  const handleApplyTime = (timeRange: TimeRange): void => {
    setHistogramDate(null)

    onChooseCloudTimeRange({
      prediction: {
        ...timeRange,
        format: !!timeRange.lowerFlux
          ? INPUT_TIME_TYPE.RELATIVE_TIME
          : INPUT_TIME_TYPE.TIMESTAMP,
      },
    })
  }

  const handleApplyTimeForGPUMonitoring = (timeRange: TimeRange): void => {
    onChooseCloudTimeRange({
      gpuMonitoring: {
        ...timeRange,
        format: !!timeRange.lowerFlux
          ? INPUT_TIME_TYPE.RELATIVE_TIME
          : INPUT_TIME_TYPE.TIMESTAMP,
      },
    })
  }

  const handleManualRefresh = () => {
    //redux
    setPredictionManualRefresh()
    setStateInitAction()

    setManualRefreshState({
      ...manualRefreshState,
      value: Date.now(),
    })
  }

  const handleManualRefreshForGPUMonitoring = () => {
    setGPUMonitoringManualRefresh()
    setGPUMonitoringStateInit()
  }

  const onChooseActiveTab = (activeTab: string) => {
    router.push(`/sources/${source.id}/ai/${activeTab}`)
  }

  const handleChooseAutoRefresh = (option: {
    milliseconds: RefreshRate
    group?: string
  }) => {
    const {milliseconds, group} = option
    group
      ? onChooseCloudAutoRefresh({[group]: milliseconds})
      : onChooseAutoRefresh(milliseconds)
  }

  const renderHeaderCenter = () => {
    if (currentRoute === 'gpu-monitoring') return <></>
    return (
      <div className="radio-buttons radio-buttons--default radio-buttons--sm radio-buttons--stretch">
        {defaultHeaderRadioButtons.map(rBtn => (
          <Radio.Button
            key={rBtn.titleText}
            id={rBtn.id}
            titleText={rBtn.titleText}
            value={rBtn.value}
            active={currentRoute === rBtn.active}
            onClick={onChooseActiveTab}
          >
            {rBtn.label}
          </Radio.Button>
        ))}
      </div>
    )
  }

  const renderHeaderRight = () => {
    return (
      <>
        <SourceIndicator />
        {currentRoute === 'gpu-monitoring' ? (
          <>
            <AutoRefreshDropdown
              onChoose={handleChooseAutoRefresh}
              selected={autoRefresh}
              onManualRefresh={handleManualRefreshForGPUMonitoring}
              customAutoRefreshOptions={getTimeOptionByGroup('gpuMonitoring')}
              customAutoRefreshSelected={cloudAutoRefresh}
            />
            <TimeRangeDropdown
              // @ts-ignore
              onChooseTimeRange={handleApplyTimeForGPUMonitoring}
              selected={
                cloudTimeRange?.gpuMonitoring ?? CLOUD_TIME_RANGE.gpuMonitoring
              }
            />
          </>
        ) : (
          <>
            <AutoRefreshDropdown
              onChoose={handleChooseAutoRefresh}
              selected={autoRefresh}
              onManualRefresh={handleManualRefresh}
              customAutoRefreshOptions={getTimeOptionByGroup('prediction')}
              customAutoRefreshSelected={cloudAutoRefresh}
            />
            {currentRoute === 'prediction' && (
              <TimeRangeDropdown
                //@ts-ignore
                onChooseTimeRange={handleApplyTime}
                selected={
                  cloudTimeRange?.prediction ?? CLOUD_TIME_RANGE.prediction
                }
              />
            )}
          </>
        )}
        <TimeZoneToggle onSetTimeZone={setTimeZone} timeZone={timeZone} />
      </>
    )
  }

  const renderPageContent = () => {
    switch (currentRoute) {
      case 'device-management':
        return (
          // @ts-ignore
          <DeviceManagement
            source={source}
            me={me}
            isUsingAuth={isUsingAuth}
            organizations={organizations}
            autoRefresh={cloudAutoRefresh?.prediction || 0}
            manualRefresh={manualRefreshState}
          />
        )
      case 'prediction':
        return (
          // @ts-ignore
          <PredictionPage me={me} source={source} />
        )
      case 'gpu-monitoring':
        return (
          // @ts-ignore
          <GPUMonitoringPage me={me} source={source} />
        )
      default:
        return null
    }
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Title
            title={
              currentRoute === 'gpu-monitoring'
                ? 'NVIDIA GPU Map'
                : 'Network Device'
            }
          />
        </Page.Header.Left>
        <Page.Header.Center
          widthPixels={defaultHeaderRadioButtons.length * 150}
        >
          {renderHeaderCenter()}
        </Page.Header.Center>
        <Page.Header.Right>{renderHeaderRight()}</Page.Header.Right>
      </Page.Header>
      <Page.Contents fullWidth={true}>{renderPageContent()}</Page.Contents>
      <DeviceManagementModal />
    </Page>
  )
}

const mstp = ({
  app: {
    persisted: {timeZone, autoRefresh, cloudAutoRefresh, cloudTimeRange},
  },
  adminCloudHub: {organizations},
  auth: {isUsingAuth, me},
}) => {
  return {
    organizations,
    isUsingAuth,
    me,
    timeZone,
    autoRefresh,
    cloudTimeRange,
    cloudAutoRefresh,
  }
}

const mdtp = dispatch => ({
  setTimeZone: bindActionCreators(appActions.setTimeZone, dispatch),
  onChooseAutoRefresh: bindActionCreators(setAutoRefresh, dispatch),
  onChooseCloudTimeRange: bindActionCreators(setCloudTimeRange, dispatch),
  onChooseCloudAutoRefresh: bindActionCreators(setCloudAutoRefresh, dispatch),
  setPredictionManualRefresh: bindActionCreators(
    setPredictionManualRefresh,
    dispatch
  ),
  setStateInitAction: bindActionCreators(setStateInitAction, dispatch),
  setHistogramDate: bindActionCreators(setHistogramDate, dispatch),
  setGPUMonitoringManualRefresh: bindActionCreators(
    setGPUMonitoringManualRefresh,
    dispatch
  ),
  setGPUMonitoringStateInit: bindActionCreators(
    setGPUMonitoringStateInit,
    dispatch
  ),
})

export default connect(mstp, mdtp, null)(ManualRefresh<Props>(AiRoutePage))
