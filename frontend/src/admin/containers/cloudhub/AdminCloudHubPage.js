// libraries
import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import _ from 'lodash'

// components
import {Page} from 'src/reusable_ui'
import SubSections from 'src/shared/components/SubSections'
import UsersPage from 'src/admin/containers/cloudhub/UsersPage'
import AllUsersPage from 'src/admin/containers/cloudhub/AllUsersPage'
import OrganizationsPage from 'src/admin/containers/cloudhub/OrganizationsPage'
import ProvidersPage from 'src/admin/containers/ProvidersPage'
import ProviderConfPage from 'src/admin/containers/cloudhub/ProviderConfPage'

// actions
import {
  isUserAuthorized,
  ADMIN_ROLE,
  SUPERADMIN_ROLE,
} from 'src/auth/Authorized'

// constants
import {LOGIN_AUTH_TYPE} from 'src/auth/constants'
import {ProviderTypes} from 'src/admin/constants/providerConf'

// utils
import {addOnCsp} from 'src/clouds/utils/getAddOn'

const sections = (me, providers, cspProviders = []) => {
  let sections = [
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
    {
      url: 'provider-conf',
      name: 'Provider Conf',
      enabled: isUserAuthorized(me.role, ADMIN_ROLE),
      component: (
        <ProviderConfPage
          meID={me.id}
          meCurrentOrganization={me.currentOrganization}
          cspProviders={cspProviders}
        />
      ),
    },
  ]

  sections = _.map(sections, component => {
    if (component.url == 'provider-conf' && _.isEmpty(cspProviders)) {
      return false
    }
    return component
  })

  return sections
}
const AdminCloudHubPage = props => {
  const {
    me,
    source,
    params: {tab},
    links: {auth, loginAuthType, addons},
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
  const cspProviders = addOnCsp(ProviderTypes, addons)

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Title title="CloudHub Admin" />
        </Page.Header.Left>
        <Page.Header.Right />
      </Page.Header>
      <Page.Contents fullWidth={true}>
        <div className="container-fluid full-height">
          <SubSections
            sections={sections(me, providers, cspProviders)}
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
