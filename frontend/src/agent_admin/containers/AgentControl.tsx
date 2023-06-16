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
  runLocalPkgInstallTelegrafAsync,
  runLocalGroupAdduserAsync,
  getRunnerSaltCmdDirectoryAsync,
} from 'src/agent_admin/actions'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'

// const
import {HANDLE_HORIZONTAL} from 'src/shared/constants'
import {
  GET_STATUS,
  SELECTBOX_TEXT,
  NETWORK_ACCESS,
  AGENT_COLLECTOR_DIRECTORY,
} from 'src/agent_admin/constants'

// Types
import {RemoteDataState, Notification, NotificationFunc} from 'src/types'
import {
  Minion,
  GetAgentDirectoryInfo,
  AgentDirFile,
  AgentDirFileInfo,
  MinionsObject,
} from 'src/agent_admin/type'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  notify: (message: Notification | NotificationFunc) => void
  currentUrl: string
  isUserAuthorized: boolean
  saltMasterUrl: string
  saltMasterToken: string
  onLogout: () => void
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
  runLocalPkgInstallTelegraf: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string,
    select: string
  ) => Promise<AxiosResponse>
  runLocalGroupAdduser: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string
  ) => Promise<AxiosResponse>
  getRunnerSaltCmdDirectory: (
    saltMasterUrl: string,
    saltMasterToken: string,
    saltDirectory: string
  ) => Promise<AxiosResponse>
}

interface State {
  Minions: Minion[]
  proportions: number[]
  controlPageStatus: RemoteDataState
  minionLog: string
  isAllCheck: boolean
  telegrafList: AgentDirFile
  chooseMenu: string
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
      telegrafList: {files: [], isLoading: true},
      chooseMenu: SELECTBOX_TEXT.DEFAULT,
    }
  }

  public componentWillMount() {
    this.setState({controlPageStatus: this.props.minionsStatus})
  }

  public componentDidMount() {
    const {isUserAuthorized} = this.props

    if (!isUserAuthorized) return

    const minions = _.values(this.props.minionsObject).filter(
      f => f.isSaltRuning !== false
    )

    this.setState({
      Minions: minions,
      controlPageStatus: this.props.minionsStatus,
    })

    try {
      this.getAgentDirectoryItems()
    } catch (e) {
      console.error(e)
    }
  }

  public async componentDidUpdate(prevProps: Props) {
    if (prevProps !== this.props) {
      this.setState({
        Minions: _.values(this.props.minionsObject).filter(
          f => f.isSaltRuning !== false
        ),
        controlPageStatus: this.props.minionsStatus,
      })
    }
  }

  public getAgentDirectoryItems = async () => {
    const {saltMasterUrl, saltMasterToken} = this.props

    const getTelegrafList: AgentDirFile = await this.getRunnerSaltCmdDirectoryData(
      saltMasterUrl,
      saltMasterToken,
      AGENT_COLLECTOR_DIRECTORY.FULL_DIR
    )

    this.setState({
      telegrafList: getTelegrafList,
    })
  }

  public getRunnerSaltCmdDirectoryData = async (
    url: string,
    token: string,
    fullDir: string
  ): Promise<AgentDirFile> => {
    let applications: AgentDirFileInfo[] = []
    const getDirectoryItems: GetAgentDirectoryInfo = await this.props.getRunnerSaltCmdDirectory(
      url,
      token,
      fullDir
    )

    if (getDirectoryItems.status === 200) {
      const getData: string = getDirectoryItems.data.return[0]
      if (
        getData.length === 0 ||
        getData.indexOf('No such file or directory') > -1
      ) {
        applications = [
          this.generatorFileInfo({
            time: '',
            item: GET_STATUS.EMPTY,
            fullDir,
          }),
        ]
      } else {
        if (getData.indexOf('\n') > -1) {
          applications = getData.split('\n').map((item: string) => {
            const time: string = item.substring(0, item.indexOf(' '))
            return this.generatorFileInfo({time, item, fullDir})
          })
        } else {
          const time: string = getData.substring(0, getData.indexOf(' '))
          applications = [
            this.generatorFileInfo({time, item: getData, fullDir}),
          ]
        }

        applications.sort(function (a, b) {
          return b.updateGetTime - a.updateGetTime
        })
      }
    }

    return {
      files: applications,
      isLoading: false,
      status:
        getDirectoryItems.status === 200
          ? NETWORK_ACCESS.SUCCESS
          : getDirectoryItems,
    }
  }

  public generatorFileInfo = ({
    time,
    item,
    fullDir,
  }: {
    time: string
    item: string
    fullDir: string
  }): AgentDirFileInfo => {
    return {
      updateTime: time,
      updateGetTime: new Date(time).getTime(),
      application: item.replace(time, '').trim(),
      applicationFullName: item,
      fullPathDirectory: fullDir,
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

  public onClickInstallCall = async () => {
    const {
      saltMasterUrl,
      saltMasterToken,
      runLocalPkgInstallTelegraf,
      runLocalGroupAdduser,
      handleTelegrafStatus,
    } = this.props
    const {Minions, chooseMenu} = this.state
    this.setState({controlPageStatus: RemoteDataState.Loading})

    try {
      const host = Minions.filter(m => m.isCheck === true).map(
        checkData => checkData.host
      )
      const minion = _.values(host).toString()
      const getLocalPkgInstallTelegrafPromise = await runLocalPkgInstallTelegraf(
        saltMasterUrl,
        saltMasterToken,
        minion,
        chooseMenu
      )

      this.setState({
        minionLog:
          'Install Response' +
          '\n' +
          yaml.dump(getLocalPkgInstallTelegrafPromise.data.return[0]),
      })

      const getLocalGroupAdduserPromise = await runLocalGroupAdduser(
        saltMasterUrl,
        saltMasterToken,
        minion
      )

      this.setState({
        minionLog:
          this.state.minionLog +
          '\n' +
          'Group Add User' +
          '\n' +
          yaml.dump(getLocalGroupAdduserPromise.data.return[0]),
        isAllCheck: false,
      })
      await handleTelegrafStatus(minion)
    } catch (error) {
      console.error(error)
    }
  }

  public handleOnChoose = ({selectItem}: {selectItem: string}): void => {
    if (selectItem !== GET_STATUS.EMPTY) {
      this.setState({
        chooseMenu: selectItem,
      })
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
    const {
      Minions,
      controlPageStatus,
      isAllCheck,
      telegrafList,
      chooseMenu,
    } = this.state

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
        telegrafList={telegrafList}
        handleOnChoose={this.handleOnChoose}
        chooseMenu={chooseMenu}
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
  runLocalPkgInstallTelegraf: runLocalPkgInstallTelegrafAsync,
  runLocalGroupAdduser: runLocalGroupAdduserAsync,
  getRunnerSaltCmdDirectory: getRunnerSaltCmdDirectoryAsync,
}

export default connect(null, mdtp)(AgentControl)
