import _ from 'lodash'
import React, {PureComponent} from 'react'
import {withRouter, Link} from 'react-router'
import {connect} from 'react-redux'
import classnames from 'classnames'

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
import {SERVER_DETAILS_PAGE_NAME} from 'src/shared/constants/routes'
import {ErrorHandling} from 'src/shared/decorators/errors'

import {Params, Location, Me} from 'src/types/sideNav'
import {Source} from 'src/types/sources'
import {Links} from 'src/types/links'
import {Shells} from 'src/types/shell'
import {Env} from 'src/types/env'

import {openShell, closeShell} from 'src/shared/actions/shell'
import {
  loadOrgNavMenuAsync,
  OrgNavMenuState,
} from 'src/shared/actions/orgNavMenu'
import {buildKubernetesNavItems} from 'src/hubble/navigation'
import {isOrgNavMenuEnabled} from 'src/side_nav/utils/orgNavMenuVisibility'

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
  orgNavMenu: OrgNavMenuState
  openShell: (address?: string) => Shells
  closeShell: () => Shells
  loadOrgNavMenu: (orgId: string) => void
}

interface State {
  canScrollUp: boolean
  canScrollDown: boolean
}

@ErrorHandling
class SideNav extends PureComponent<Props, State> {
  private scrollRef: HTMLDivElement = null
  private resizeObserver: ResizeObserver = null

  public state: State = {
    canScrollUp: false,
    canScrollDown: false,
  }

  public componentDidMount() {
    this.updateScrollFade()
    this.loadCurrentOrgNavMenu()
  }

  public componentDidUpdate(prevProps: Props) {
    this.updateScrollFade()

    const prevOrgId = prevProps.me?.currentOrganization?.id
    const nextOrgId = this.props.me?.currentOrganization?.id
    if (prevOrgId !== nextOrgId) {
      this.loadCurrentOrgNavMenu()
    }
  }

  public componentWillUnmount() {
    this.teardownScrollObserver()
  }

  private loadCurrentOrgNavMenu = () => {
    const orgId = this.props.me?.currentOrganization?.id
    if (orgId) {
      this.props.loadOrgNavMenu(orgId)
    }
  }

  private isMenuEnabled = (menuId: string): boolean => {
    return isOrgNavMenuEnabled(this.props.orgNavMenu?.selection, menuId)
  }

  private setScrollRef = (el: HTMLDivElement) => {
    this.teardownScrollObserver()
    this.scrollRef = el
    if (el) {
      this.observeScrollSize()
      this.updateScrollFade()
    }
  }

  private teardownScrollObserver = () => {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
  }

  private observeScrollSize = () => {
    if (!this.scrollRef || typeof ResizeObserver === 'undefined') {
      return
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.updateScrollFade()
    })
    this.resizeObserver.observe(this.scrollRef)
  }

  private handleScroll = () => {
    this.updateScrollFade()
  }

  private updateScrollFade = () => {
    const el = this.scrollRef
    if (!el) {
      return
    }

    const threshold = 1
    const canScrollUp = el.scrollTop > threshold
    const canScrollDown =
      el.scrollTop + el.clientHeight < el.scrollHeight - threshold

    if (
      canScrollUp !== this.state.canScrollUp ||
      canScrollDown !== this.state.canScrollDown
    ) {
      this.setState({canScrollUp, canScrollDown})
    }
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
    const kubernetesNavItems = buildKubernetesNavItems(sourcePrefix)
    const isDefaultPage = location.split('/').includes(DEFAULT_HOME_PAGE)
    const isUsingVMware = this.isExistInLinks(AddonType.vsphere)
    const isUsingOsp = this.isExistInLinks(AddonType.osp)
    const isUsingLogAnalysis = this.isAddonUrlOn(AddonType.logAnalysis)
    const isAdminRole = !isUsingAuth || isUserAuthorized(me?.role, ADMIN_ROLE)
    const enabled = this.isMenuEnabled

    const navItem = () => {
      return (
        <>
          {/* AI Assistant */}
          <NavBlock
            visible={enabled('ai-chat')}
            highlightWhen={['ai-chat', 'ai-chat-test', 'openclaw-skills']}
            icon="ai-robot"
            link={`${sourcePrefix}/ai-chat`}
            location={location}
          >
            <NavHeader link={`${sourcePrefix}/ai-chat`} title="AI Assistant" />
            {enabled('ai-chatbot') && (
              <NavListItem link={`${sourcePrefix}/ai-chat`}>
                AI Chatbot
              </NavListItem>
            )}
            {isAdminRole && enabled('openclaw-skills') && (
              <NavListItem link={`${sourcePrefix}/openclaw-skills`}>
                Skills
              </NavListItem>
            )}
          </NavBlock>

          <NavBlock
            visible={enabled('visualize')}
            highlightWhen={['visualize']}
            icon="graphline-2"
            link={`${sourcePrefix}/visualize`}
            location={location}
          >
            <NavHeader link={`${sourcePrefix}/visualize`} title="Visualize" />
          </NavBlock>
          <NavBlock
            visible={enabled('dashboards')}
            highlightWhen={['dashboards']}
            icon="dash-j"
            link={`${sourcePrefix}/dashboards`}
            location={location}
          >
            <NavHeader link={`${sourcePrefix}/dashboards`} title="Dashboards" />
          </NavBlock>
          {/* Network Monitoring */}
          <NavBlock
            visible={enabled('network-monitoring')}
            highlightWhen={['network-monitoring']}
            icon="network"
            link={`${sourcePrefix}/network-monitoring/anomaly-prediction`}
            location={location}
          >
            <NavHeader
              link={`${sourcePrefix}/network-monitoring/anomaly-prediction`}
              title="Network Monitoring"
            />
            {enabled('network-management') && (
              <NavListItem
                link={`${sourcePrefix}/network-monitoring/management`}
              >
                Device Management
              </NavListItem>
            )}
            {enabled('network-anomaly') && (
              <NavListItem
                link={`${sourcePrefix}/network-monitoring/anomaly-prediction`}
              >
                Anomaly Monitoring
              </NavListItem>
            )}
          </NavBlock>
          {/* Server Monitoring */}
          <NavBlock
            visible={enabled('server-monitoring')}
            highlightWhen={['server-monitoring']}
            icon="server2"
            link={`${sourcePrefix}/server-monitoring/server-list`}
            location={location}
          >
            <NavHeader
              link={`${sourcePrefix}/server-monitoring/server-list`}
              title="Server Monitoring"
            />
            {enabled('server-topology') && (
              <NavListItem link={`${sourcePrefix}/server-monitoring/topology`}>
                Topology Builder
              </NavListItem>
            )}
            {enabled('server-list') && (
              <NavListItem
                link={`${sourcePrefix}/server-monitoring/server-list`}
              >
                Server List
              </NavListItem>
            )}
            {enabled('server-details') && (
              <NavListItem
                link={`${sourcePrefix}/server-monitoring/${SERVER_DETAILS_PAGE_NAME}`}
              >
                Server Details
              </NavListItem>
            )}
            {enabled('gpu-monitoring') && (
              <NavListItem
                link={`${sourcePrefix}/server-monitoring/gpu-monitoring`}
              >
                NVIDIA GPU Monitoring
              </NavListItem>
            )}
            {enabled('server-alert') && (
              <NavListItem
                link={`${sourcePrefix}/server-monitoring/server-alert`}
              >
                Server Alert
              </NavListItem>
            )}
          </NavBlock>

          {/* URL Monitoring */}
          <NavBlock
            visible={enabled('url-monitoring')}
            highlightWhen={['url-monitoring']}
            icon="sphere"
            link={`${sourcePrefix}/url-monitoring/url-list`}
            location={location}
          >
            <NavHeader
              link={`${sourcePrefix}/url-monitoring/url-list`}
              title="URL Monitoring"
            />
            {enabled('url-list') && (
              <NavListItem link={`${sourcePrefix}/url-monitoring/url-list`}>
                URL List
              </NavListItem>
            )}
            {enabled('url-alert') && (
              <NavListItem link={`${sourcePrefix}/url-monitoring/url-alert`}>
                URL Alert
              </NavListItem>
            )}
          </NavBlock>

          {/* DB Monitoring */}
          <NavBlock
            visible={enabled('db-monitoring')}
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

          {/* App. Performance Monitoring */}
          <NavBlock
            visible={enabled('app-performance-monitoring')}
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

          {/* Kubernetes */}
          <NavBlock
            visible={enabled('kubernetes')}
            highlightWhen={['kubernetes']}
            icon="kubernetes"
            link={kubernetesNavItems[0].link}
            location={location}
          >
            <NavHeader link={kubernetesNavItems[0].link} title="Kubernetes" />
            {kubernetesNavItems.map(item => (
              <NavListItem key={item.link} link={item.link} exact={item.exact}>
                {item.label}
              </NavListItem>
            ))}
          </NavBlock>

          {/* OpenStack */}
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

          {/* Log Viewer */}
          <NavBlock
            visible={enabled('log-viewer')}
            highlightWhen={['log-analysis', 'logs', 'activity-logs']}
            icon="document"
            link={
              isUsingLogAnalysis && enabled('log-analysis')
                ? `${sourcePrefix}/log-analysis`
                : `${sourcePrefix}/logs`
            }
            location={location}
          >
            <NavHeader
              link={
                isUsingLogAnalysis && enabled('log-analysis')
                  ? `${sourcePrefix}/log-analysis`
                  : `${sourcePrefix}/logs`
              }
              title="Log Viewer"
            />
            {isUsingLogAnalysis && enabled('log-analysis') && (
              <NavListItem link={`${sourcePrefix}/log-analysis`}>
                Log Analysis
              </NavListItem>
            )}
            {enabled('logs') && (
              <NavListItem link={`${sourcePrefix}/logs`}>
                Log Viewer
              </NavListItem>
            )}
            {enabled('activity-logs') && (
              <NavListItem link={`${sourcePrefix}/activity-logs`}>
                Activity Logs
              </NavListItem>
            )}
          </NavBlock>

          {/* Alert */}
          <NavBlock
            visible={enabled('alert')}
            highlightWhen={['alerts', 'alert-rules', 'tickscript']}
            icon="bell"
            link={
              isAdminRole && enabled('alert-rules')
                ? `${sourcePrefix}/alert-rules`
                : `${sourcePrefix}/alerts`
            }
            location={location}
          >
            <NavHeader
              link={
                isAdminRole && enabled('alert-rules')
                  ? `${sourcePrefix}/alert-rules`
                  : `${sourcePrefix}/alerts`
              }
              title="Alert"
            />
            {isAdminRole && enabled('alert-rules') && (
              <NavListItem link={`${sourcePrefix}/alert-rules`}>
                Alert Setting
              </NavListItem>
            )}
            {enabled('alerts') && (
              <NavListItem link={`${sourcePrefix}/alerts`}>
                Alert History
              </NavListItem>
            )}
          </NavBlock>

          {/* Admin */}
          {enabled('admin') && (
            <Authorized
              requiredRole={ADMIN_ROLE}
              replaceWithIfNotUsingAuth={
                enabled('admin-influxdb') ? (
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
                ) : null
              }
            >
              <NavBlock
                highlightWhen={['admin-cloudhub', 'admin-influxdb']}
                icon="crown-outline"
                link={
                  enabled('admin-cloudhub')
                    ? `${sourcePrefix}/admin-cloudhub/current-organization`
                    : `${sourcePrefix}/admin-influxdb/databases`
                }
                location={location}
              >
                <NavHeader
                  link={
                    enabled('admin-cloudhub')
                      ? `${sourcePrefix}/admin-cloudhub/current-organization`
                      : `${sourcePrefix}/admin-influxdb/databases`
                  }
                  title="Admin"
                />
                {enabled('admin-cloudhub') && (
                  <NavListItem
                    link={`${sourcePrefix}/admin-cloudhub/current-organization`}
                  >
                    CloudHub
                  </NavListItem>
                )}
                {enabled('admin-influxdb') && (
                  <NavListItem
                    link={`${sourcePrefix}/admin-influxdb/databases`}
                  >
                    InfluxDB
                  </NavListItem>
                )}
              </NavBlock>
            </Authorized>
          )}
          {this.Configuration}
          {isUsingAuth && (
            <UserNavBlock
              logoutLink={logoutLink}
              links={links}
              me={me}
              sourcePrefix={sourcePrefix}
            />
          )}
          {/* SWAN/Oncue nav hidden — not in use
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
            </NavBlock>
          )}
          */}
        </>
      )
    }

    const {canScrollUp, canScrollDown} = this.state

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

        <div
          className={classnames('sidebar--scroll-fade', {
            'sidebar--scroll-fade__top': canScrollUp,
            'sidebar--scroll-fade__bottom': canScrollDown,
          })}
        >
          <div
            className="sidebar--scroll"
            ref={this.setScrollRef}
            onScroll={this.handleScroll}
          >
            {navItem()}
          </div>
        </div>

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
  orgNavMenu,
}) => ({
  sources,
  isHidden: inPresentationMode,
  isUsingAuth,
  logoutLink,
  links,
  env,
  me,
  shell,
  orgNavMenu: orgNavMenu || {orgId: null, selection: {}},
})

const mapDispatchToProps = {
  openShell: openShell,
  closeShell: closeShell,
  loadOrgNavMenu: loadOrgNavMenuAsync,
}

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(SideNav))
