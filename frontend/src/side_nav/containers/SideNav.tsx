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
import {
  DEFAULT_NAV_CHILD,
  isOrgNavMenuEnabled,
  resolveNavDestination,
} from 'src/side_nav/utils/orgNavMenuVisibility'

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

  private navLink = (
    defaultId: string,
    items: Array<{id: string; path: string; available?: boolean}>
  ): string => {
    return (
      resolveNavDestination(
        this.props.orgNavMenu?.selection,
        items,
        defaultId
      ) ||
      items.find(item => item.id === defaultId)?.path ||
      items[0].path
    )
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
    const aiLink = this.navLink(DEFAULT_NAV_CHILD['ai-chat'], [
      {id: 'ai-chatbot', path: `${sourcePrefix}/ai-chat`},
      {
        id: 'openclaw-skills',
        path: `${sourcePrefix}/openclaw-skills`,
        available: isAdminRole,
      },
    ])
    const networkLink = this.navLink(DEFAULT_NAV_CHILD['network-monitoring'], [
      {
        id: 'network-management',
        path: `${sourcePrefix}/network-monitoring/management`,
      },
      {
        id: 'network-anomaly',
        path: `${sourcePrefix}/network-monitoring/anomaly-prediction`,
      },
    ])
    const serverLink = this.navLink(DEFAULT_NAV_CHILD['server-monitoring'], [
      {id: 'server-topology', path: `${sourcePrefix}/server-monitoring/topology`},
      {id: 'server-list', path: `${sourcePrefix}/server-monitoring/server-list`},
      {
        id: 'server-details',
        path: `${sourcePrefix}/server-monitoring/${SERVER_DETAILS_PAGE_NAME}`,
      },
      {
        id: 'gpu-monitoring',
        path: `${sourcePrefix}/server-monitoring/gpu-monitoring`,
      },
      {id: 'server-alert', path: `${sourcePrefix}/server-monitoring/server-alert`},
    ])
    const urlLink = this.navLink(DEFAULT_NAV_CHILD['url-monitoring'], [
      {id: 'url-list', path: `${sourcePrefix}/url-monitoring/url-list`},
      {id: 'url-alert', path: `${sourcePrefix}/url-monitoring/url-alert`},
    ])
    const kubernetesLink = this.navLink(
      DEFAULT_NAV_CHILD.kubernetes,
      kubernetesNavItems.map(item => ({id: item.id, path: item.link}))
    )
    const logLink = this.navLink(
      isUsingLogAnalysis ? DEFAULT_NAV_CHILD['log-viewer'] : 'logs',
      [
      {
        id: 'log-analysis',
        path: `${sourcePrefix}/log-analysis`,
        available: isUsingLogAnalysis,
      },
      {id: 'logs', path: `${sourcePrefix}/logs`},
      {id: 'activity-logs', path: `${sourcePrefix}/activity-logs`},
    ])
    const alertLink = this.navLink(
      isAdminRole ? DEFAULT_NAV_CHILD.alert : 'alerts',
      [
      {
        id: 'alert-rules',
        path: `${sourcePrefix}/alert-rules`,
        available: isAdminRole,
      },
      {id: 'alerts', path: `${sourcePrefix}/alerts`},
    ])
    const adminLink = this.navLink(DEFAULT_NAV_CHILD.admin, [
      {
        id: 'admin-cloudhub',
        path: `${sourcePrefix}/admin-cloudhub/current-organization`,
      },
      {id: 'admin-influxdb', path: `${sourcePrefix}/admin-influxdb/databases`},
    ])

    const navItem = () => {
      return (
        <>
          {/* AI Assistant */}
          <NavBlock
            visible={enabled('ai-chat')}
            highlightWhen={['ai-chat', 'ai-chat-test', 'openclaw-skills']}
            icon="ai-robot"
            link={aiLink}
            location={location}
          >
            <NavHeader link={aiLink} title="AI Assistant" />
            {enabled('ai-chatbot') && (
              <NavListItem link={`${sourcePrefix}/ai-chat`} icon="chat">
                Chatbot
              </NavListItem>
            )}
            {isAdminRole && enabled('openclaw-skills') && (
              <NavListItem
                link={`${sourcePrefix}/openclaw-skills`}
                icon="bookmark"
              >
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
            link={networkLink}
            location={location}
          >
            <NavHeader link={networkLink} title="Network Monitoring" />
            {enabled('network-management') && (
              <NavListItem
                link={`${sourcePrefix}/network-monitoring/management`}
                icon="sign-up"
              >
                Device Management
              </NavListItem>
            )}
            {enabled('network-anomaly') && (
              <NavListItem
                link={`${sourcePrefix}/network-monitoring/anomaly-prediction`}
                icon="computer-desktop"
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
            link={serverLink}
            location={location}
          >
            <NavHeader link={serverLink} title="Server Monitoring" />
            {enabled('server-topology') && (
              <NavListItem
                link={`${sourcePrefix}/server-monitoring/topology`}
                icon="tree"
              >
                Topology Builder
              </NavListItem>
            )}
            {enabled('server-list') && (
              <NavListItem
                link={`${sourcePrefix}/server-monitoring/server-list`}
                icon="text-block"
              >
                Server List
              </NavListItem>
            )}
            {enabled('server-details') && (
              <NavListItem
                link={`${sourcePrefix}/server-monitoring/${SERVER_DETAILS_PAGE_NAME}`}
                icon="list"
              >
                Server Details
              </NavListItem>
            )}
            {enabled('gpu-monitoring') && (
              <NavListItem
                link={`${sourcePrefix}/server-monitoring/gpu-monitoring`}
                icon="ai-icon"
              >
                NVIDIA GPU Monitoring
              </NavListItem>
            )}
            {enabled('server-alert') && (
              <NavListItem
                link={`${sourcePrefix}/server-monitoring/server-alert`}
                icon="bell"
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
            link={urlLink}
            location={location}
          >
            <NavHeader link={urlLink} title="URL Monitoring" />
            {enabled('url-list') && (
              <NavListItem
                link={`${sourcePrefix}/url-monitoring/url-list`}
                icon="text-block"
              >
                URL List
              </NavListItem>
            )}
            {enabled('url-alert') && (
              <NavListItem
                link={`${sourcePrefix}/url-monitoring/url-alert`}
                icon="bell"
              >
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
            link={kubernetesLink}
            location={location}
          >
            <NavHeader link={kubernetesLink} title="Kubernetes" />
            {kubernetesNavItems.map(
              item =>
                enabled(item.id) && (
                  <NavListItem
                    key={item.link}
                    link={item.link}
                    exact={item.exact}
                    icon={item.icon}
                  >
                    {item.label}
                  </NavListItem>
                )
            )}
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
            link={logLink}
            location={location}
          >
            <NavHeader link={logLink} title="Log Viewer" />
            {isUsingLogAnalysis && enabled('log-analysis') && (
              <NavListItem link={`${sourcePrefix}/log-analysis`} icon="search">
                Log Analysis
              </NavListItem>
            )}
            {enabled('logs') && (
              <NavListItem link={`${sourcePrefix}/logs`} icon="document">
                Log Viewer
              </NavListItem>
            )}
            {enabled('activity-logs') && (
              <NavListItem
                link={`${sourcePrefix}/activity-logs`}
                icon="timeboard"
              >
                Activity Logs
              </NavListItem>
            )}
          </NavBlock>

          {/* Alert */}
          <NavBlock
            visible={enabled('alert')}
            highlightWhen={['alerts', 'alert-rules', 'tickscript']}
            icon="bell"
            link={alertLink}
            location={location}
          >
            <NavHeader link={alertLink} title="Alert" />
            {isAdminRole && enabled('alert-rules') && (
              <NavListItem
                link={`${sourcePrefix}/alert-rules`}
                icon="cog-thick"
              >
                Alert Setting
              </NavListItem>
            )}
            {enabled('alerts') && (
              <NavListItem link={`${sourcePrefix}/alerts`} icon="clock">
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
                      icon="disks"
                    />
                  </NavBlock>
                ) : null
              }
            >
              <NavBlock
                highlightWhen={['admin-cloudhub', 'admin-influxdb']}
                icon="crown-outline"
                link={adminLink}
                location={location}
              >
                <NavHeader link={adminLink} title="Admin" />
                {enabled('admin-cloudhub') && (
                  <NavListItem
                    link={`${sourcePrefix}/admin-cloudhub/current-organization`}
                    icon="crown2"
                  >
                    CloudHub
                  </NavListItem>
                )}
                {enabled('admin-influxdb') && (
                  <NavListItem
                    link={`${sourcePrefix}/admin-influxdb/databases`}
                    icon="disks"
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
        <NavListItem link={`${sourcePrefix}/manage-sources`} icon="wrench">
          Configuration
        </NavListItem>
        {isUsingSalt && (
          <NavListItem
            link={`${sourcePrefix}/agent-admin/agent-minions`}
            icon="group"
          >
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
        <NavListItem
          link={`${sourcePrefix}/agent-admin/agent-minions`}
          icon="group"
        >
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
                icon="wrench"
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
              icon="wrench"
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
