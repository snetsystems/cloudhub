// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
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

// const
import {HANDLE_HORIZONTAL} from 'src/shared/constants'

// Types
import {RemoteDataState} from 'src/types'
import {Minion} from 'src/agent_admin/type'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  currentUrl: string
  isUserAuthorized: boolean
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
class AgentControl extends PureComponent<Props, State> {
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

  public async componentDidMount() {
    this.getWheelKeyListAll()
    this.setState({controlPageStatus: RemoteDataState.Loading})
  }

  public handleAllCheck = (_this: object): void => {
    const {Minions, isAllCheck} = this.state
    if (isAllCheck === false) {
      Minions.map(m => (m.isCheck = true))
    } else {
      Minions.map(m => (m.isCheck = false))
    }
    this.setState({isAllCheck: !isAllCheck, Minions})
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

  public notSelectMinion = ({_this}) => {
    console.log(_this.props.minions)
    alert('NotSelectMinion')
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

export default AgentControl
