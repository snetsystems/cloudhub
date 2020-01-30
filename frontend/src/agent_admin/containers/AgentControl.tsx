// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import {connect} from 'react-redux'
import yaml from 'js-yaml'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import AgentControlTable from 'src/agent_admin/components/AgentControlTable'
import AgentControlConsole from 'src/agent_admin/components/AgentControlConsole'

// APIs
import {
  getMinionKeyListAllAsync,
  runLocalServiceStartTelegraf,
  runLocalServiceStopTelegraf,
  runLocalCpGetDirTelegraf,
  runLocalPkgInstallTelegraf,
} from 'src/agent_admin/apis'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {notifyAgentConnectFailed} from 'src/agent_admin/components/notifications'

// const
import {HANDLE_HORIZONTAL} from 'src/shared/constants'

// Types
import {RemoteDataState, Notification, NotificationFunc} from 'src/types'
import {Minion} from 'src/agent_admin/type'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  notify: (message: Notification | NotificationFunc) => void
  currentUrl: string
  isUserAuthorized: boolean
  saltMasterUrl: string
  saltMasterToken: string
  onLogout: () => void
}

interface State {
  MinionsObject: {[x: string]: Minion}
  Minions: Minion[]
  proportions: number[]
  controlPageStatus: RemoteDataState
  minionLog: string
  isAllCheck: boolean
}

@ErrorHandling
export class AgentControl extends PureComponent<Props, State> {
  constructor(props) {
    super(props)
    this.state = {
      minionLog: '<< Empty >>',
      proportions: [0.43, 0.57],
      MinionsObject: {},
      Minions: [],
      isAllCheck: false,
      controlPageStatus: RemoteDataState.NotStarted,
    }
  }

  getWheelKeyListAll = async () => {
    const hostListObject = await getMinionKeyListAllAsync()

    this.setState({
      Minions: _.values(hostListObject),
      controlPageStatus: RemoteDataState.Done,
      isAllCheck: false,
    })
  }

  public async componentWillMount() {
    const {notify, saltMasterToken} = this.props
    if (saltMasterToken !== null && saltMasterToken !== '') {
      this.getWheelKeyListAll()
      this.setState({controlPageStatus: RemoteDataState.Loading})
    } else {
      this.setState({controlPageStatus: RemoteDataState.Done})
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
        this.setState({controlPageStatus: RemoteDataState.Loading})
      } else {
        this.setState({
          Minions: [],
        })
      }
    }
  }

  public handleAllCheck = (_this: object): void => {
    const {saltMasterToken} = this.props

    if (saltMasterToken !== null && saltMasterToken !== '') {
      const {Minions, isAllCheck} = this.state
      if (isAllCheck === false) {
        Minions.map(m => (m.isCheck = true))
      } else {
        Minions.map(m => (m.isCheck = false))
      }
      this.setState({isAllCheck: !isAllCheck, Minions})
    } else {
      this.setState({controlPageStatus: RemoteDataState.Done})
    }
  }

  public handleMinionCheck = ({_this}): void => {
    const {minions} = _this.props
    const {Minions} = this.state
    const index = Minions.indexOf(minions)

    Minions[index].isCheck
      ? (Minions[index].isCheck = false)
      : (Minions[index].isCheck = true)

    this.setState({
      Minions: [...Minions],
      isAllCheck: false,
    })
  }

  public onClickActionCall = (host: string, isRunning: boolean) => () => {
    if (isRunning === false) {
      const getLocalServiceStartTelegrafPromise = runLocalServiceStartTelegraf(
        host
      )

      this.setState({controlPageStatus: RemoteDataState.Loading})

      getLocalServiceStartTelegrafPromise.then(
        pLocalServiceStartTelegrafData => {
          this.setState({
            minionLog:
              'Service Start' +
              '\n' +
              yaml.dump(pLocalServiceStartTelegrafData.data.return[0]),
          })
          this.getWheelKeyListAll()
        }
      )
    } else {
      const getLocalServiceStopTelegrafPromise = runLocalServiceStopTelegraf(
        host
      )
      this.setState({controlPageStatus: RemoteDataState.Loading})
      getLocalServiceStopTelegrafPromise.then(pLocalServiceStopTelegrafData => {
        this.setState({
          minionLog:
            'Service Stop' +
            '\n' +
            yaml.dump(pLocalServiceStopTelegrafData.data.return[0]),
        })
        this.getWheelKeyListAll()
      })
    }
  }

  public onClickRunCall = () => {
    const {Minions} = this.state
    const host = Minions.filter(m => m.isCheck === true).map(
      checkData => checkData.host
    )

    this.setState({controlPageStatus: RemoteDataState.Loading})
    const getLocalServiceStartTelegrafPromise = runLocalServiceStartTelegraf(
      host
    )

    getLocalServiceStartTelegrafPromise.then(pLocalServiceStartTelegrafData => {
      this.setState({
        minionLog:
          'Service Start' +
          '\n' +
          yaml.dump(pLocalServiceStartTelegrafData.data.return[0]),
      })
      this.getWheelKeyListAll()
    })
  }

  public onClickStopCall = () => {
    const {Minions} = this.state
    const host = Minions.filter(m => m.isCheck === true).map(
      checkData => checkData.host
    )

    this.setState({controlPageStatus: RemoteDataState.Loading})
    const getLocalServiceStopTelegrafPromise = runLocalServiceStopTelegraf(host)

    getLocalServiceStopTelegrafPromise.then(pLocalServiceStopTelegrafData => {
      this.setState({
        minionLog:
          'Service Stop' +
          '\n' +
          yaml.dump(pLocalServiceStopTelegrafData.data.return[0]),
      })

      this.getWheelKeyListAll()
    })
  }

  public onClickInstallCall = () => {
    const {Minions} = this.state

    const host = Minions.filter(m => m.isCheck === true).map(
      checkData => checkData.host
    )

    this.setState({controlPageStatus: RemoteDataState.Loading})

    const getLocalCpGetDirTelegrafPromise = runLocalCpGetDirTelegraf(host)

    getLocalCpGetDirTelegrafPromise.then(pLocalCpGetDirTelegrafData => {
      this.setState({
        minionLog:
          'Dir Telegraf ' +
          '\n' +
          yaml.dump(pLocalCpGetDirTelegrafData.data.return[0]),
      })

      const getLocalPkgInstallTelegrafPromise = runLocalPkgInstallTelegraf(host)

      getLocalPkgInstallTelegrafPromise.then(pLocalPkgInstallTelegrafData => {
        this.setState({
          minionLog:
            this.state.minionLog +
            '\n' +
            'Install Response' +
            '\n' +
            yaml.dump(pLocalPkgInstallTelegrafData.data.return[0]),
        })
      })

      this.getWheelKeyListAll()
    })
  }

  render() {
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
          <div
            className="generic-empty-state"
            style={{backgroundColor: '#292933'}}
          >
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
    const {Minions, controlPageStatus, isAllCheck} = this.state

    return (
      <AgentControlTable
        minions={Minions}
        controlPageStatus={controlPageStatus}
        onClickAction={this.onClickActionCall}
        onClickRun={this.onClickRunCall}
        onClickStop={this.onClickStopCall}
        onClickInstall={this.onClickInstallCall}
        isAllCheck={isAllCheck}
        handleAllCheck={this.handleAllCheck}
        handleMinionCheck={this.handleMinionCheck}
      />
    )
  }

  private renderAgentPageBottom = () => {
    const {minionLog} = this.state
    return <AgentControlConsole res={minionLog} />
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

export default connect(null, mdtp)(AgentControl)
