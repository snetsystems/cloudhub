import React, {useEffect} from 'react'
import _ from 'lodash'
import {Page} from 'src/reusable_ui'
import SubSections from 'src/shared/components/SubSections'
import {Me, Organization, TimeZones} from 'src/types'
import * as SourcesModels from 'src/types/sources'
import TimeZoneToggle from 'src/shared/components/time_zones/TimeZoneToggle'
import {LOGIN_AUTH_TYPE} from 'src/auth/constants'
import {
  isUserAuthorized,
  ADMIN_ROLE,
  SUPERADMIN_ROLE,
} from 'src/auth/Authorized'

//page
import PredictionPage from './PredictionPage'
import DeviceManagement from './DeviceManagement'

//action
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import * as appActions from 'src/shared/actions/app'
import {setTimeZone} from 'src/shared/actions/app'

interface Props {
  me: Me
  source: SourcesModels.Source
  links: any
  isUsingAuth: boolean
  notify: (n: Notification) => void
  organizations: Organization[]
  timeZone: TimeZones
  onSetTimeZone: typeof setTimeZone
  params: {tab: string}
}

const sections = (isUsingAuth, me, notify, organizations) => {
  let sections = [
    {
      url: 'device-management',
      name: 'Device Management',
      enabled: isUserAuthorized(me.role, ADMIN_ROLE),
      component: (
        <DeviceManagement
          me={me}
          isUsingAuth={isUsingAuth}
          notify={notify}
          organizations={organizations}
        />
      ),
    },
    {
      url: 'prediction',
      name: 'Prediction',
      enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
      component: <PredictionPage />,
    },
  ]

  return sections
}

const AiRoutePage = (props: Props) => {
  const {
    me,
    source,
    params: {tab},
    links: {auth, loginAuthType},
    isUsingAuth,
    notify,
    organizations,
    timeZone,
    onSetTimeZone,
  } = props

  let providers = []

  if (loginAuthType !== LOGIN_AUTH_TYPE.OAUTH) {
    providers.push('cloudhub')
  }

  if (loginAuthType !== LOGIN_AUTH_TYPE.BASIC) {
    _.forEach(auth, authObj => {
      providers.push(authObj.name)
    })
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Title title="CloudHub Admin" />
        </Page.Header.Left>
        <Page.Header.Right>
          <TimeZoneToggle timeZone={timeZone} onSetTimeZone={onSetTimeZone} />
        </Page.Header.Right>
      </Page.Header>
      <Page.Contents fullWidth={true}>
        <div className="container-fluid">
          <SubSections
            sections={sections(isUsingAuth, me, notify, organizations)}
            activeSection={tab}
            parentUrl="ai"
            sourceID={source.id}
          />
        </div>
      </Page.Contents>
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

const mdtp = (dispatch: any) => ({
  notify: bindActionCreators(notifyAction, dispatch),
  setTimeZone: appActions.setTimeZone,
})

export default connect(mstp, mdtp, null)(AiRoutePage)
