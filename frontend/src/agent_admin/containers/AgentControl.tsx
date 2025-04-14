// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import {connect} from 'react-redux'
import yaml from 'js-yaml'
import {AxiosResponse} from 'axios'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import AgentControlTable from 'src/agent_admin/components/AgentControlTable'
import AgentControlConsole from 'src/agent_admin/components/AgentControlConsole'

// Actions
import {
  runLocalServiceStartTelegrafAsync,
  runLocalServiceStopTelegrafAsync,
  runLocalGroupAdduserAsync,
} from 'src/agent_admin/actions'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'

// const
import {HANDLE_HORIZONTAL} from 'src/shared/constants'

// Types
import {RemoteDataState, Notification, NotificationFunc} from 'src/types'
import {Minion, MinionsObject} from 'src/agent_admin/type'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  notify: (message: Notification | NotificationFunc) => void
  currentUrl: string
  isUserAuthorized: boolean
  saltMasterUrl: string
  saltMasterToken: string
  minionsObject: MinionsObject
  minionsStatus: RemoteDataState
  handleTelegrafStatus: (targetMinion: string) => Promise<void>
  handleSetMinionStatus: ({
    minionsStatus,
  }: {
    minionsStatus: RemoteDataState
  }) => void
  runLocalServiceStartTelegraf: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string
  ) => Promise<AxiosResponse>
  runLocalServiceStopTelegraf: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string
  ) => Promise<AxiosResponse>
  runLocalGroupAdduser: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string
  ) => Promise<AxiosResponse>
}

interface State {
  Minions: Minion[]
  proportions: number[]
  controlPageStatus: RemoteDataState
  minionLog: string
  isAllCheck: boolean
}

@ErrorHandling
export class AgentControl extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      minionLog: '<< Empty >>',
      proportions: [0.43, 0.57],
      Minions: [],
      isAllCheck: false,
      controlPageStatus: RemoteDataState.NotStarted,
    }
  }

  public componentWillMount() {
    this.setState({controlPageStatus: this.props.minionsStatus})
  }

  public componentDidMount() {
    const {isUserAuthorized} = this.props

    if (!isUserAuthorized) return

    const minions = _.values(this.props.minionsObject).filter(
      f => f.isSaltRunning !== false
    )

    this.setState({
      Minions: minions,
      controlPageStatus: this.props.minionsStatus,
    })
  }

  public async componentDidUpdate(prevProps: Props) {
    if (prevProps !== this.props) {
      this.setState({
        Minions: _.values(this.props.minionsObject).filter(
          f => f.isSaltRunning !== false
        ),
        controlPageStatus: this.props.minionsStatus,
      })
    }
  }

  public handleAllCheck = (_this: object): void => {
    const {Minions, isAllCheck} = this.state
    if (isAllCheck === false) {
      Minions.map(m => (m.isCheck = true))
    } else {
      Minions.map(m => (m.isCheck = false))
    }
    this.setState({
      isAllCheck: !isAllCheck,
      Minions,
      controlPageStatus: RemoteDataState.Done,
    })
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

  public onClickActionCall = (
    host: string,
    isRunning: boolean
  ) => async (): Promise<void> => {
    const {
      saltMasterUrl,
      saltMasterToken,
      runLocalServiceStartTelegraf,
      runLocalServiceStopTelegraf,
      handleTelegrafStatus,
    } = this.props

    this.setState({controlPageStatus: RemoteDataState.Loading})

    if (isRunning === false) {
      try {
        const {data} = await runLocalServiceStartTelegraf(
          saltMasterUrl,
          saltMasterToken,
          host
        )
        this.setState({
          minionLog: 'Service Start' + '\n' + yaml.dump(data.return[0]),
        })
      } catch (error) {
        console.error(error)
      }
    } else {
      try {
        const {data} = await runLocalServiceStopTelegraf(
          saltMasterUrl,
          saltMasterToken,
          host
        )
        this.setState({
          minionLog: 'Service Stop' + '\n' + yaml.dump(data.return[0]),
          isAllCheck: false,
        })
      } catch (error) {
        console.error(error)
      }
    }
    await handleTelegrafStatus(host)
  }

  public onClickRunCall = async () => {
    const {
      saltMasterUrl,
      saltMasterToken,
      runLocalServiceStartTelegraf,
      handleTelegrafStatus,
    } = this.props
    const {Minions} = this.state

    this.setState({controlPageStatus: RemoteDataState.Loading})

    try {
      const host = Minions.filter(m => m.isCheck === true).map(
        checkData => checkData.host
      )

      const minion = _.values(host).toString()
      const {data} = await runLocalServiceStartTelegraf(
        saltMasterUrl,
        saltMasterToken,
        minion
      )

      this.setState({
        minionLog: 'Service Start' + '\n' + yaml.dump(data.return[0]),
        isAllCheck: false,
      })
      await handleTelegrafStatus(minion)
    } catch (error) {
      console.error(error)
    }
  }

  public onClickStopCall = async () => {
    const {
      saltMasterUrl,
      saltMasterToken,
      runLocalServiceStopTelegraf,
      handleTelegrafStatus,
    } = this.props
    const {Minions} = this.state
    this.setState({controlPageStatus: RemoteDataState.Loading})

    try {
      const host = Minions.filter(m => m.isCheck === true).map(
        checkData => checkData.host
      )
      const minion = _.values(host).toString()
      const {data} = await runLocalServiceStopTelegraf(
        saltMasterUrl,
        saltMasterToken,
        minion
      )

      this.setState({
        minionLog: 'Service Stop' + '\n' + yaml.dump(data.return[0]),
        isAllCheck: false,
      })
      await handleTelegrafStatus(minion)
    } catch (error) {
      console.error(error)
    }
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
  runLocalServiceStartTelegraf: runLocalServiceStartTelegrafAsync,
  runLocalServiceStopTelegraf: runLocalServiceStopTelegrafAsync,
  runLocalGroupAdduser: runLocalGroupAdduserAsync,
}

export default connect(null, mdtp)(AgentControl)
