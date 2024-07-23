import _ from 'lodash'
import React, {PureComponent} from 'react'
import {withRouter, Link} from 'react-router'
import {connect} from 'react-redux'

import Authorized, {
  ADMIN_ROLE,
  isUserAuthorized,
  SUPERADMIN_ROLE,
} from 'src/auth/Authorized'

import UserNavBlock from 'src/side_nav/components/UserNavBlock'

import {
  NavBlock,
  NavHeader,
  NavListItem,
} from 'src/side_nav/components/NavItems'

import {DEFAULT_HOME_PAGE, AddonType} from 'src/shared/constants'
import {ErrorHandling} from 'src/shared/decorators/errors'

import {Params, Location, Me} from 'src/types/sideNav'
import {Source, Links, Shells, Env} from 'src/types'

import {openShell, closeShell} from 'src/shared/actions/shell'

interface Props {
  sources: Source[]
  params: Params
  location: Location
  isHidden: boolean
  isUsingAuth?: boolean
  logoutLink?: string
  links?: Links
  me: Me
  env: Env
  shell: Shells
  openShell: (address?: string) => Shells
  closeShell: () => Shells
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

  private isAddonUrlOn = (name: string): boolean => {
    const {links} = this.props

    return (
      links.addons &&
      links.addons.some(item => item.name === name && item.url === 'on')
    )
  }

  private toggleShellVisible = () => {
    const {shell, closeShell, openShell} = this.props
    return shell.isVisible ? closeShell() : openShell()
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
    const isUsing128T = this.isExistInLinks(AddonType.router128T)
    const isUsingVMware = this.isExistInLinks(AddonType.vsphere)
    const isUsingK8s = this.isExistInLinks(AddonType.k8s)
    const isUsingOsp = this.isExistInLinks(AddonType.osp)
    const isUsingAI = this.isAddonUrlOn(AddonType.ai)
    const cloudsNavLink = (() => {
      if (isUsingVMware) {
        return 'vmware'
      } else if (isUsingK8s) {
        return 'kubernetes'
      } else if (isUsingOsp) {
        return 'openstack'
      }
    })()

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
          link={`${sourcePrefix}/infrastructure/topology`}
          location={location}
        >
          <NavHeader
            link={`${sourcePrefix}/infrastructure/topology`}
            title="Infrastructure"
          />
        </NavBlock>
        {isUsingAuth && (isUsingVMware || isUsingK8s || isUsingOsp) && (
          <NavBlock
            highlightWhen={['clouds']}
            icon="cloud"
            link={`${sourcePrefix}/clouds/${cloudsNavLink}`}
            location={location}
          >
            <NavHeader
              link={`${sourcePrefix}/clouds/${cloudsNavLink}`}
              title="Clouds"
            />
            {isUsingVMware && (
              <NavListItem link={`${sourcePrefix}/clouds/vmware`}>
                VMware
              </NavListItem>
            )}
            {isUsingK8s && (
              <NavListItem link={`${sourcePrefix}/clouds/kubernetes`}>
                Kubernetes
              </NavListItem>
            )}
            {isUsingOsp && (
              <NavListItem link={`${sourcePrefix}/clouds/openstack`}>
                Openstack
              </NavListItem>
            )}
          </NavBlock>
        )}
        {isUsingAuth && isUsingAI && (
          <NavBlock
            highlightWhen={['ai']}
            icon="ai-icon"
            link={`${sourcePrefix}/ai/device-management`}
            location={location}
          >
            <NavHeader
              link={`${sourcePrefix}/ai/device-management`}
              title="AI"
            />
            {
              <NavListItem link={`${sourcePrefix}/ai/device-management`}>
                Network Device
              </NavListItem>
            }
          </NavBlock>
        )}

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

        <Authorized
          requiredRole={SUPERADMIN_ROLE}
          replaceWithIfNotAuthorized={
            <NavBlock
              highlightWhen={['logs']}
              icon="eye"
              link={`${sourcePrefix}/logs`}
              location={location}
            >
              <NavHeader link={`${sourcePrefix}/logs`} title="Log Viewer" />
            </NavBlock>
          }
          replaceWithIfNotUsingAuth={
            <NavBlock
              highlightWhen={['logs']}
              icon="eye"
              link={`${sourcePrefix}/logs`}
              location={location}
            >
              <NavHeader link={`${sourcePrefix}/logs`} title="Log Viewer" />
            </NavBlock>
          }
        >
          <NavBlock
            highlightWhen={['logs', 'activity-logs']}
            icon="eye"
            link={`${sourcePrefix}/logs`}
            location={location}
          >
            <NavHeader link={`${sourcePrefix}/logs`} title="Log Viewer" />
            <NavListItem link={`${sourcePrefix}/logs`}>System Logs</NavListItem>
            <NavListItem link={`${sourcePrefix}/activity-logs`}>
              Activity Logs
            </NavListItem>
          </NavBlock>
        </Authorized>

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
        {this.Configuration}
        {isUsingAuth && (
          <UserNavBlock
            logoutLink={logoutLink}
            links={links}
            me={me}
            sourcePrefix={sourcePrefix}
          />
        )}
        {isUsing128T && (
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
        )}
        <div
          className={`sidebar--item align-bottom ${
            this.props.shell.isVisible ? 'active' : ''
          }`}
          onClick={this.toggleShellVisible}
        >
          <div className="sidebar--square">
            <span className="sidebar--icon icon bash"></span>
          </div>
        </div>
        <div className="sidebar--item cursor-default symbol-company" />
      </nav>
    )
  }

  private get Configuration() {
    const {
      params: {sourceID},
      location: {pathname: location},
      sources = [],
      me,
    } = this.props
    const defaultSource = sources.find(s => s.default)
    const isUsingSalt = this.isExistInLinks(AddonType.salt)
    const id = sourceID || _.get(defaultSource, 'id', 0)
    const sourcePrefix = `/sources/${id}`
    const isSuperAdmin = isUserAuthorized(me.role, SUPERADMIN_ROLE)

    const superAdminContent = (
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
        {isUsingSalt && (
          <NavListItem link={`${sourcePrefix}/agent-admin/agent-minions`}>
            Agent Configuration
          </NavListItem>
        )}
      </NavBlock>
    )

    const otherRoleContent = isUsingSalt && (
      <NavBlock
        highlightWhen={['agent-admin']}
        icon="wrench"
        link={`${sourcePrefix}/agent-admin/agent-minions`}
        location={location}
      >
        <NavHeader
          link={`${sourcePrefix}/agent-admin/agent-minions`}
          title="Configuration"
        />

        <NavListItem link={`${sourcePrefix}/agent-admin/agent-minions`}>
          Agent Configuration
        </NavListItem>
      </NavBlock>
    )

    if (isSuperAdmin) {
      return (
        <Authorized
          requiredRole={SUPERADMIN_ROLE}
          replaceWithIfNotAuthorized={<></>}
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
          <>{superAdminContent}</>
        </Authorized>
      )
    }

    return (
      <Authorized
        requiredRole={ADMIN_ROLE}
        replaceWithIfNotAuthorized={<></>}
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
        <>{otherRoleContent}</>
      </Authorized>
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
  env,
  shell,
}) => ({
  sources,
  isHidden: inPresentationMode,
  isUsingAuth,
  logoutLink,
  links,
  env,
  me,
  shell,
})

const mapDispatchToProps = {
  openShell: openShell,
  closeShell: closeShell,
}

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(SideNav))
