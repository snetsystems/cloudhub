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
  getLocalGrainsItemAsync,
  runAcceptKeyAsync,
  runRejectKeyAsync,
  runDeleteKeyAsync,
} from 'src/agent_admin/actions'
import {UserRole, ForceSessionAbortInputRole} from 'src/shared/actions/session'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'

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

interface Props {
  notify: (message: Notification | NotificationFunc) => void
  handleGetLocalGrainsItem: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string
  ) => Promise<AxiosResponse>
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
  isUserAuthorized: boolean
  currentUrl: string
  saltMasterUrl: string
  saltMasterToken: string
  minionsObject: MinionsObject
  minionsStatus: RemoteDataState
  handleUpdateMinionStatus: (targetMinion: string) => Promise<void>
  handleSetMinionStatus: ({
    minionsStatus,
  }: {
    minionsStatus: RemoteDataState
  }) => void
  ForceSessionAbortInputRole: (
    requireRole: UserRole,
    isNoAuthOuting?: boolean
  ) => void

  handleShellModalOpen?: (shell: ShellInfo) => void
  handleShellModalClose: () => void
}
interface State {
  minionsPageStatus: RemoteDataState
  minionLog: string
  currentUrl: string
  proportions: number[]
  focusedHost: string
}

@ErrorHandling
export class AgentMinions extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      minionLog: '<< Empty >>',
      proportions: [0.43, 0.57],
      currentUrl: '',
      minionsPageStatus: RemoteDataState.NotStarted,
      focusedHost: '',
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

  public onClickTableRowCall = (host: string) => async () => {
    const {
      saltMasterUrl,
      saltMasterToken,
      minionsObject,
      handleGetLocalGrainsItem,
    } = this.props

    this.setState({
      focusedHost: host,
      minionsPageStatus: RemoteDataState.Loading,
    })

    if (minionsObject[host].status === MinionState.Accept) {
      try {
        const {data} = await handleGetLocalGrainsItem(
          saltMasterUrl,
          saltMasterToken,
          host
        )

        this.setState({
          minionLog: yaml.dump(data.return[0][host]),
          minionsPageStatus: RemoteDataState.Done,
        })
      } catch (error) {
        this.setState({
          minionLog: '',
          minionsPageStatus: RemoteDataState.Done,
        })
      }
    } else {
      this.setState({
        minionLog: '',
        minionsPageStatus: RemoteDataState.Done,
      })
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
    } = this.props

    this.setState({minionsPageStatus: RemoteDataState.Loading})
    switch (cmdstatus) {
      case MinionState.Reject: {
        try {
          const {data} = await handleRunRejectKey(
            saltMasterUrl,
            saltMasterToken,
            host
          )

          await handleUpdateMinionStatus(host)

          this.setState({
            minionLog: yaml.dump(data.return[0]),
          })
        } catch (error) {
          console.error(error)
        }
        return
      }
      case MinionState.Accept: {
        try {
          const {data} = await handleRunAcceptKey(
            saltMasterUrl,
            saltMasterToken,
            host
          )

          await handleUpdateMinionStatus(host)

          this.setState({
            minionLog: yaml.dump(data.return[0]),
          })
        } catch (error) {
          console.error(error)
        }
        return
      }
      case MinionState.Delete: {
        try {
          const {data} = await handleRunDeleteKey(
            saltMasterUrl,
            saltMasterToken,
            host
          )

          await handleUpdateMinionStatus(host)

          this.setState({
            minionLog: yaml.dump(data.return[0]),
          })
        } catch (error) {
          console.error(error)
        }
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

  private renderAgentPageTop = () => {
    const {focusedHost, minionsPageStatus} = this.state
    const {
      minionsObject,
      handleShellModalOpen,
      handleShellModalClose,
    } = this.props
    return (
      <AgentMinionsTable
        minions={_.values(minionsObject)}
        minionsPageStatus={minionsPageStatus}
        onClickTableRow={this.onClickTableRowCall}
        onClickModal={this.onClickModalCall}
        renderConsoleTableBodyRow={this.renderConsoleTableBodyRow}
        handleWheelKeyCommand={this.handleWheelKeyCommand}
        focusedHost={focusedHost}
        handleShellModalOpen={handleShellModalOpen}
        handleShellModalClose={handleShellModalClose}
      />
    )
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
}

const mdtp = {
  notify: notifyAction,
  handleGetLocalGrainsItem: getLocalGrainsItemAsync,
  handleRunAcceptKey: runAcceptKeyAsync,
  handleRunRejectKey: runRejectKeyAsync,
  handleRunDeleteKey: runDeleteKeyAsync,
  ForceSessionAbortInputRole,
}

export default connect(null, mdtp, null)(AgentMinions)
