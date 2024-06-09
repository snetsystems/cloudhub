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
import {notify as notifyAction} from 'src/shared/actions/notifications'
import * as appActions from 'src/shared/actions/app'

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

const sections = (
  isUsingAuth: boolean,
  me: Me,
  notify,
  organizations: Organization[]
) => {
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
    // onSetTimeZone,
    setTimeZone,
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
          <TimeZoneToggle onSetTimeZone={setTimeZone} timeZone={timeZone} />
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

const mdtp = {
  notify: notifyAction,
  setTimeZone: appActions.setTimeZone,
}

export default connect(mstp, mdtp, null)(AiRoutePage)
