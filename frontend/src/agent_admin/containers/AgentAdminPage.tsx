// Libraries
import React, {PureComponent, MouseEvent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'

// Components
import {Page} from 'src/reusable_ui'
import SubSections from 'src/shared/components/SubSections'
import AgentMinions from 'src/agent_admin/containers/AgentMinions'
import AgentConfiguration from 'src/agent_admin/containers/AgentConfiguration'
import AgentControl from 'src/agent_admin/containers/AgentControl'
import {openShell} from 'src/shared/actions/shell'
import ServiceConfig from 'src/agent_admin/containers/ServiceConfig'

// Actions
import {getMinionKeyListAllAdminAsync} from 'src/agent_admin/actions'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'

// Constants
import {
  isUserAuthorized,
  ADMIN_ROLE,
  SUPERADMIN_ROLE,
} from 'src/auth/Authorized'
import {COLLECTOR_CONFIG_TAB_ABBREVIATION} from 'src/agent_admin/constants'

// Types
import {
  Links,
  Source,
  RemoteDataState,
  Notification,
  NotificationFunc,
  ShellInfo,
} from 'src/types'
import {Addon} from 'src/types/auth'
import {AddonType} from 'src/shared/constants'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'
import {MinionsObject} from 'src/agent_admin/type'

// APIs
import {
  getTelegrafState,
  getTelegrafInstalledList,
  updateMinionKeyState,
} from 'src/agent_admin/apis'
import {extractTelegrafVersion} from 'src/agent_admin/utils'
import {getHosts, Host as Agent} from 'src/shared/apis/host'
import {getManageUp} from 'src/shared/apis/saltStack'

interface Props {
  links: Links
  source: Source
  notify: (message: Notification | NotificationFunc) => void
  handleGetMinionKeyListAll: (
    saltMasterUrl: string,
    saltMasterToken: string,
    source: Source,
    meRole: string
  ) => Promise<MinionsObject>
  meRole: string
  params: {tab: string}
  handleKeyDown: () => void
  addons: Addon[]
  openShell: (shell: ShellInfo) => void
}

interface State {
  agentPageStatus: RemoteDataState
  minionsStatus: RemoteDataState
  isSaltLoading: boolean
  isSelectBoxView: boolean
  minionsObject: MinionsObject
  saltMasterUrl: string
  saltMasterToken: string
  shellModalVisible: boolean
  shellAddr: string
  nodename: string
  agents: Agent[]
}

export interface LoginEvent extends MouseEvent<KeyboardEvent> {
  onClick?: React.MouseEvent<HTMLButtonElement, MouseEvent>
  onKeydown?: React.KeyboardEvent<HTMLInputElement>
}

@ErrorHandling
class AgentAdminPage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      agentPageStatus: RemoteDataState.NotStarted,
      minionsStatus: RemoteDataState.NotStarted,
      isSaltLoading: false,
      isSelectBoxView: true,
      minionsObject: {},
      saltMasterUrl: '',
      saltMasterToken: '',
      shellModalVisible: false,
      shellAddr: '',
      nodename: '',
      agents: [],
    }
  }

  componentWillMount() {
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token

    this.setState({
      saltMasterUrl: saltMasterUrl,
      saltMasterToken: saltMasterToken,
    })

    this.getMinionKeyListAll()
  }

  public setMinionStatus = ({
    minionsStatus,
  }: {
    minionsStatus: RemoteDataState
  }) => {
    this.setState({minionsStatus})
  }

  public getMinionKeyListAll = async () => {
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token

    this.setState({minionsStatus: RemoteDataState.Loading})

    const [minionListObject, dbHosts] = await Promise.all([
      this.props.handleGetMinionKeyListAll(
        saltMasterUrl,
        saltMasterToken,
        this.props.source,
        this.props.meRole
      ),
      getHosts().catch(() => [] as Agent[]),
    ])

    const dbByMinionId = new Map((dbHosts as Agent[]).map(h => [h.minionId, h]))
    const saltRunningKeys: string[] = []

    for (const key of Object.keys(minionListObject)) {
      const dbHost = dbByMinionId.get(key)
      if (dbHost) {
        minionListObject[key] = {
          ...minionListObject[key],
          os: dbHost.os,
          osVersion: dbHost.osVersion,
          ip: dbHost.privateIps?.[0] ?? '',
          isSaltRunning: undefined,
        }
        saltRunningKeys.push(key)
      }
    }

    const hasDbHosts = (dbHosts as Agent[]).length > 0

    if (hasDbHosts) {
      this.setState({
        agents: dbHosts,
        minionsObject: minionListObject,
        minionsStatus: RemoteDataState.Done,
      })
    }

    if (saltRunningKeys.length === 0) {
      if (!hasDbHosts) {
        this.setState({
          agents: dbHosts,
          minionsObject: minionListObject,
          minionsStatus: RemoteDataState.Done,
        })
      }
      return
    }

    if (hasDbHosts) this.setState({isSaltLoading: true})
    let onlineSet = new Set<string>()
    try {
      const upRes = await getManageUp(saltMasterUrl, saltMasterToken)
      const upList: string[] = upRes?.data?.return?.[0] ?? []
      onlineSet = new Set(upList)
    } catch (_) {}
    if (hasDbHosts) this.setState({isSaltLoading: false})

    const onlineKeys = saltRunningKeys.filter(k => onlineSet.has(k))

    for (const key of saltRunningKeys) {
      minionListObject[key] = {
        ...minionListObject[key],
        isSaltRunning: onlineSet.has(key),
      }
    }

    if (onlineKeys.length > 0) {
      try {
        const telegrafInfo = await getTelegrafInstalledList(
          saltMasterUrl,
          saltMasterToken,
          onlineKeys.toString()
        )
        const installList = telegrafInfo[0].data.return[0]
        const statusList = telegrafInfo[1].data.return[0]
        const versionList = telegrafInfo[2].data.return[0]
        for (const key of onlineKeys) {
          const {version} = extractTelegrafVersion(versionList[key])
          minionListObject[key] = {
            ...minionListObject[key],
            isInstall: installList[key] === true,
            isRunning: statusList[key] === true,
            telegrafVersion: version,
          }
        }
      } catch (_) {}
    }

    if (!hasDbHosts) {
      this.setState({
        agents: dbHosts,
        minionsObject: {...minionListObject},
        minionsStatus: RemoteDataState.Done,
      })
    } else {
      this.setState({minionsObject: {...minionListObject}})
    }
  }

  public refreshAgents = async () => {
    const agents = await getHosts()
    this.setState({agents})
  }

  public updateTelegrafState = async (targetMinion: string) => {
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })
    const {minionsObject} = this.state
    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    this.setState({minionsStatus: RemoteDataState.Loading})

    const minionAfterTelegrafUpdate = await getTelegrafState(
      saltMasterUrl,
      saltMasterToken,
      targetMinion,
      minionsObject
    )

    this.setState({
      minionsObject: minionAfterTelegrafUpdate,
      minionsStatus: RemoteDataState.Done,
    })
  }

  public updateMinionState = async (targetMinion: string) => {
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })
    const {minionsObject} = this.state
    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token

    this.setState({minionsStatus: RemoteDataState.Loading})

    const minionListObject = await updateMinionKeyState(
      saltMasterUrl,
      saltMasterToken,
      targetMinion,
      minionsObject
    )

    this.setState({
      minionsObject: minionListObject,
      minionsStatus: RemoteDataState.Done,
    })
  }

  public sections = (meRole: string) => {
    const {
      saltMasterUrl,
      saltMasterToken,
      minionsObject,
      minionsStatus,
      isSaltLoading,
      agents,
    } = this.state
    const collectorConfigTableTabs = this.getCollectorConfigTableTabs()

    return [
      {
        url: 'agent-minions',
        name: 'Minions',
        enabled: isUserAuthorized(meRole, ADMIN_ROLE),
        component: (
          <AgentMinions
            isUserAuthorized={isUserAuthorized(meRole, ADMIN_ROLE)}
            currentUrl={'agent-minions'}
            saltMasterUrl={saltMasterUrl}
            saltMasterToken={saltMasterToken}
            minionsObject={minionsObject}
            minionsStatus={minionsStatus}
            isSaltLoading={isSaltLoading}
            agents={agents}
            onRefreshAgents={this.refreshAgents}
            handleUpdateMinionStatus={this.updateMinionState}
            handleSetMinionStatus={this.setMinionStatus}
            handleShellModalOpen={this.onClickShellModalOpen}
            handleShellModalClose={this.onClickShellModalClose}
          />
        ),
      },
      {
        url: 'agent-control',
        name: 'Collector Control',
        enabled: isUserAuthorized(meRole, ADMIN_ROLE),
        component: (
          <AgentControl
            isUserAuthorized={isUserAuthorized(meRole, ADMIN_ROLE)}
            currentUrl={'agent-control'}
            saltMasterUrl={saltMasterUrl}
            saltMasterToken={saltMasterToken}
            minionsObject={minionsObject}
            minionsStatus={minionsStatus}
            handleTelegrafStatus={this.updateTelegrafState}
            handleSetMinionStatus={this.setMinionStatus}
          />
        ),
      },
      {
        url: 'agent-configuration',
        name: 'Collector Config',
        enabled: isUserAuthorized(meRole, ADMIN_ROLE),
        component: (
          <AgentConfiguration
            isUserAuthorized={isUserAuthorized(meRole, ADMIN_ROLE)}
            currentUrl={'agent-configuration'}
            saltMasterUrl={saltMasterUrl}
            saltMasterToken={saltMasterToken}
            minionsObject={minionsObject}
            minionsStatus={minionsStatus}
            handleTelegrafStatus={this.updateTelegrafState}
            handleGetMinionKeyListAll={this.getMinionKeyListAll}
            handleSetMinionStatus={this.setMinionStatus}
          />
        ),
      },
      {
        url: 'service-config',
        name: 'Service Config',
        enabled:
          isUserAuthorized(meRole, SUPERADMIN_ROLE) &&
          collectorConfigTableTabs.length > 0,
        component: (
          <ServiceConfig
            saltMasterUrl={saltMasterUrl}
            saltMasterToken={saltMasterToken}
            minionsObject={minionsObject}
            minionsStatus={minionsStatus}
            collectorConfigTableTabs={collectorConfigTableTabs}
            isUserAuthorized={isUserAuthorized(meRole, ADMIN_ROLE)}
          />
        ),
      },
    ]
  }

  public getCollectorConfigTableTabs = () => {
    const cloudsName = COLLECTOR_CONFIG_TAB_ABBREVIATION
    const addons = this.props.addons

    return _.filter(
      addons,
      addon =>
        _.keys(cloudsName).indexOf(addon.name) !== -1 && addon.url === 'on'
    ).map(cloudname => cloudsName[cloudname.name])
  }

  public onRefresh = () => {
    this.getMinionKeyListAll()
  }

  render() {
    const {
      meRole,
      source,
      params: {tab},
    } = this.props

    return (
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Title title="Agent Configuration" />
          </Page.Header.Left>
          <Page.Header.Right>
            <button
              className="button button-sm button-default button-square"
              onClick={this.onRefresh}
            >
              <span className="button-icon icon refresh"></span>
            </button>
          </Page.Header.Right>
        </Page.Header>
        <Page.Contents fullWidth={true}>
          <div className="container-fluid full-height agent-page">
            <SubSections
              sections={this.sections(meRole)}
              activeSection={tab}
              parentUrl="agent-admin"
              sourceID={source.id}
            />
          </div>
        </Page.Contents>
      </Page>
    )
  }

  private onClickShellModalOpen = (shell: ShellInfo) => {
    this.props.openShell(shell)
  }

  private onClickShellModalClose = () => {
    event.preventDefault()
    this.setState({shellModalVisible: false})
  }
}

const mapStateToProps = ({auth: {me}, links: {addons}}) => {
  const meRole = _.get(me, 'role', null)
  return {
    meRole,
    addons,
  }
}

const mapDispatchToProps = {
  notify: notifyAction,
  handleGetMinionKeyListAll: getMinionKeyListAllAdminAsync,
  openShell: openShell,
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null
)(AgentAdminPage)
