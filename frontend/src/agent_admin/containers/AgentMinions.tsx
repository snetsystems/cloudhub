// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import yaml from 'js-yaml'
import {AxiosResponse} from 'axios'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import AgentMinionsTable from 'src/agent_admin/components/AgentMinionsTable'
import AgentMinionsConsole from 'src/agent_admin/components/AgentMinionsConsole'
import AgentMinionsModal from 'src/agent_admin/components/AgentMinionsModal'
import AgentMinionsConsoleTableBodyRow from 'src/agent_admin/components/AgentMinionsConsoleTableBodyRow'

// Actions
import {
  runAcceptKeyAsync,
  runRejectKeyAsync,
  runDeleteKeyAsync,
} from 'src/agent_admin/actions'

import {
  patchHost,
  deleteHost as deleteAgent,
  Host as Agent,
} from 'src/shared/apis/host'
import {getLocalGrainsItem} from 'src/shared/apis/saltStack'
import {waitForSaltCallCompletion} from 'src/agent_admin/apis'
import {syncMinionFromSaltToDb} from 'src/agent_admin/utils/syncMinionFromSaltToDb'
import {UserRole, ForceSessionAbortInputRole} from 'src/shared/actions/session'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  notifyAgentStartSucceeded,
  notifyAgentLoadFailed,
} from 'src/shared/copy/notifications'

// Constants
import {HANDLE_HORIZONTAL} from 'src/shared/constants'
import {ADMIN_ROLE} from 'src/auth/Authorized'

// Types
import {
  RemoteDataState,
  Notification,
  NotificationFunc,
  ShellInfo,
} from 'src/types'
import {MinionsObject} from 'src/agent_admin/type'
import {MinionState} from 'src/agent_admin/type/minion'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface OwnProps {
  isUserAuthorized: boolean
  currentUrl: string
  saltMasterUrl: string
  saltMasterToken: string
  minionsObject: MinionsObject
  minionsStatus: RemoteDataState
  isSaltLoading?: boolean
  handleUpdateMinionStatus: (targetMinion: string) => Promise<void>
  handleSetMinionStatus: ({
    minionsStatus,
  }: {
    minionsStatus: RemoteDataState
  }) => void
  handleShellModalOpen?: (shell: ShellInfo) => void
  handleShellModalClose: () => void
  agents: Agent[]
  onRefreshAgents: () => Promise<void>
}

interface DispatchProps {
  notify: (message: Notification | NotificationFunc) => void
  handleRunAcceptKey: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string
  ) => Promise<AxiosResponse>
  handleRunRejectKey: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string
  ) => Promise<AxiosResponse>
  handleRunDeleteKey: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string
  ) => Promise<AxiosResponse>
  ForceSessionAbortInputRole: (
    requireRole: UserRole,
    isNoAuthOuting?: boolean
  ) => void
}

type Props = OwnProps & DispatchProps
interface State {
  minionsPageStatus: RemoteDataState
  minionLog: string
  currentUrl: string
  proportions: number[]
  focusedHost: string
  processingHost: string
}

@ErrorHandling
export class AgentMinions extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      minionLog: '',
      proportions: [0.43, 0.57],
      currentUrl: '',
      minionsPageStatus: RemoteDataState.NotStarted,
      focusedHost: '',
      processingHost: '',
    }
  }

  public componentWillMount() {
    this.props.ForceSessionAbortInputRole(ADMIN_ROLE)
    this.setState({minionsPageStatus: this.props.minionsStatus})
  }

  public componentDidUpdate(prevProps: Props) {
    if (prevProps !== this.props) {
      this.setState({minionsPageStatus: this.props.minionsStatus})
    }
  }

  public onClickTableRowCall = (host: string) => () => {
    this.setState({focusedHost: host})

    const agent = this.props.agents.find(a => a.minionId === host)
    if (!agent) {
      this.setState({minionLog: ''})
      return
    }

    // Convert DB agent to grains-compatible object for the console
    const ipIfacesMap: Record<string, string[]> = {}
    for (const iface of agent.ipInterfaces ?? []) {
      if (!ipIfacesMap[iface.interfaceName]) {
        ipIfacesMap[iface.interfaceName] = []
      }
      ipIfacesMap[iface.interfaceName].push(iface.ipAddress)
    }

    const agentInfo = {
      os: agent.os,
      os_family: agent.osFamily,
      osrelease: agent.osVersion,
      kernel: agent.kernel,
      localhost: agent.hostname,
      biosversion: agent.biosVersion,
      mem_total: Math.round(agent.memTotalKb / 1024),
      swap_total: Math.round(agent.swapTotalKb / 1024),
      cpuarch: agent.arch,
      cpu_model: agent.cpuModel,
      num_cpus: agent.cpuCores,
      ip_interfaces: ipIfacesMap,
      gpus: agent.gpus ?? [],
      timezone: agent.timezone ?? '',
      selinux_state: agent.selinuxState ?? '',
    }

    this.setState({minionLog: yaml.dump(agentInfo)})
  }

  private handleRefreshMinion = async (host: string) => {
    const {
      notify,
      saltMasterUrl,
      saltMasterToken,
      minionsObject,
      onRefreshAgents,
    } = this.props

    const minionStatus = minionsObject[host]?.status
    if (
      minionStatus !== MinionState.Accept &&
      minionStatus !== MinionState.Reject
    ) {
      return
    }

    this.setState({focusedHost: host, processingHost: host})

    try {
      await syncMinionFromSaltToDb(
        saltMasterUrl,
        saltMasterToken,
        host,
        this.props.agents,
        'accepted'
      )

      await onRefreshAgents()
      notify(notifyAgentStartSucceeded(host))
    } catch (err) {
      console.warn(`handleRefreshMinion: failed to refresh ${host}:`, err)
      notify(
        notifyAgentLoadFailed(
          err instanceof Error ? err : new Error(String(err))
        )
      )
    } finally {
      this.setState({processingHost: ''})
    }
  }

  public handleWheelKeyCommand = async (host: string, cmdstatus: string) => {
    const {
      saltMasterUrl,
      saltMasterToken,
      handleRunRejectKey,
      handleUpdateMinionStatus,
      handleRunAcceptKey,
      handleRunDeleteKey,
      onRefreshAgents,
    } = this.props

    this.setState({processingHost: host})
    switch (cmdstatus) {
      case MinionState.Reject: {
        try {
          await handleRunRejectKey(saltMasterUrl, saltMasterToken, host)

          // Patch status to rejected (host already exists in DB)
          try {
            await patchHost(host, {status: 'rejected'})
          } catch (agentErr) {
            console.warn('Agent reject patch failed:', agentErr)
          }

          await handleUpdateMinionStatus(host)
        } catch (error) {
          console.error(error)
        }
        this.setState({processingHost: ''})
        return
      }
      case MinionState.Accept: {
        try {
          await handleRunAcceptKey(saltMasterUrl, saltMasterToken, host)

          // Wait for minion to connect by retrying grains.item until valid data arrives
          // (UI status only updates after DB save below)
          try {
            await waitForSaltCallCompletion(
              getLocalGrainsItem,
              res =>
                res.data?.return[0][host] !== false &&
                res.data?.return[0][host] != null,
              [saltMasterUrl, saltMasterToken, host]
            )
            await syncMinionFromSaltToDb(
              saltMasterUrl,
              saltMasterToken,
              host,
              this.props.agents,
              'accepted'
            )

            await handleUpdateMinionStatus(host)

            // Refresh agents so the console shows data when row is clicked
            await onRefreshAgents()
          } catch (agentErr) {
            console.warn('Agent registration failed:', agentErr)
          }
        } catch (error) {
          console.error(error)
        }
        this.setState({processingHost: ''})
        return
      }
      case MinionState.Delete: {
        try {
          await handleRunDeleteKey(saltMasterUrl, saltMasterToken, host)
          await handleUpdateMinionStatus(host)
          try {
            await deleteAgent(host)
            await onRefreshAgents()
          } catch (agentErr) {
            console.warn('Agent delete from DB failed:', agentErr)
          }
        } catch (error) {
          console.error(error)
        }
        this.setState({processingHost: ''})
        return
      }

      default: {
        await handleUpdateMinionStatus(host)
        return
      }
    }
  }

  public renderConsoleTableBodyRow({
    name,
    host,
    idx,
    os,
    ip,
    _this,
    handleShellModalOpen,
    handleShellModalClose,
  }: {
    name: string
    host: string
    idx: number
    os: string
    ip: string
    _this: HTMLElement
    handleShellModalOpen?: (shell: ShellInfo) => void
    handleShellModalClose?: () => void
  }) {
    return (
      <AgentMinionsConsoleTableBodyRow
        name={name}
        os={os}
        ip={ip}
        host={host}
        idx={idx}
        targetObject={_this}
        handleShellModalOpen={handleShellModalOpen}
        handleShellModalClose={handleShellModalClose}
      />
    )
  }

  public onClickModalCall({
    name,
    host,
    status,
    _this,
    idx,
    handleWheelKeyCommand,
  }: {
    name: string
    host: string
    status: string
    _this: HTMLElement
    idx: number
    handleWheelKeyCommand: () => void
  }) {
    return (
      <AgentMinionsModal
        name={name}
        host={host}
        idx={idx}
        status={status}
        targetObject={_this}
        handleWheelKeyCommand={handleWheelKeyCommand}
      />
    )
  }

  public render() {
    const {isUserAuthorized, ForceSessionAbortInputRole} = this.props
    ForceSessionAbortInputRole(ADMIN_ROLE)

    return (
      <>
        {isUserAuthorized ? (
          <div className="panel panel-solid">
            <Threesizer
              orientation={HANDLE_HORIZONTAL}
              divisions={this.horizontalDivisions}
              onResize={this.handleResize}
            />
          </div>
        ) : (
          <div className="generic-empty-state agent-table--empty-state">
            <h4>Not Allowed User</h4>
          </div>
        )}
      </>
    )
  }

  private handleResize = (proportions: number[]) => {
    this.setState({proportions})
  }

  private renderAgentPageBottom = () => {
    const {minionLog} = this.state
    return <AgentMinionsConsole res={minionLog} />
  }

  private get horizontalDivisions() {
    const {proportions} = this.state
    const [topSize, bottomSize] = proportions

    return [
      {
        name: '',
        handleDisplay: 'none',
        headerButtons: [],
        menuOptions: [],
        render: this.renderAgentPageTop,
        headerOrientation: HANDLE_HORIZONTAL,
        size: topSize,
      },
      {
        name: '',
        handlePixels: 8,
        headerButtons: [],
        menuOptions: [],
        render: this.renderAgentPageBottom,
        headerOrientation: HANDLE_HORIZONTAL,
        size: bottomSize,
      },
    ]
  }

  private renderAgentPageTop = () => {
    const {focusedHost, minionsPageStatus, processingHost} = this.state
    const {
      minionsObject,
      agents,
      handleShellModalOpen,
      handleShellModalClose,
    } = this.props

    const minionsFromSalt = _.values(minionsObject)
    const agentByMinionId = new Map(agents.map((a: Agent) => [a.minionId, a]))

    // Rows are only Salt key.list_all keys; DB agents enrich matching minion_id (left join).
    // Do not append DB-only hosts — they belong to a different Salt master or stale inventory.
    const composedMinions = minionsFromSalt.map(m => {
      const agent = agentByMinionId.get(m.host)
      if (!agent) {
        return m
      }
      return {
        ...m,
        os: agent.os,
        osVersion: agent.osVersion,
        ip: agent.privateIps?.[0] ?? '',
      }
    })

    const tableStatus = minionsPageStatus

    return (
      <AgentMinionsTable
        minions={composedMinions}
        minionsPageStatus={tableStatus}
        onClickTableRow={this.onClickTableRowCall}
        onClickModal={this.onClickModalCall}
        renderConsoleTableBodyRow={this.renderConsoleTableBodyRow}
        handleWheelKeyCommand={this.handleWheelKeyCommand}
        onRefreshMinion={this.handleRefreshMinion}
        focusedHost={focusedHost}
        handleShellModalOpen={handleShellModalOpen}
        handleShellModalClose={handleShellModalClose}
        isSaltLoading={
          this.props.isSaltLoading ||
          this.props.minionsStatus === RemoteDataState.Loading
        }
        processingHost={processingHost}
      />
    )
  }
}

const mdtp = {
  notify: notifyAction,
  handleRunAcceptKey: runAcceptKeyAsync,
  handleRunRejectKey: runRejectKeyAsync,
  handleRunDeleteKey: runDeleteKeyAsync,
  ForceSessionAbortInputRole,
}

export default connect(
  null,
  mdtp
)(AgentMinions) as React.ComponentType<OwnProps>
