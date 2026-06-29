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
import {
  SERVER_DETAILS_PAGE_NAME,
  SERVER_DETAILS_IMPORT_PATH,
} from 'src/shared/constants/routes'
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
    const isUsingNvidiaGpu = this.isAddonUrlOn(AddonType.nvidia)
    const isUsingLogAnalysis = this.isAddonUrlOn(AddonType.logAnalysis)
    const cloudsNavLink = (() => {
      if (isUsingVMware) {
        return 'vmware'
      } else if (isUsingK8s) {
        return 'kubernetes'
      } else if (isUsingOsp) {
        return 'openstack'
      }
    })()

    const navItem = () => {
      return (
        <>
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
          {/* Network Monitoring */}
          <NavBlock
            highlightWhen={['network-monitoring']}
            icon="network"
            link={`${sourcePrefix}/network-monitoring/anomaly-prediction`}
            location={location}
          >
            <NavHeader
              link={`${sourcePrefix}/network-monitoring/anomaly-prediction`}
              title="Network Monitoring"
            />
            <NavListItem link={`${sourcePrefix}/network-monitoring/management`}>
              Device Management
            </NavListItem>
            <NavListItem
              link={`${sourcePrefix}/network-monitoring/anomaly-prediction`}
            >
              Anomaly Monitoring
            </NavListItem>
          </NavBlock>

          {/* Server Monitoring */}
          <NavBlock
            highlightWhen={['server-monitoring']}
            icon="server2"
            link={`${sourcePrefix}/server-monitoring/server-list`}
            location={location}
          >
            <NavHeader
              link={`${sourcePrefix}/server-monitoring/server-list`}
              title="Server Monitoring"
            />
            <NavListItem link={`${sourcePrefix}/server-monitoring/topology`}>
              Topology Builder
            </NavListItem>
            {/* <NavListItem link={`${sourcePrefix}/server-monitoring/overview`}>
              Overview
            </NavListItem> */}
            <NavListItem link={`${sourcePrefix}/server-monitoring/server-list`}>
              Server List
            </NavListItem>
            <NavListItem
              link={`${sourcePrefix}/server-monitoring/${SERVER_DETAILS_PAGE_NAME}`}
            >
              Server Details
            </NavListItem>
            <NavListItem
              link={`${sourcePrefix}/server-monitoring/gpu-monitoring`}
            >
              NVIDIA GPU Monitoring
            </NavListItem>
            <NavListItem
              link={`${sourcePrefix}/server-monitoring/server-alert`}
            >
              Server Alert
            </NavListItem>
          </NavBlock>

          {/* URL Monitoring */}
          <NavBlock
            highlightWhen={['url-monitoring']}
            icon="sphere"
            link={`${sourcePrefix}/url-monitoring/url-list`}
            location={location}
          >
            <NavHeader
              link={`${sourcePrefix}/url-monitoring/url-list`}
              title="URL Monitoring"
            />
            <NavListItem link={`${sourcePrefix}/url-monitoring/url-list`}>
              URL List
            </NavListItem>
            <NavListItem link={`${sourcePrefix}/url-monitoring/url-alert`}>
              URL Alert
            </NavListItem>
          </NavBlock>

          {/* DB Monitoring */}
          <NavBlock
            highlightWhen={['db-monitoring']}
            icon="disks"
            link={`${sourcePrefix}/db-monitoring`}
            location={location}
          >
            <NavHeader
              link={`${sourcePrefix}/db-monitoring`}
              title="DB Monitoring"
            />
          </NavBlock>

          {/* App Performance Monitoring */}
          <NavBlock
            highlightWhen={['app-performance-monitoring']}
            icon="tachometer"
            link={`${sourcePrefix}/app-performance-monitoring`}
            location={location}
          >
            <NavHeader
              link={`${sourcePrefix}/app-performance-monitoring`}
              title="App. Performance Monitoring"
            />
          </NavBlock>

          {/* Kubernetes  */}
          <NavBlock
            highlightWhen={['kubernetes']}
            icon="kubernetes"
            link={`${sourcePrefix}/kubernetes`}
            location={location}
          >
            <NavHeader link={`${sourcePrefix}/kubernetes`} title="Kubernetes" />
          </NavBlock>

          {/* OpenStack  */}
          {isUsingAuth && isUsingOsp && (
            <NavBlock
              highlightWhen={['openstack']}
              icon="openstack"
              link={`${sourcePrefix}/openstack`}
              location={location}
            >
              <NavHeader link={`${sourcePrefix}/openstack`} title="OpenStack" />
            </NavBlock>
          )}

          {/* VMware */}
          {isUsingAuth && isUsingVMware && (
            <NavBlock
              highlightWhen={['vmware']}
              icon="vmware"
              link={`${sourcePrefix}/vmware`}
              location={location}
            >
              <NavHeader link={`${sourcePrefix}/vmware`} title="VMware" />
            </NavBlock>
          )}

          <Authorized
            requiredRole={ADMIN_ROLE}
            replaceWithIfNotAuthorized={
              <NavBlock
                highlightWhen={['logs']}
                icon="document"
                link={`${sourcePrefix}/logs`}
                location={location}
              >
                <NavHeader link={`${sourcePrefix}/logs`} title="Log Viewer" />
              </NavBlock>
            }
            replaceWithIfNotUsingAuth={
              <NavBlock
                highlightWhen={['logs']}
                icon="document"
                link={`${sourcePrefix}/logs`}
                location={location}
              >
                <NavHeader link={`${sourcePrefix}/logs`} title="Log Viewer" />
              </NavBlock>
            }
          >
            <NavBlock
              highlightWhen={['log-analysis', 'logs', 'activity-logs']}
              icon="document"
              link={
                isUsingLogAnalysis
                  ? `${sourcePrefix}/log-analysis`
                  : `${sourcePrefix}/logs`
              }
              location={location}
            >
              <NavHeader
                link={
                  isUsingLogAnalysis
                    ? `${sourcePrefix}/log-analysis`
                    : `${sourcePrefix}/logs`
                }
                title="Log Viewer"
              />
              {isUsingLogAnalysis && (
                <NavListItem link={`${sourcePrefix}/log-analysis`}>
                  Log Analysis
                </NavListItem>
              )}
              <NavListItem link={`${sourcePrefix}/logs`}>
                Log Viewer
              </NavListItem>

              {_.get(me, 'role', '').includes(SUPERADMIN_ROLE) && (
                <NavListItem link={`${sourcePrefix}/activity-logs`}>
                  Activity Logs
                </NavListItem>
              )}
            </NavBlock>
          </Authorized>

          <NavBlock
            highlightWhen={['alerts', 'alert-rules', 'tickscript']}
            icon="bell"
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
        </>
      )
    }

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

        {navItem()}

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
