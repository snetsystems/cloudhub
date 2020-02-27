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
} from 'src/agent_admin/apis'
// SaltStack
import {
  getLocalGrainsItem,
  runAcceptKey,
  runRejectKey,
  runDeleteKey,
} from 'src/shared/apis/saltStack'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {notifyAgentConnectFailed} from 'src/agent_admin/components/notifications'

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
  saltMasterUrl: string
  saltMasterToken: string
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

  getWheelKeyListAll = async () => {
    const {notify, saltMasterUrl, saltMasterToken} = this.props
    try {
      const response = await getMinionKeyListAll(saltMasterUrl, saltMasterToken)
      const updateMinionsIP = await getMinionsIP(
        saltMasterUrl,
        saltMasterToken,
        response
      )
      const newMinions = await getMinionsOS(
        saltMasterUrl,
        saltMasterToken,
        updateMinionsIP
      )

      this.setState({
        MinionsObject: newMinions,
        minionsPageStatus: RemoteDataState.Done,
      })
    } catch (e) {
      this.setState({
        minionsPageStatus: RemoteDataState.Done,
      })
      notify(notifyAgentConnectFailed('Token is not valid.'))
    }
  }

  public async componentWillMount() {
    const {notify, saltMasterToken} = this.props
    if (saltMasterToken !== null && saltMasterToken !== '') {
      this.getWheelKeyListAll()
      this.setState({minionsPageStatus: RemoteDataState.Loading})
    } else {
      this.setState({minionsPageStatus: RemoteDataState.Done})
      notify(notifyAgentConnectFailed('Token is not valid.'))
    }
  }

  public async componentDidUpdate(nextProps) {
    if (nextProps.saltMasterToken !== this.props.saltMasterToken) {
      if (
        this.props.saltMasterToken !== '' &&
        this.props.saltMasterToken !== null
      ) {
        this.getWheelKeyListAll()
        this.setState({minionsPageStatus: RemoteDataState.Loading})
      } else if (
        this.props.saltMasterToken === null ||
        this.props.saltMasterToken === ''
      ) {
        this.setState({MinionsObject: null})
      }
    }
  }

  onClickTableRowCall = (host: string) => () => {
    const {saltMasterUrl, saltMasterToken} = this.props
    const {MinionsObject} = this.state
    this.setState({
      focusedHost: host,
      minionsPageStatus: RemoteDataState.Loading,
    })

    if (
      MinionsObject[host].os.length > 0 &&
      MinionsObject[host].ip.length > 0
    ) {
      const getLocalGrainsItemPromise = getLocalGrainsItem(
        saltMasterUrl,
        saltMasterToken,
        host
      )
      getLocalGrainsItemPromise.then(pLocalGrainsItemData => {
        this.setState({
          minionLog: yaml.dump(pLocalGrainsItemData.data.return[0][host]),
          minionsPageStatus: RemoteDataState.Done,
        })
      })
    } else {
      this.setState({
        minionLog: '',
        minionsPageStatus: RemoteDataState.Done,
      })
    }
  }

  handleWheelKeyCommand = (host: string, cmdstatus: string) => {
    const {saltMasterUrl, saltMasterToken} = this.props
    this.setState({minionsPageStatus: RemoteDataState.Loading})
    if (cmdstatus == 'ReJect') {
      const getWheelKeyCommandPromise = runRejectKey(
        saltMasterUrl,
        saltMasterToken,
        host
      )

      getWheelKeyCommandPromise.then(pWheelKeyCommandData => {
        this.setState({
          minionLog: yaml.dump(pWheelKeyCommandData.data.return[0]),
        })
        this.getWheelKeyListAll()
      })
    } else if (cmdstatus == 'Accept') {
      const getWheelKeyCommandPromise = runAcceptKey(
        saltMasterUrl,
        saltMasterToken,
        host
      )

      getWheelKeyCommandPromise.then(pWheelKeyCommandData => {
        this.setState({
          minionLog: yaml.dump(pWheelKeyCommandData.data.return[0]),
        })
        this.getWheelKeyListAll()
      })
    } else if (cmdstatus == 'Delete') {
      const getWheelKeyCommandPromise = runDeleteKey(
        saltMasterUrl,
        saltMasterToken,
        host
      )

      getWheelKeyCommandPromise.then(pWheelKeyCommandData => {
        this.setState({
          minionLog: yaml.dump(pWheelKeyCommandData.data.return[0]),
        })
        this.getWheelKeyListAll()
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
