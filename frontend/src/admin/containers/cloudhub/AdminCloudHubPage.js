import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import _ from 'lodash'

import {Page} from 'src/reusable_ui'
import SubSections from 'src/shared/components/SubSections'

import UsersPage from 'src/admin/containers/cloudhub/UsersPage'
import AllUsersPage from 'src/admin/containers/cloudhub/AllUsersPage'
import OrganizationsPage from 'src/admin/containers/cloudhub/OrganizationsPage'
import ProvidersPage from 'src/admin/containers/ProvidersPage'

import {
  isUserAuthorized,
  ADMIN_ROLE,
  SUPERADMIN_ROLE,
} from 'src/auth/Authorized'
import {LOGIN_AUTH_TYPE} from 'src/auth/constants'

const sections = (me, providers) => [
  {
    url: 'current-organization',
    name: 'Current Org',
    enabled: isUserAuthorized(me.role, ADMIN_ROLE),
    component: (
      <UsersPage
        meID={me.id}
        meCurrentOrganization={me.currentOrganization}
        providers={providers}
      />
    ),
  },
  {
    url: 'all-users',
    name: 'All Users',
    enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
    component: <AllUsersPage meID={me.id} providers={providers} />,
  },
  {
    url: 'all-organizations',
    name: 'All Orgs',
    enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
    component: (
      <OrganizationsPage meCurrentOrganization={me.currentOrganization} />
    ),
  },
  {
    url: 'organization-mappings',
    name: 'Org Mappings',
    enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
    component: <ProvidersPage />,
  },
]

const AdminCloudHubPage = (props) => {
  const {
    me,
    source,
    params: {tab},
    links: {auth, loginAuthType},
  } = props

  let providers = []

  if (loginAuthType !== LOGIN_AUTH_TYPE.OAUTH) {
    providers.push('cloudhub')
  }

  if (loginAuthType !== LOGIN_AUTH_TYPE.BASIC) {
    _.forEach(auth, (authObj) => {
      providers.push(authObj.name)
    })
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Title title="CloudHub Admin" />
        </Page.Header.Left>
        <Page.Header.Right />
      </Page.Header>
      <Page.Contents fullWidth={true}>
        <div className="container-fluid">
          <SubSections
            sections={sections(me, providers)}
            activeSection={tab}
            parentUrl="admin-cloudhub"
            sourceID={source.id}
          />
        </div>
      </Page.Contents>
    </Page>
  )
}

const {shape, string} = PropTypes

AdminCloudHubPage.propTypes = {
  me: shape({
    id: string.isRequired,
    role: string.isRequired,
    currentOrganization: shape({
      name: string.isRequired,
      id: string.isRequired,
    }),
  }).isRequired,
  params: shape({
    tab: string,
  }).isRequired,
  source: shape({
    id: string.isRequired,
    links: shape({
      users: string.isRequired,
    }),
  }).isRequired,
}

const mapStateToProps = ({auth: {me}}) => ({
  me,
})

export default connect(mapStateToProps, null)(AdminCloudHubPage)
