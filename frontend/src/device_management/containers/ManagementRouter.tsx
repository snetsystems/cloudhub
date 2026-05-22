import React, {useState} from 'react'

import _ from 'lodash'
import {Page} from 'src/reusable_ui'
import {
  Me,
  Organization,
  PredictionManualRefresh,
  RefreshRate,
  TimeZones,
} from 'src/types'
import * as SourcesModels from 'src/types/sources'
import TimeZoneToggle from 'src/shared/components/time_zones/TimeZoneToggle'
import {LOGIN_AUTH_TYPE} from 'src/auth/constants'

//page
import DeviceManagement from './DeviceManagement'

//action
import {setAutoRefresh} from 'src/shared/actions/app'
import {setCloudAutoRefresh} from 'src/clouds/actions'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import * as appActions from 'src/shared/actions/app'
import DeviceManagementModal from 'src/device_management/components/DeviceManagementModal'
import {CloudAutoRefresh} from 'src/clouds/types/type'

//component
import ManualRefresh, {
  ManualRefreshProps,
} from 'src/shared/components/ManualRefresh'
import SourceIndicator from 'src/shared/components/SourceIndicator'
import {getTimeOptionByGroup} from 'src/clouds/constants/autoRefresh'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'

interface Props extends ManualRefreshProps {
  me: Me
  source: SourcesModels.Source
  links: any
  isUsingAuth: boolean
  notify: (n: Notification) => void
  organizations: Organization[]
  timeZone: TimeZones
  setTimeZone: typeof appActions.setTimeZone
  autoRefresh: number
  cloudAutoRefresh: CloudAutoRefresh
  onChooseAutoRefresh: (milliseconds: RefreshRate) => void
  onChooseCloudAutoRefresh: (autoRefreshGroup: CloudAutoRefresh) => void
}

function ManagementRouter({
  me,
  source,
  links: {auth, loginAuthType},
  isUsingAuth,
  organizations,
  timeZone,
  setTimeZone,
  autoRefresh,
  cloudAutoRefresh,
  onChooseCloudAutoRefresh,
  onChooseAutoRefresh,
}: Props) {
  const [
    manualRefreshState,
    setManualRefreshState,
  ] = useState<PredictionManualRefresh>({
    key: 'network-device',
    value: Date.now(),
  })

  let providers = []

  if (loginAuthType !== LOGIN_AUTH_TYPE.OAUTH) {
    providers.push('cloudhub')
  }

  if (loginAuthType !== LOGIN_AUTH_TYPE.BASIC) {
    _.forEach(auth, authObj => {
      providers.push(authObj.name)
    })
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

  const handleManualRefresh = () => {
    setManualRefreshState({
      ...manualRefreshState,
      value: Date.now(),
    })
  }
  const renderHeaderRight = () => {
    return (
      <>
        <SourceIndicator />
        <AutoRefreshDropdown
          onChoose={handleChooseAutoRefresh}
          selected={autoRefresh}
          onManualRefresh={handleManualRefresh}
          customAutoRefreshOptions={getTimeOptionByGroup('management')}
          customAutoRefreshSelected={cloudAutoRefresh}
        />

        <TimeZoneToggle onSetTimeZone={setTimeZone} timeZone={timeZone} />
      </>
    )
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Title title={'Network Device Management'} />
        </Page.Header.Left>

        <Page.Header.Right>{renderHeaderRight()}</Page.Header.Right>
      </Page.Header>
      <Page.Contents fullWidth={true}>
        {
          <DeviceManagement
            source={source}
            me={me}
            isUsingAuth={isUsingAuth}
            organizations={organizations}
            autoRefresh={cloudAutoRefresh?.management || 0}
            manualRefresh={manualRefreshState}
          />
        }
      </Page.Contents>
      <DeviceManagementModal />
    </Page>
  )
}

const mstp = ({
  app: {
    persisted: {timeZone, autoRefresh, cloudAutoRefresh},
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
    cloudAutoRefresh,
  }
}

const mdtp = dispatch => ({
  setTimeZone: bindActionCreators(appActions.setTimeZone, dispatch),
  onChooseAutoRefresh: bindActionCreators(setAutoRefresh, dispatch),
  onChooseCloudAutoRefresh: bindActionCreators(setCloudAutoRefresh, dispatch),
})

export default connect(mstp, mdtp, null)(ManualRefresh<Props>(ManagementRouter))
