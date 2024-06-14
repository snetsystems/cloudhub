import React from 'react'
import _ from 'lodash'
import {Page} from 'src/reusable_ui'
import SubSections from 'src/shared/components/SubSections'
import {Me, Organization, TimeZones} from 'src/types'
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
  organizations: Organization[],
  source: SourcesModels.Source
) => {
  let sections = [
    {
      url: 'device-management',
      name: 'Device Management',
      enabled: isUserAuthorized(me.role, ADMIN_ROLE),
      component: (
        <DeviceManagement
          source={source}
          me={me}
          isUsingAuth={isUsingAuth}
          organizations={organizations}
        />
      ),
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
    organizations,
    timeZone,
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
            sections={sections(isUsingAuth, me, organizations, source)}
            activeSection={tab}
            parentUrl="ai"
            sourceID={source.id}
          />
        </div>
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
