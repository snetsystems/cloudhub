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

import {DEFAULT_HOME_PAGE} from 'src/shared/constants'
import {ErrorHandling} from 'src/shared/decorators/errors'

import {Params, Location, Links, Me} from 'src/types/sideNav'
import {Source} from 'src/types'

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
    // const dataExplorerLink = `${sourcePrefix}/cmp/visualize`

    const isDefaultPage = location.split('/').includes(DEFAULT_HOME_PAGE)

    return isHidden ? null : (
      <nav className="sidebar">
        <div
          className={isDefaultPage ? 'sidebar--item active' : 'sidebar--item'}
        >
          <Link
            to={`${sourcePrefix}/${DEFAULT_HOME_PAGE}`}
            className="sidebar--square sidebar--logo"
          >
            <span className="sidebar--icon icon cubo-uniform" />
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
          highlightWhen={['hosts']}
          icon="server2"
          link={`${sourcePrefix}/hosts`}
          location={location}
        >
          <NavHeader link={`${sourcePrefix}/hosts`} title="Infrastructure" />
        </NavBlock>
        <NavBlock
          highlightWhen={['application']}
          icon="disks"
          link={`${sourcePrefix}/application`}
          location={location}
        >
          <NavHeader
            link={`${sourcePrefix}/application`}
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
            highlightWhen={['admin-cmp', 'admin-influxdb']}
            icon="crown-outline"
            link={`${sourcePrefix}/admin-cmp/current-organization`}
            location={location}
          >
            <NavHeader
              link={`${sourcePrefix}/admin-cmp/current-organization`}
              title="Admin"
            />
            <NavListItem
              link={`${sourcePrefix}/admin-cmp/current-organization`}
            >
              SCMP
            </NavListItem>
            <NavListItem link={`${sourcePrefix}/admin-influxdb/databases`}>
              InfluxDB
            </NavListItem>
          </NavBlock>
        </Authorized>
        <NavBlock
          highlightWhen={['manage-sources', 'kapacitors']}
          icon="wrench"
          link={`${sourcePrefix}/manage-sources`}
          location={location}
        >
          <NavHeader
            link={`${sourcePrefix}/manage-sources`}
            title="Configuration"
          />
        </NavBlock>
        {isUsingAuth ? (
          <UserNavBlock
            logoutLink={logoutLink}
            links={links}
            me={me}
            sourcePrefix={sourcePrefix}
          />
        ) : null}
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
