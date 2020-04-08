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
import {getMinionKeyListAllAsync} from 'src/agent_admin/apis'
import {getRunnerSaltCmdDirectory} from 'src/shared/apis/saltStack'

// SaltStack
import {
  runLocalServiceStartTelegraf,
  runLocalServiceStopTelegraf,
  runLocalPkgInstallTelegraf,
  runLocalGroupAdduser,
} from 'src/shared/apis/saltStack'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {notifyAgentConnectFailed} from 'src/agent_admin/components/notifications'

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
}

interface State {
  MinionsObject: {[x: string]: Minion}
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
      MinionsObject: {},
      Minions: [],
      isAllCheck: false,
      controlPageStatus: RemoteDataState.NotStarted,
      telegrafList: {files: [], isLoading: true},
      chooseMenu: SELECTBOX_TEXT.DEFAULT,
    }
  }

  public getWheelKeyListAll = async () => {
    const {saltMasterUrl, saltMasterToken} = this.props
    const hostListObject = await getMinionKeyListAllAsync(
      saltMasterUrl,
      saltMasterToken
    )

    this.setState({
      Minions: _.values(hostListObject),
      controlPageStatus: RemoteDataState.Done,
      isAllCheck: false,
    })
  }

  public async componentWillMount() {
    const {notify} = this.props
    try {
      this.getWheelKeyListAll()
      this.setState({controlPageStatus: RemoteDataState.Loading})
    } catch (e) {
      this.setState({controlPageStatus: RemoteDataState.Done})
      notify(notifyAgentConnectFailed('Token is not valid.'))
    }
  }

  public componentDidMount() {
    try {
      this.getAgentDirectoryItems()
    } catch (e) {
      console.error(e)
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
    const getDirectoryItems: GetAgentDirectoryInfo = await getRunnerSaltCmdDirectory(
      url,
      token,
      fullDir
    )

    if (
      getDirectoryItems.status === 200 &&
      getDirectoryItems.statusText === 'OK'
    ) {
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

        applications.sort(function(a, b) {
          return b.updateGetTime - a.updateGetTime
        })
      }
    }

    return {
      files: applications,
      isLoading: false,
      status:
        getDirectoryItems.status === 200 &&
        getDirectoryItems.statusText === 'OK'
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
    const {saltMasterUrl, saltMasterToken} = this.props
    if (isRunning === false) {
      const getLocalServiceStartTelegrafPromise = runLocalServiceStartTelegraf(
        saltMasterUrl,
        saltMasterToken,
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
        saltMasterUrl,
        saltMasterToken,
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
    const {saltMasterUrl, saltMasterToken} = this.props
    const {Minions} = this.state
    const host = Minions.filter(m => m.isCheck === true).map(
      checkData => checkData.host
    )

    this.setState({controlPageStatus: RemoteDataState.Loading})
    const getLocalServiceStartTelegrafPromise = runLocalServiceStartTelegraf(
      saltMasterUrl,
      saltMasterToken,
      _.values(host).toString()
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
    const {saltMasterUrl, saltMasterToken} = this.props
    const {Minions} = this.state
    const host = Minions.filter(m => m.isCheck === true).map(
      checkData => checkData.host
    )

    this.setState({controlPageStatus: RemoteDataState.Loading})
    const getLocalServiceStopTelegrafPromise = runLocalServiceStopTelegraf(
      saltMasterUrl,
      saltMasterToken,
      _.values(host).toString()
    )

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
    const {saltMasterUrl, saltMasterToken} = this.props
    const {Minions, chooseMenu} = this.state

    const host = Minions.filter(m => m.isCheck === true).map(
      checkData => checkData.host
    )

    this.setState({controlPageStatus: RemoteDataState.Loading})

    const getLocalPkgInstallTelegrafPromise = runLocalPkgInstallTelegraf(
      saltMasterUrl,
      saltMasterToken,
      _.values(host).toString(),
      chooseMenu
    )

    getLocalPkgInstallTelegrafPromise.then(pLocalPkgInstallTelegrafData => {
      this.setState({
        minionLog:
          'Install Response' +
          '\n' +
          yaml.dump(pLocalPkgInstallTelegrafData.data.return[0]),
      })

      const getLocalGroupAdduserPromise = runLocalGroupAdduser(
        saltMasterUrl,
        saltMasterToken,
        _.values(host).toString()
      )

      getLocalGroupAdduserPromise.then(pLocalGroupAdduserData => {
        this.setState({
          minionLog:
            this.state.minionLog +
            '\n' +
            'Group Add User' +
            '\n' +
            yaml.dump(pLocalGroupAdduserData.data.return[0]),
        })
      })
      this.getWheelKeyListAll()
    })
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
}

export default connect(null, mdtp)(AgentControl)
