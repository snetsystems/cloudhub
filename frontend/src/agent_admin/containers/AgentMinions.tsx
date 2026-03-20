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
  registerHost as registerAgent,
  updateHost as updateAgent,
  patchHost,
  deleteHost as deleteAgent,
  IPInterface,
  Disk,
  GPU,
  Host as Agent,
  HostStatus as AgentStatus,
} from 'src/shared/apis/host'
import {
  getLocalGrainsItem,
  getLocalMountActive,
  getLocalDiskUsage,
} from 'src/shared/apis/saltStack'
import {waitForSaltCallCompletion} from 'src/agent_admin/apis'
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
      disks: agent.disks ?? [],
    }

    this.setState({minionLog: yaml.dump(agentInfo)})
  }

  private buildAgentPayload = (
    host: string,
    grains: Record<string, any>,
    mountActive: Record<string, any>,
    status: AgentStatus = 'accepted'
  ) => {
    const ipIfaceRaw: Record<string, string[]> = grains.ip_interfaces ?? {}
    const ipInterfaces: IPInterface[] = Object.entries(
      ipIfaceRaw
    ).flatMap(([interfaceName, addresses]) =>
      (addresses as string[]).map(ipAddress => ({interfaceName, ipAddress}))
    )

    const isWindows = String(grains.kernel ?? '').toLowerCase() === 'windows'

    const disks: Disk[] = isWindows
      ? Object.keys(mountActive).map(drive => ({
          device: drive,
          mountPoint: drive,
        }))
      : Object.entries(mountActive)
          .filter(([_, info]) =>
            String((info as any)?.device ?? '').startsWith('/dev/')
          )
          .map(([mountPoint, info]: [string, any]) => ({
            device: String((info as any)?.device ?? ''),
            mountPoint,
          }))

    const gpusRaw = grains.gpus
    const gpus: GPU[] = gpusRaw
      ? Object.values(gpusRaw as Record<string, any>).map((g: any) => ({
          vendor: String(g.vendor ?? ''),
          model: String(g.model ?? ''),
        }))
      : []

    return {
      hostname: String(grains.host ?? host),
      ipInterfaces,
      os: String(grains.os ?? ''),
      osFamily: String(grains.os_family ?? grains.osfamily ?? ''),
      osVersion: String(grains.osrelease ?? ''),
      kernel: String(grains.kernel ?? ''),
      arch: String(grains.cpuarch ?? ''),
      memTotalKb: parseInt(grains.mem_total ?? '0', 10) * 1024,
      swapTotalKb: parseInt(grains.swap_total ?? '0', 10) * 1024,
      cpuCores: parseInt(grains.num_cpus ?? '0', 10),
      cpuModel: String(grains.cpu_model ?? ''),
      biosVersion: String(grains.biosversion ?? ''),
      disks,
      gpus,
      status,
    }
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
      const grainsResp = await getLocalGrainsItem(
        saltMasterUrl,
        saltMasterToken,
        host
      )
      const grains = grainsResp?.data?.return?.[0]?.[host] ?? {}
      const isWindows = String(grains.kernel ?? '').toLowerCase() === 'windows'

      let diskData: Record<string, any> = {}
      try {
        if (isWindows) {
          const diskResp = await getLocalDiskUsage(
            saltMasterUrl,
            saltMasterToken,
            host
          )
          const data = diskResp?.data?.return?.[0]?.[host]
          if (data != null && typeof data === 'object') diskData = data
        } else {
          const mountResp = await getLocalMountActive(
            saltMasterUrl,
            saltMasterToken,
            host
          )
          const data = mountResp?.data?.return?.[0]?.[host]
          if (data != null && typeof data === 'object') diskData = data
        }
      } catch (_) {}

      await updateAgent(host, {
        minionId: host,
        sourceType: 'salt',
        ...this.buildAgentPayload(host, grains, diskData),
      })

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
            const grainsResp = await waitForSaltCallCompletion(
              getLocalGrainsItem,
              res =>
                res.data?.return[0][host] !== false &&
                res.data?.return[0][host] != null,
              [saltMasterUrl, saltMasterToken, host]
            )
            const grains = grainsResp?.data?.return?.[0]?.[host] ?? {}
            const isWindows =
              String(grains.kernel ?? '').toLowerCase() === 'windows'

            let diskData: Record<string, any> = {}
            try {
              if (isWindows) {
                const diskResp = await getLocalDiskUsage(
                  saltMasterUrl,
                  saltMasterToken,
                  host
                )
                const data = diskResp?.data?.return?.[0]?.[host]
                if (data != null && typeof data === 'object') diskData = data
              } else {
                const mountResp = await getLocalMountActive(
                  saltMasterUrl,
                  saltMasterToken,
                  host
                )
                const data = mountResp?.data?.return?.[0]?.[host]
                if (data != null && typeof data === 'object') diskData = data
              }
            } catch (_) {}

            const payload = {
              minionId: host,
              sourceType: 'salt' as const,
              ...this.buildAgentPayload(host, grains, diskData, 'accepted'),
            }
            const existsInDb = this.props.agents.some(a => a.minionId === host)
            if (existsInDb) {
              await updateAgent(host, payload)
            } else {
              await registerAgent(payload)
            }

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

    const saltHosts = new Set(minionsFromSalt.map(m => m.host))
    agents.forEach((agent: Agent) => {
      if (saltHosts.has(agent.minionId)) {
        return
      }
      composedMinions.push({
        host: agent.minionId,
        os: agent.os,
        osVersion: agent.osVersion,
        ip: agent.privateIps?.[0] ?? '',
        status: MinionState.Accept,
      } as any)
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
