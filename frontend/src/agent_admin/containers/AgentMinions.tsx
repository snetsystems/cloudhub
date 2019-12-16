// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import yaml from 'js-yaml'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import AgentMinionsTable from 'src/agent_admin/components/AgentMinionsTable'
import AgentMinionsConsole from 'src/agent_admin/components/AgentMinionsConsole'
import AgentMinionsModal from 'src/agent_admin/components/AgentMinionsModal'

// APIs
import {
  getMinionKeyListAll,
  getMinionsIP,
  getMinionsOS,
  getLocalGrainsItem,
  runAcceptKey,
  runRejectKey,
  runDeleteKey,
} from 'src/agent_admin/apis'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  notifyAgentAcceptSucceeded,
  notifyAgentRejectSucceeded,
  notifyAgentDeleteSucceeded,
  notifyAgentLoadedSucceeded,
  notifyAgentLoadFailed,
  notifyAgentAcceptFailed,
  notifyAgentRejectFailed,
  notifyAgentDeleteFailed,
} from 'src/shared/copy/notifications'

// Constants
import {HANDLE_HORIZONTAL} from 'src/shared/constants'

// Types
import {RemoteDataState, Notification, NotificationFunc} from 'src/types'
import {Minion} from 'src/agent_admin/type'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  notify: (message: Notification | NotificationFunc) => void
  isUserAuthorized: boolean
  currentUrl: string
}
interface State {
  MinionsObject: {[x: string]: Minion}
  minionsPageStatus: RemoteDataState
  minionLog: string
  currentUrl: string
  proportions: number[]
  focusedHost: string
}

@ErrorHandling
export class AgentMinions extends PureComponent<Props, State> {
  constructor(props) {
    super(props)
    this.state = {
      minionLog: '<< Empty >>',
      proportions: [0.43, 0.57],
      MinionsObject: {},
      currentUrl: '',
      minionsPageStatus: RemoteDataState.NotStarted,
      focusedHost: '',
    }
  }

  getWheelKeyListAll = async (userDoing: string) => {
    const {notify} = this.props
    try {
      const response = await getMinionKeyListAll()
      const updateMinionsIP = await getMinionsIP(response)
      const newMinions = await getMinionsOS(updateMinionsIP)

      this.setState({
        MinionsObject: newMinions,
        minionsPageStatus: RemoteDataState.Done,
      })

      switch (userDoing) {
        case 'load':
          notify(notifyAgentLoadedSucceeded('Load Success'))
          break
        case 'accept':
          notify(notifyAgentAcceptSucceeded('Accept Success'))
          break
        case 'reject':
          notify(notifyAgentRejectSucceeded('Reject Success'))
          break
        case 'delete':
          notify(notifyAgentDeleteSucceeded('Delete Success'))
          break

        default:
          return
      }
    } catch (e) {
      this.setState({
        minionsPageStatus: RemoteDataState.Done,
      })
      switch (userDoing) {
        case 'load':
          notify(notifyAgentLoadFailed(`${e}`))
          break
        case 'accept':
          notify(notifyAgentAcceptFailed('Accept Failed'))
          break
        case 'reject':
          notify(notifyAgentRejectFailed('Reject Failed'))
          break
        case 'delete':
          notify(notifyAgentDeleteFailed('Delete Failed'))
          break

        default:
          return
      }
    }
  }

  public async componentDidMount() {
    this.getWheelKeyListAll('load')
    this.setState({minionsPageStatus: RemoteDataState.Loading})
  }

  onClickTableRowCall = (host: string) => () => {
    this.setState({
      focusedHost: host,
      minionsPageStatus: RemoteDataState.Loading,
    })
    const getLocalGrainsItemPromise = getLocalGrainsItem(host)
    getLocalGrainsItemPromise.then(pLocalGrainsItemData => {
      this.setState({
        minionLog: yaml.dump(pLocalGrainsItemData.data.return[0][host]),
        minionsPageStatus: RemoteDataState.Done,
      })
    })
  }

  handleWheelKeyCommand = (host: string, cmdstatus: string) => {
    this.setState({minionsPageStatus: RemoteDataState.Loading})
    if (cmdstatus == 'ReJect') {
      const getWheelKeyCommandPromise = runRejectKey(host)

      getWheelKeyCommandPromise.then(pWheelKeyCommandData => {
        this.setState({
          minionLog: yaml.dump(pWheelKeyCommandData.data.return[0]),
        })
        this.getWheelKeyListAll('reject')
      })
    } else if (cmdstatus == 'Accept') {
      const getWheelKeyCommandPromise = runAcceptKey(host)

      getWheelKeyCommandPromise.then(pWheelKeyCommandData => {
        this.setState({
          minionLog: yaml.dump(pWheelKeyCommandData.data.return[0]),
        })
        this.getWheelKeyListAll('accept')
      })
    } else if (cmdstatus == 'Delete') {
      const getWheelKeyCommandPromise = runDeleteKey(host)

      getWheelKeyCommandPromise.then(pWheelKeyCommandData => {
        this.setState({
          minionLog: yaml.dump(pWheelKeyCommandData.data.return[0]),
        })
        this.getWheelKeyListAll('delete')
      })
    }
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
    const {isUserAuthorized} = this.props
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
    const {MinionsObject, minionsPageStatus, focusedHost} = this.state
    return (
      <AgentMinionsTable
        minions={_.values(MinionsObject)}
        minionsPageStatus={minionsPageStatus}
        onClickTableRow={this.onClickTableRowCall}
        onClickModal={this.onClickModalCall}
        handleWheelKeyCommand={this.handleWheelKeyCommand}
        focusedHost={focusedHost}
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
}

export default connect(null, mdtp, null)(AgentMinions)
