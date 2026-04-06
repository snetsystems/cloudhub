import React, {useEffect, useState} from 'react'
import {RouterProps} from 'react-router'

import {Page} from 'src/reusable_ui'
import {
  Me,
  Organization,
  PredictionManualRefresh,
  RefreshRate,
  TimeRange,
  TimeZones,
} from 'src/types'
import * as SourcesModels from 'src/types/sources'
import TimeZoneToggle from 'src/shared/components/time_zones/TimeZoneToggle'

// Container
import PredictionPage from 'src/device_management/containers/PredictionPage'

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

import ManualRefresh, {
  ManualRefreshProps,
} from 'src/shared/components/ManualRefresh'
import SourceIndicator from 'src/shared/components/SourceIndicator'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import {getTimeOptionByGroup} from 'src/clouds/constants/autoRefresh'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import {setCloudTimeRange} from 'src/clouds/actions/clouds'
import {CLOUD_TIME_RANGE, timeRanges} from 'src/shared/data/timeRanges'

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
  onChooseCloudTimeRange: (timeRange: CloudTimeRange) => void
  setPredictionManualRefresh: () => void
  setStateInitAction: () => void
  setHistogramDate: (value: TimeRange | null) => void
}

function PredictionRouter({
  me,
  source,
  autoRefresh,
  cloudAutoRefresh,
  onChooseAutoRefresh,
  onChooseCloudAutoRefresh,
  setPredictionManualRefresh,
  setTimeZone,
  timeZone,
  cloudTimeRange,
  onChooseCloudTimeRange,
  setHistogramDate,
}: Props) {
  const [
    manualRefreshState,
    setManualRefreshState,
  ] = useState<PredictionManualRefresh>({
    key: 'network-device',
    value: Date.now(),
  })

  const handleChooseAutoRefresh = (option: {
    milliseconds: RefreshRate
    group?: string
  }) => {
    const {milliseconds, group} = option
    group
      ? onChooseCloudAutoRefresh({[group]: milliseconds})
      : onChooseAutoRefresh(milliseconds)
  }

  const handleManualRefresh = () => {
    setPredictionManualRefresh()
    setStateInitAction()

    setManualRefreshState({
      ...manualRefreshState,
      value: Date.now(),
    })
  }

  const handleChooseTimeRange = ({lower, upper}) => {
    setHistogramDate(null)
    if (upper) {
      onChooseCloudTimeRange({prediction: {lower, upper}})
    } else {
      onChooseCloudTimeRange({
        prediction: timeRanges.find(tr => tr.lower === lower),
      })
    }
  }

  const renderHeaderRight = () => {
    return (
      <>
        <SourceIndicator />
        <AutoRefreshDropdown
          onChoose={handleChooseAutoRefresh}
          selected={autoRefresh}
          onManualRefresh={handleManualRefresh}
          customAutoRefreshOptions={getTimeOptionByGroup('prediction')}
          customAutoRefreshSelected={cloudAutoRefresh}
        />
        <TimeRangeDropdown
          onChooseTimeRange={handleChooseTimeRange}
          selected={cloudTimeRange?.prediction ?? CLOUD_TIME_RANGE.prediction}
        />

        <TimeZoneToggle onSetTimeZone={setTimeZone} timeZone={timeZone} />
      </>
    )
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Title title={'Device Management'} />
        </Page.Header.Left>

        <Page.Header.Right>{renderHeaderRight()}</Page.Header.Right>
      </Page.Header>
      <Page.Contents fullWidth={true}>
        <PredictionPage me={me} source={source} />
      </Page.Contents>
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
})

export default connect(mstp, mdtp, null)(ManualRefresh<Props>(PredictionRouter))
