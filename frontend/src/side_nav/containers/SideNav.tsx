import _ from 'lodash'
import React, {PureComponent} from 'react'
import {withRouter, Link} from 'react-router'
import {connect} from 'react-redux'

import Authorized, {ADMIN_ROLE} from 'src/auth/Authorized'

import UserNavBlock from 'src/side_nav/components/UserNavBlock'

import {
  NavBlock,
  NavHeader,
  NavListItem,
} from 'src/side_nav/components/NavItems'

import {DEFAULT_HOME_PAGE, AddonType} from 'src/shared/constants'
import {ErrorHandling} from 'src/shared/decorators/errors'

import {Params, Location, Me} from 'src/types/sideNav'
import {Source, Links} from 'src/types'

interface Props {
  sources: Source[]
  params: Params
  location: Location
  isHidden: boolean
  isUsingAuth?: boolean
  logoutLink?: string
  links?: Links
  me: Me
}

@ErrorHandling
class SideNav extends PureComponent<Props> {
  constructor(props) {
    super(props)
  }

  private isExistInLinks = (name: string): boolean => {
    const {links} = this.props

    return links.addons &&
      links.addons.findIndex(item => {
        return item.name === name
      }) !== -1
      ? true
      : false
  }

  public render() {
    const {
      params: {sourceID},
      location: {pathname: location},
      isHidden,
      isUsingAuth,
      logoutLink,
      links,
      me,
      sources = [],
    } = this.props

    const defaultSource = sources.find(s => s.default)
    const id = sourceID || _.get(defaultSource, 'id', 0)
    const sourcePrefix = `/sources/${id}`
    const isDefaultPage = location.split('/').includes(DEFAULT_HOME_PAGE)
    const isUsingSalt = this.isExistInLinks(AddonType.salt)
    const isUsing128T = this.isExistInLinks(AddonType.router128T)

    return isHidden ? null : (
      <nav className="sidebar">
        <div
          className={isDefaultPage ? 'sidebar--item active' : 'sidebar--item'}
        >
          <Link
            to={`${sourcePrefix}/${DEFAULT_HOME_PAGE}`}
            className="sidebar--square sidebar--logo"
          >
            <span className="sidebar--icon icon _cloudsmarthub--logo" />
          </Link>
        </div>
        <NavBlock
          highlightWhen={['visualize']}
          icon="graphline-2"
          link={`${sourcePrefix}/visualize`}
          location={location}
        >
          <NavHeader link={`${sourcePrefix}/visualize`} title="Visualize" />
        </NavBlock>
        <NavBlock
          highlightWhen={['dashboards']}
          icon="dash-j"
          link={`${sourcePrefix}/dashboards`}
          location={location}
        >
          <NavHeader link={`${sourcePrefix}/dashboards`} title="Dashboards" />
        </NavBlock>
        <NavBlock
          highlightWhen={['infrastructure']}
          icon="server2"
          link={`${sourcePrefix}/infrastructure`}
          location={location}
        >
          <NavHeader
            link={`${sourcePrefix}/infrastructure`}
            title="Infrastructure"
          />
        </NavBlock>
        <NavBlock
          highlightWhen={['applications']}
          icon="_snet--application"
          link={`${sourcePrefix}/applications`}
          location={location}
        >
          <NavHeader
            link={`${sourcePrefix}/applications`}
            title="Applications"
          />
        </NavBlock>
        <NavBlock
          highlightWhen={['alerts', 'alert-rules', 'tickscript']}
          icon="alerts"
          link={`${sourcePrefix}/alert-rules`}
          location={location}
        >
          <NavHeader link={`${sourcePrefix}/alert-rules`} title="Alert" />
          <NavListItem link={`${sourcePrefix}/alert-rules`}>
            Alert Setting
          </NavListItem>
          <NavListItem link={`${sourcePrefix}/alerts`}>
            Alert History
          </NavListItem>
        </NavBlock>

        <NavBlock
          highlightWhen={['logs']}
          icon="eye"
          link="/logs"
          location={location}
        >
          <NavHeader link={'/logs'} title="Log Viewer" />
        </NavBlock>

        <Authorized
          requiredRole={ADMIN_ROLE}
          replaceWithIfNotUsingAuth={
            <NavBlock
              highlightWhen={['admin-influxdb']}
              icon="crown-outline"
              link={`${sourcePrefix}/admin-influxdb/databases`}
              location={location}
            >
              <NavHeader
                link={`${sourcePrefix}/admin-influxdb/databases`}
                title="InfluxDB Admin"
              />
            </NavBlock>
          }
        >
          <NavBlock
            highlightWhen={['admin-cloudhub', 'admin-influxdb']}
            icon="crown-outline"
            link={`${sourcePrefix}/admin-cloudhub/current-organization`}
            location={location}
          >
            <NavHeader
              link={`${sourcePrefix}/admin-cloudhub/current-organization`}
              title="Admin"
            />
            <NavListItem
              link={`${sourcePrefix}/admin-cloudhub/current-organization`}
            >
              CloudHub
            </NavListItem>
            <NavListItem link={`${sourcePrefix}/admin-influxdb/databases`}>
              InfluxDB
            </NavListItem>
          </NavBlock>
        </Authorized>
        <Authorized
          requiredRole={ADMIN_ROLE}
          replaceWithIfNotAuthorized={
            <NavBlock
              highlightWhen={['manage-sources']}
              icon="wrench"
              link={`${sourcePrefix}/manage-sources`}
              location={location}
            >
              <NavHeader
                link={`${sourcePrefix}/manage-sources`}
                title="Configuration"
              />
            </NavBlock>
          }
          replaceWithIfNotUsingAuth={
            <NavBlock
              highlightWhen={['manage-sources']}
              icon="wrench"
              link={`${sourcePrefix}/manage-sources`}
              location={location}
            >
              <NavHeader
                link={`${sourcePrefix}/manage-sources`}
                title="Configuration"
              />
            </NavBlock>
          }
        >
          <NavBlock
            highlightWhen={['manage-sources', 'agent-admin']}
            icon="wrench"
            link={`${sourcePrefix}/manage-sources`}
            location={location}
          >
            <NavHeader
              link={`${sourcePrefix}/manage-sources`}
              title="Configuration"
            />
            <NavListItem link={`${sourcePrefix}/manage-sources`}>
              Configuration
            </NavListItem>
            {isUsingSalt ? (
              <NavListItem link={`${sourcePrefix}/agent-admin/agent-minions`}>
                Agent Configuration
              </NavListItem>
            ) : null}
          </NavBlock>
        </Authorized>
        {isUsingAuth ? (
          <UserNavBlock
            logoutLink={logoutLink}
            links={links}
            me={me}
            sourcePrefix={sourcePrefix}
          />
        ) : null}
        {isUsing128T ? (
          <NavBlock
            highlightWhen={['swan-status', 'swan-setting']}
            icon="cube"
            link={`${sourcePrefix}/add-on/swan-status`}
            location={location}
          >
            <NavHeader
              link={`${sourcePrefix}/add-on/swan-status`}
              title="SWAN/Oncue"
            />
            <NavListItem link={`${sourcePrefix}/add-on/swan-status`}>
              Status
            </NavListItem>
            {/* <NavListItem link={`${sourcePrefix}/add-on/swan-setting`}>
              Setting
            </NavListItem> */}
          </NavBlock>
        ) : null}
        <div className="sidebar--item cursor-default symbol-company" />
      </nav>
    )
  }
}

const mapStateToProps = ({
  sources,
  auth: {isUsingAuth, logoutLink, me},
  app: {
    ephemeral: {inPresentationMode},
  },
  links,
}) => ({
  sources,
  isHidden: inPresentationMode,
  isUsingAuth,
  logoutLink,
  links,
  me,
})

export default connect(mapStateToProps)(withRouter(SideNav))
