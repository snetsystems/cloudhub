import React, {useState} from 'react'
import _ from 'lodash'
import {Page, Radio} from 'src/reusable_ui'
import SubSections from 'src/shared/components/SubSections'
import {
  HeaderNavigationObj,
  Me,
  Organization,
  TimeRange,
  TimeZones,
} from 'src/types'
import * as SourcesModels from 'src/types/sources'
import TimeZoneToggle from 'src/shared/components/time_zones/TimeZoneToggle'
import {LOGIN_AUTH_TYPE} from 'src/auth/constants'
import {isUserAuthorized, ADMIN_ROLE} from 'src/auth/Authorized'

//page
import DeviceManagement from './DeviceManagement'

//action
import {connect} from 'react-redux'
import * as appActions from 'src/shared/actions/app'
import {openShell} from 'src/shared/actions/shell'
import DeviceManagementModal from '../components/DeviceManagementModal'
import PredictionPage from './PredictionPage'
import CustomTimeRangeDropdown from 'src/shared/components/CustomTimeRangeDropdown'
import moment from 'moment'

interface Props {
  me: Me
  source: SourcesModels.Source
  links: any
  isUsingAuth: boolean
  notify: (n: Notification) => void
  organizations: Organization[]
  timeZone: TimeZones
  setTimeZone: typeof appActions.setTimeZone
  params: {tab: string}
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
    titleText: 'Prediction',
    value: 'prediction',
    active: 'prediction',
    label: 'Prediction',
  },
]

const AiRoutePage = (props: Props) => {
  const {
    me,
    source,
    params: {tab},
    links: {auth, loginAuthType},
    isUsingAuth,
    organizations,
    timeZone,
    setTimeZone,
  } = props

  const [activeTab, setActiveTab] = useState('device-management')
  const [headerRadioButtons, setHeaderRadioButtons] = useState<
    HeaderNavigationObj[]
  >(defaultHeaderRadioButtons)

  const oneDayInSec = 86400

  const [timeRange, setTimeRange] = useState<TimeRange>({
    upper: moment().format(),
    lower: moment().subtract(oneDayInSec, 'seconds').format(),
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

  const handleApplyTime = (timeRange: TimeRange): void => {
    setTimeRange(timeRange)
  }

  const onChooseActiveTab = (value: string) => {
    setActiveTab(value)
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Title title="CloudHub Admin" />
        </Page.Header.Left>
        <Page.Header.Center widthPixels={headerRadioButtons.length * 90}>
          <div className="radio-buttons radio-buttons--default radio-buttons--sm radio-buttons--stretch">
            {defaultHeaderRadioButtons.map(rBtn => {
              return (
                <Radio.Button
                  key={rBtn.titleText}
                  id={rBtn.id}
                  titleText={rBtn.titleText}
                  value={rBtn.value}
                  active={activeTab === rBtn.active}
                  onClick={onChooseActiveTab}
                >
                  {rBtn.label}
                </Radio.Button>
              )
            })}
          </div>
        </Page.Header.Center>
        <Page.Header.Right>
          <CustomTimeRangeDropdown
            onApplyTimeRange={handleApplyTime}
            timeRange={timeRange}
          />
          <TimeZoneToggle onSetTimeZone={setTimeZone} timeZone={timeZone} />
        </Page.Header.Right>
      </Page.Header>

      <Page.Contents fullWidth={true}>
        <>
          {activeTab === 'device-management' && (
            //@ts-ignore
            <DeviceManagement
              source={source}
              me={me}
              isUsingAuth={isUsingAuth}
              organizations={organizations}
            />
          )}
          {activeTab === 'prediction' && (
            //@ts-ignore
            <PredictionPage timeRange={timeRange} source={source} />
          )}
        </>
      </Page.Contents>
      <DeviceManagementModal />
    </Page>
  )
}

const mstp = ({
  app: {
    persisted: {timeZone},
  },
  adminCloudHub: {organizations},
  auth: {isUsingAuth, me},
}) => {
  return {
    organizations,
    isUsingAuth,
    me,
    timeZone,
  }
}

const mdtp = {
  setTimeZone: appActions.setTimeZone,
  openShell: openShell,
}

export default connect(mstp, mdtp, null)(AiRoutePage)
