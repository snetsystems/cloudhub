// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import memoize from 'memoize-one'
import * as TOML from '@iarna/toml'
import {EditorChange} from 'codemirror'
import {AxiosResponse} from 'axios'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import AgentConfigurationTable from 'src/agent_admin/components/AgentConfigurationTable'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import AgentCodeEditor from 'src/agent_admin/components/AgentCodeEditor'
import AgentToolbarFunction from 'src/agent_admin/components/AgentToolbarFunction'
import AgentConfigModal from 'src/agent_admin/components/AgentConfigModal'
import AgentConfigConsoleModal from 'src/agent_admin/components/AgentConfigConsoleModal'
import PageSpinner from 'src/shared/components/PageSpinner'
import Dropdown from 'src/shared/components/Dropdown'
import SearchBar from 'src/hosts/components/SearchBar'
import AgentConfigPlugInModal from 'src/agent_admin/components/AgentConfigPlugInModal'

// Middleware
import {
  setLocalStorage,
  getLocalStorage,
  verifyLocalStorage,
} from 'src/shared/middleware/localStorage'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// Actions
import {
  runLocalServiceStartTelegrafAsync,
  runLocalServiceStopTelegrafAsync,
  runLocalGroupAdduserAsync,
  getLocalFileReadAsync,
  getLocalFileWriteAsync,
  runLocalServiceReStartTelegrafAsync,
  runLocalServiceTestTelegrafAsync,
  getRunnerSaltCmdTelegrafAsync,
  getRunnerSaltCmdTelegrafPluginAsync,
} from 'src/agent_admin/actions'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  notifyAgentApplySucceeded,
  notifyAgentConfigWrong,
  notifyAgentConfigNoMatchGroup,
  notifyAgentConfigDBNameWrong,
  notifyAgentConfigHostNameWrong,
  notifyAgentConfigHostNameChanged,
} from 'src/shared/copy/notifications'

// Constants
import {HANDLE_HORIZONTAL, HANDLE_VERTICAL} from 'src/shared/constants'
import {GET_STATUS} from 'src/agent_admin/constants'

// Types
import {
  Me,
  Organization,
  RemoteDataState,
  Notification,
  NotificationFunc,
} from 'src/types'
import {MinionsObject, SortDirection} from 'src/agent_admin/type'

interface Props {
  notify: (message: Notification | NotificationFunc) => void
  me: Me
  organizations: Organization[]
  currentUrl: string
  isUserAuthorized: boolean
  saltMasterUrl: string
  saltMasterToken: string
  minionsObject: MinionsObject
  minionsStatus: RemoteDataState
  handleGetMinionKeyListAll: () => void
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
  getLocalFileRead: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string
  ) => Promise<AxiosResponse>
  getLocalFileWrite: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string,
    script: string
  ) => Promise<AxiosResponse>
  runLocalServiceReStartTelegraf: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string
  ) => Promise<AxiosResponse>
  getRunnerSaltCmdTelegraf: (
    saltMasterUrl: string,
    saltMasterToken: string,
    measurements: string
  ) => Promise<AxiosResponse>
  getRunnerSaltCmdTelegrafPlugin: (
    saltMasterUrl: string,
    saltMasterToken: string
  ) => Promise<AxiosResponse>
  runLocalServiceTestTelegraf: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string
  ) => Promise<AxiosResponse>
}

interface State {
  configPageStatus: RemoteDataState
  measurementsStatus: RemoteDataState
  collectorConfigStatus: RemoteDataState
  horizontalProportions: number[]
  verticalProportions: number[]
  description: string
  focusedMeasure: string
  configScript: string
  responseMessage: string
  focusedHost: string
  isInitEditor: boolean
  isApplyBtnDisabled: boolean
  isGetLocalStorage: boolean
  isModalVisible: boolean
  isCollectorInstalled: boolean
  isModalCall: boolean
  selectedOrg: string
  inputPluginList: Plugin[]
  outputPluginList: Plugin[]
  searchTerm: string
  isConsoleModalVisible: boolean
  isConsoleModalMessage: string
  isPluginModalVisible: boolean
}
interface Plugin {
  name: string
  isActivity: boolean
}
interface LocalStorageAgentConfig {
  focusedHost?: string
  focusedHostIp?: string
  configScript?: string
  isApplyBtnDisabled?: boolean
}

@ErrorHandling
export class AgentConfiguration extends PureComponent<Props, State> {
  private DEFAULT_DROPDOWN_TEXT = 'Select Database(= Group)'

  constructor(props: Props) {
    super(props)
    this.state = {
      configPageStatus: RemoteDataState.NotStarted,
      measurementsStatus: RemoteDataState.NotStarted,
      collectorConfigStatus: RemoteDataState.NotStarted,
      horizontalProportions: [0.43, 0.57],
      verticalProportions: [0.3, 0.7],
      description: '',
      focusedMeasure: '',
      configScript: '',
      responseMessage: '',
      focusedHost: '',
      isInitEditor: true,
      isApplyBtnDisabled: true,
      isGetLocalStorage: false,
      isModalVisible: false,
      isCollectorInstalled: false,
      isModalCall: false,
      selectedOrg: this.DEFAULT_DROPDOWN_TEXT,
      inputPluginList: [],
      outputPluginList: [],
      searchTerm: '',
      isConsoleModalVisible: false,
      isConsoleModalMessage: '',
      isPluginModalVisible: false,
    }
  }

  public componentWillMount() {
    verifyLocalStorage(getLocalStorage, setLocalStorage, 'AgentConfigPage', {
      focusedHost: '',
      focusedHostIp: '',
      configScript: '',
      isApplyBtnDisabled: true,
    })

    this.setState({configPageStatus: this.props.minionsStatus})
  }

  public componentDidMount() {
    const {minionsObject} = this.props
    let {
      isModalCall,
      isModalVisible,
      isGetLocalStorage,
      isCollectorInstalled,
      isConsoleModalVisible,
    } = this.state

    const checkData = this.checkData({
      isModalCall,
      isModalVisible,
      isGetLocalStorage,
      isCollectorInstalled,
      minionsObject,
      isConsoleModalVisible,
    })

    this.getTelegrafPlugin()

    this.setState({
      isModalCall: checkData.isModalCall,
      isModalVisible: checkData.isModalVisible,
      isConsoleModalVisible: checkData.isConsoleModalVisible,
      isGetLocalStorage: checkData.isGetLocalStorage,
      isCollectorInstalled: checkData.isCollectorInstalled,
      configPageStatus: this.props.minionsStatus,
      measurementsStatus: RemoteDataState.Loading,
    })
  }

  public componentDidUpdate(prevProps: Props) {
    if (
      prevProps.minionsObject !== this.props.minionsObject ||
      prevProps.minionsStatus !== this.props.minionsStatus
    ) {
      const {minionsObject} = this.props
      let {
        isModalCall,
        isModalVisible,
        isGetLocalStorage,
        isConsoleModalVisible,
      } = this.state

      const checkData = this.checkData({
        minionsObject,
        isModalCall,
        isModalVisible,
        isGetLocalStorage,
        isConsoleModalVisible,
      })

      this.setState({
        isModalCall: checkData.isModalCall,
        isModalVisible: checkData.isModalVisible,
        isConsoleModalVisible: checkData.isConsoleModalVisible,
        isGetLocalStorage: checkData.isGetLocalStorage,
        isCollectorInstalled: checkData.isCollectorInstalled,
        configPageStatus: this.props.minionsStatus,
        collectorConfigStatus: RemoteDataState.Done,
      })
    }
  }

  public componentWillUnmount() {
    const {focusedHost, configScript, isApplyBtnDisabled} = this.state

    setLocalStorage('AgentConfigPage', {
      focusedHost: isApplyBtnDisabled ? '' : focusedHost,
      configScript: isApplyBtnDisabled ? '' : configScript,
      isApplyBtnDisabled,
    })
  }

  public getTelegrafPlugin = async () => {
    const {
      saltMasterUrl,
      saltMasterToken,
      getRunnerSaltCmdTelegrafPlugin,
    } = this.props

    const telegrafPlugin = await getRunnerSaltCmdTelegrafPlugin(
      saltMasterUrl,
      saltMasterToken
    )

    const inputPlugin = _.get(telegrafPlugin, 'return')[0]
      .replace(/ /g, '')
      .split('\n')
    const outputPlugin = _.get(telegrafPlugin, 'return')[1]
      .replace(/ /g, '')
      .split('\n')

    inputPlugin.shift()
    outputPlugin.shift()

    const inputPluginList = _.map(inputPlugin, input => ({
      name: input,
      isActivity: false,
    }))
    const outputPluginList = _.map(outputPlugin, output => ({
      name: output,
      isActivity: false,
    }))

    this.setState({
      inputPluginList,
      outputPluginList,
      measurementsStatus: RemoteDataState.Done,
    })
  }

  public onClickTableRowCall = async (host: string) => {
    if (this.state.focusedHost === host) return
    const {
      notify,
      saltMasterUrl,
      saltMasterToken,
      getLocalFileRead,
    } = this.props

    this.setState({
      configPageStatus: RemoteDataState.Loading,
      collectorConfigStatus: RemoteDataState.Loading,
      focusedHost: host,
      isInitEditor: true,
      isGetLocalStorage: false,
    })

    const getLocalFileReadPromise = getLocalFileRead(
      saltMasterUrl,
      saltMasterToken,
      host
    )

    getLocalFileReadPromise
      .then(({data}) => {
        const hostData = data.return[0][host]
        const hostLocalFileReadData = hostData.substring(
          0,
          hostData.lastIndexOf('\n')
        )
        const configObj = TOML.parse(hostLocalFileReadData)
        const agent: any = _.get(configObj, 'agent')

        let isChanged = false

        if (agent.hostname !== host) {
          notify(notifyAgentConfigHostNameChanged(agent.hostname, host))
          _.set(agent, 'hostname', host)
          isChanged = true
        }

        this.setState({
          configScript: TOML.stringify(configObj),
          isGetLocalStorage: isChanged,
          isApplyBtnDisabled: isChanged ? !isChanged : true,
          collectorConfigStatus: RemoteDataState.Done,
          configPageStatus: RemoteDataState.Done,
          selectedOrg: this.DEFAULT_DROPDOWN_TEXT,
        })
      })
      .catch(error => {
        console.error(error)
      })
  }

  public onClickActionCall = async (host: string, isRunning: boolean) => {
    const {
      saltMasterUrl,
      saltMasterToken,
      runLocalServiceStartTelegraf,
      runLocalServiceStopTelegraf,
      handleGetMinionKeyListAll,
    } = this.props

    this.setState({
      configPageStatus: RemoteDataState.Loading,
    })

    isRunning
      ? await runLocalServiceStopTelegraf(saltMasterUrl, saltMasterToken, host)
      : await runLocalServiceStartTelegraf(saltMasterUrl, saltMasterToken, host)

    handleGetMinionKeyListAll()
  }

  public onClickApplyCall = () => {
    const {
      notify,
      saltMasterUrl,
      saltMasterToken,
      organizations,
      me,
      getLocalFileWrite,
      runLocalServiceReStartTelegraf,
      minionsObject,
      handleGetMinionKeyListAll,
    } = this.props
    const {focusedHost, configScript} = this.state
    let {
      isModalCall,
      isApplyBtnDisabled,
      isGetLocalStorage,
      responseMessage,
    } = this.state

    let isCheckDone = true
    try {
      if (!configScript) return

      const configObj = TOML.parse(configScript)
      const influxdbs: any = _.get(configObj, 'outputs.influxdb')
      const agent: any = _.get(configObj, 'agent')

      influxdbs.forEach((db: any) => {
        if (me.superAdmin) {
          const idx = organizations.findIndex(org => org.name === db.database)

          if (idx < 0) {
            notify(notifyAgentConfigNoMatchGroup(db.database))
            isCheckDone = false
            return
          }
        } else {
          if (db.database !== me.currentOrganization.name) {
            notify(notifyAgentConfigDBNameWrong(me.currentOrganization.name))
            isCheckDone = false
            return
          }
        }

        if (agent.hostname !== focusedHost) {
          notify(notifyAgentConfigHostNameWrong(focusedHost))
          isCheckDone = false
          return
        }
      })
    } catch (error) {
      notify(notifyAgentConfigWrong(error))
      return
    }

    if (!isCheckDone) return

    this.setState({
      configPageStatus: RemoteDataState.Loading,
      collectorConfigStatus: RemoteDataState.Loading,
    })

    const getLocalFileWritePromise = getLocalFileWrite(
      saltMasterUrl,
      saltMasterToken,
      focusedHost,
      configScript
    )

    getLocalFileWritePromise
      .then(({data}): void => {
        isApplyBtnDisabled = true
        isGetLocalStorage = false
        responseMessage = data.return[0][focusedHost]

        const getLocalServiceReStartTelegrafPromise = runLocalServiceReStartTelegraf(
          saltMasterUrl,
          saltMasterToken,
          focusedHost
        )

        getLocalServiceReStartTelegrafPromise
          .then(() => {
            const checkData = this.checkData({
              isModalCall,
              isApplyBtnDisabled,
              isGetLocalStorage,
              minionsObject,
            })

            this.setState({
              isModalCall: checkData.isModalCall,
              isGetLocalStorage: checkData.isGetLocalStorage,
              isCollectorInstalled: checkData.isCollectorInstalled,
              isApplyBtnDisabled: checkData.isApplyBtnDisabled,
              responseMessage,
              configPageStatus: RemoteDataState.Done,
              collectorConfigStatus: RemoteDataState.Done,
              measurementsStatus: RemoteDataState.Done,
            })

            handleGetMinionKeyListAll()
            notify(notifyAgentApplySucceeded('is applied'))
          })
          .catch(e => {
            console.error(e)
          })
      })
      .catch(e => {
        console.error(e)
      })
  }

  public onClickTestCall = () => {
    const {
      notify,
      saltMasterUrl,
      saltMasterToken,
      organizations,
      me,
      getLocalFileWrite,
      runLocalServiceTestTelegraf,
      minionsObject,
      handleGetMinionKeyListAll,
    } = this.props
    const {focusedHost, configScript} = this.state
    let {
      isModalCall,
      isApplyBtnDisabled,
      isGetLocalStorage,
      responseMessage,
      isConsoleModalVisible,
    } = this.state

    let isCheckDone = true
    try {
      if (!configScript) return

      const configObj = TOML.parse(configScript)
      const influxdbs: any = _.get(configObj, 'outputs.influxdb')
      const agent: any = _.get(configObj, 'agent')

      influxdbs.forEach((db: any) => {
        if (me.superAdmin) {
          const idx = organizations.findIndex(org => org.name === db.database)

          if (idx < 0) {
            notify(notifyAgentConfigNoMatchGroup(db.database))
            isCheckDone = false
            return
          }
        } else {
          if (db.database !== me.currentOrganization.name) {
            notify(notifyAgentConfigDBNameWrong(me.currentOrganization.name))
            isCheckDone = false
            return
          }
        }

        if (agent.hostname !== focusedHost) {
          notify(notifyAgentConfigHostNameWrong(focusedHost))
          isCheckDone = false
          return
        }
      })
    } catch (error) {
      notify(notifyAgentConfigWrong(error))
      return
    }

    if (!isCheckDone) return

    this.setState({
      configPageStatus: RemoteDataState.Loading,
      collectorConfigStatus: RemoteDataState.Loading,
      isConsoleModalMessage: '',
    })

    const getLocalFileWritePromise = getLocalFileWrite(
      saltMasterUrl,
      saltMasterToken,
      focusedHost,
      configScript
    )

    getLocalFileWritePromise
      .then(({data}): void => {
        isApplyBtnDisabled = true
        isGetLocalStorage = false
        responseMessage = data.return[0][focusedHost]

        const getLocalServiceTestTelegrafPromise = runLocalServiceTestTelegraf(
          saltMasterUrl,
          saltMasterToken,
          focusedHost
        )

        getLocalServiceTestTelegrafPromise
          .then((data): void => {
            const checkData = this.checkData({
              isModalCall,
              isApplyBtnDisabled,
              isGetLocalStorage,
              minionsObject,
              isConsoleModalVisible,
            })

            this.setState({
              isModalCall: checkData.isModalCall,
              isGetLocalStorage: checkData.isGetLocalStorage,
              isCollectorInstalled: checkData.isCollectorInstalled,
              responseMessage,
              configPageStatus: RemoteDataState.Done,
              collectorConfigStatus: RemoteDataState.Done,
              measurementsStatus: RemoteDataState.Done,
              isConsoleModalVisible: true,
              isConsoleModalMessage: data['return'][0][focusedHost],
            })

            handleGetMinionKeyListAll()
          })
          .catch(e => {
            console.error(e)
          })
      })
      .catch(e => {
        console.error(e)
      })
  }

  public getConfigInfo = (answer: boolean) => {
    const {
      configScript,
      focusedHost,
      isApplyBtnDisabled,
    }: LocalStorageAgentConfig = getLocalStorage('AgentConfigPage')

    if (answer) {
      this.setState({
        configScript,
        focusedHost,
        isApplyBtnDisabled,
        isInitEditor: false,
      })
    } else {
      setLocalStorage('AgentConfigPage', {
        focusedHost: '',
        focusedHostIp: '',
        configScript: '',
        isApplyBtnDisabled: true,
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
              onResize={this.horizontalHandleResize}
            />
            <AgentConfigModal
              visible={this.state.isModalVisible}
              headingTitle={'Confirm'}
              message={'Do you want to import previous changes?'}
              cancelText={'No'}
              confirmText={'Yes'}
              onCancel={() => {
                this.setState({isModalVisible: !this.state.isModalVisible})
                this.getConfigInfo(false)
              }}
              onConfirm={() => {
                this.setState({isModalVisible: !this.state.isModalVisible})
                this.getConfigInfo(true)
              }}
            />
            <div className="agent-console">
              <AgentConfigConsoleModal
                visible={this.state.isConsoleModalVisible}
                headingTitle={'Console'}
                message={this.state.isConsoleModalMessage}
                cancelText={'Close'}
                onClose={() => {
                  this.setState({
                    isConsoleModalVisible: !this.state.isConsoleModalVisible,
                  })
                }}
              />
            </div>
            <AgentConfigPlugInModal
              isVisible={this.state.isPluginModalVisible}
              onClose={() => {
                this.setState({
                  isPluginModalVisible: !this.state.isPluginModalVisible,
                })
                this.handlePluginClose()
              }}
              plugin={this.state.focusedMeasure}
              description={this.state.description}
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

  private checkData = ({
    minionsObject,
    isModalCall,
    isModalVisible,
    isGetLocalStorage,
    isCollectorInstalled,
    isApplyBtnDisabled,
    isConsoleModalVisible,
  }: {
    minionsObject?: Props['minionsObject']
    isModalCall?: State['isModalCall']
    isModalVisible?: State['isModalVisible']
    isGetLocalStorage?: State['isGetLocalStorage']
    isCollectorInstalled?: State['isCollectorInstalled']
    isApplyBtnDisabled?: State['isApplyBtnDisabled']
    isConsoleModalVisible?: State['isConsoleModalVisible']
  }): {
    minionsObject?: Props['minionsObject']
    isModalCall?: State['isModalCall']
    isModalVisible?: State['isModalVisible']
    isGetLocalStorage?: State['isGetLocalStorage']
    isCollectorInstalled?: State['isCollectorInstalled']
    isApplyBtnDisabled?: State['isApplyBtnDisabled']
    isConsoleModalVisible?: State['isConsoleModalVisible']
  } => {
    const CollectorInstalledMinions = _.filter(minionsObject, [
      'isInstall',
      true,
    ])

    isCollectorInstalled = Boolean(CollectorInstalledMinions.length)

    if (!isModalCall) {
      const {
        isApplyBtnDisabled,
        focusedHost,
      }: LocalStorageAgentConfig = getLocalStorage('AgentConfigPage')

      const getHostCompare = _.find(CollectorInstalledMinions, [
        'host',
        focusedHost,
      ])

      if (!isApplyBtnDisabled && Boolean(getHostCompare)) {
        isModalCall = true
        isModalVisible = true
        isGetLocalStorage = true
      }
    }

    return {
      minionsObject,
      isModalCall,
      isModalVisible,
      isGetLocalStorage,
      isCollectorInstalled,
      isApplyBtnDisabled,
      isConsoleModalVisible,
    }
  }

  private get MeasurementsContent() {
    if (this.state.measurementsStatus === RemoteDataState.Error)
      return this.ErrorState

    return this.MeasurementsContentBody
  }

  private get CollectorConfigContent() {
    if (this.state.collectorConfigStatus === RemoteDataState.Error)
      return this.ErrorState

    return this.CollectorConfigBody
  }

  private get LoadingState(): JSX.Element {
    return (
      <div
        style={{
          position: 'absolute',
          zIndex: 7,
          backgroundColor: 'rgba(0,0,0,0.5)',
          width: '100%',
          height: '100%',
        }}
      >
        <PageSpinner />
      </div>
    )
  }

  private get ErrorState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>There was a problem loading data</h4>
      </div>
    )
  }

  private handleFocusedPlugin = async ({
    _thisProps,
  }: {
    _thisProps: {name: string; idx: number; inoutkind: string}
  }) => {
    const {
      saltMasterUrl,
      saltMasterToken,
      getRunnerSaltCmdTelegraf,
    } = this.props
    const {inputPluginList, outputPluginList, searchTerm} = this.state
    const {idx, name, inoutkind} = _thisProps

    this.setState({
      isPluginModalVisible: true,
      focusedMeasure: name,
      description: '',
    })

    const sortedInputPlugin = this.getSortedPlugin(
      inputPluginList,
      searchTerm,
      'name',
      SortDirection.ASC
    )

    const sortedOutputPlugin = this.getSortedPlugin(
      outputPluginList,
      searchTerm,
      'name',
      SortDirection.ASC
    )

    const mapInputPlugin = sortedInputPlugin.map(m => {
      m.isActivity = false
      return m
    })

    const mapOutputPlugin = sortedOutputPlugin.map(m => {
      m.isActivity = false
      return m
    })

    if (inoutkind === 'IN') {
      mapInputPlugin[idx].isActivity === false
        ? (mapInputPlugin[idx].isActivity = true)
        : (mapInputPlugin[idx].isActivity = false)
    } else {
      mapOutputPlugin[idx].isActivity === false
        ? (mapOutputPlugin[idx].isActivity = true)
        : (mapOutputPlugin[idx].isActivity = false)
    }
    try {
      const {data} = await getRunnerSaltCmdTelegraf(
        saltMasterUrl,
        saltMasterToken,
        name
      )
      this.setState({
        inputPluginList: [...mapInputPlugin],
        outputPluginList: [...mapOutputPlugin],
        description: data.return[0],
      })
    } catch (error) {
      console.error(error)
    }
  }

  private handlePluginClose = (): void => {
    const {inputPluginList, outputPluginList, searchTerm} = this.state

    const sortedInputPlugin = this.getSortedPlugin(
      inputPluginList,
      searchTerm,
      'name',
      SortDirection.ASC
    )

    const sortedOutputPlugin = this.getSortedPlugin(
      outputPluginList,
      searchTerm,
      'name',
      SortDirection.ASC
    )

    const mapInputPlugin = sortedInputPlugin.map(m => {
      m.isActivity = false
      return m
    })

    const mapOutputPlugin = sortedOutputPlugin.map(m => {
      m.isActivity = false
      return m
    })

    this.setState({
      inputPluginList: [...mapInputPlugin],
      outputPluginList: [...mapOutputPlugin],
      focusedMeasure: '',
    })
  }

  private horizontalHandleResize = (horizontalProportions: number[]): void => {
    this.setState({horizontalProportions})
  }

  private verticalHandleResize = (verticalProportions: number[]): void => {
    this.setState({verticalProportions})
  }

  private onBeforeChangeScript = (
    __: CodeMirror.Editor,
    ___: EditorChange,
    script: string
  ) => {
    this.setState({
      isInitEditor: false,
      isApplyBtnDisabled: false,
      configScript: script,
    })
  }

  private onChangeScript = (
    _: CodeMirror.Editor,
    __: EditorChange,
    ___: string
  ) => {
    const {isInitEditor, isGetLocalStorage} = this.state
    if (isInitEditor) {
      if (isGetLocalStorage) {
        this.setState({
          isApplyBtnDisabled: false,
          isInitEditor: false,
        })
      } else {
        this.setState({
          isApplyBtnDisabled: true,
          isInitEditor: false,
        })
      }
    } else {
      this.setState({
        isApplyBtnDisabled: false,
      })
    }
  }

  private renderAgentPageTop = () => {
    const {configPageStatus, focusedHost, isCollectorInstalled} = this.state
    const {minionsObject} = this.props

    return (
      <AgentConfigurationTable
        minions={_.values(minionsObject)}
        configPageStatus={configPageStatus}
        onClickTableRow={this.onClickTableRowCall}
        onClickAction={this.onClickActionCall}
        focusedHost={focusedHost}
        isCollectorInstalled={isCollectorInstalled}
      />
    )
  }

  private renderAgentPageBottom = () => {
    return (
      <Threesizer
        orientation={HANDLE_VERTICAL}
        divisions={this.verticalDivisions}
        onResize={this.verticalHandleResize}
      />
    )
  }

  private Measurements() {
    const {measurementsStatus} = this.state
    return (
      <div className="panel">
        {measurementsStatus === RemoteDataState.Loading
          ? this.LoadingState
          : null}
        <div className="panel-heading">
          <h2
            className="panel-title use-user-select"
            style={{
              width: '100%',
            }}
          >
            Plugins
          </h2>
          <SearchBar
            placeholder="Filter by Plugin..."
            onSearch={this.pluginSearchTerm}
            width={500}
          />
        </div>
        <div className="panel-body">{this.MeasurementsContent}</div>
      </div>
    )
  }

  public getSortedPlugin = memoize(
    (
      inputPluginList: Plugin[],
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection.ASC
    ) =>
      this.sort(
        this.filter(inputPluginList, searchTerm),
        sortKey,
        sortDirection
      )
  )

  public filter(plugin: Plugin[], searchTerm: string): Plugin[] {
    const filterText = searchTerm.toLowerCase()
    return plugin.filter(h => {
      return h.name.toLowerCase().includes(filterText)
    })
  }

  public sort(
    plugin: Plugin[],
    key: string,
    direction: SortDirection
  ): Plugin[] {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy(plugin, e => e[key])
      case SortDirection.DESC:
        return _.sortBy(plugin, e => e[key]).reverse()
      default:
        return plugin
    }
  }

  public pluginSearchTerm = (searchTerm: string): void => {
    this.setState({searchTerm})
  }

  private get MeasurementsContentBody() {
    const {
      description,
      focusedMeasure,
      inputPluginList,
      outputPluginList,
      searchTerm,
    } = this.state

    const sortedInputPlugin = this.getSortedPlugin(
      inputPluginList,
      searchTerm,
      'name',
      SortDirection.ASC
    )

    const sortedOutputPlugin = this.getSortedPlugin(
      outputPluginList,
      searchTerm,
      'name',
      SortDirection.ASC
    )

    return (
      <FancyScrollbar>
        <div className={'default-measurements'}>(Output Plugin)</div>
        <div className="query-builder--list">
          {sortedOutputPlugin.map((v, i) => {
            return (
              <AgentToolbarFunction
                inoutkind={'OUT'}
                name={v.name}
                isActivity={v.isActivity}
                key={i}
                idx={i}
                handleFocusedPlugin={this.handleFocusedPlugin.bind(this)}
                description={description}
                focusedMeasure={focusedMeasure}
              />
            )
          })}
        </div>

        <div className={'default-measurements'}> (Input Plugin)</div>
        <div className="query-builder--list">
          {sortedInputPlugin.map((v, i) => {
            return (
              <AgentToolbarFunction
                inoutkind={'IN'}
                name={v.name}
                isActivity={v.isActivity}
                key={i}
                idx={i}
                handleFocusedPlugin={this.handleFocusedPlugin.bind(this)}
                description={description}
                focusedMeasure={focusedMeasure}
              />
            )
          })}
        </div>
      </FancyScrollbar>
    )
  }

  private CollectorConfig() {
    const {organizations, me} = this.props
    const {collectorConfigStatus, selectedOrg, configScript} = this.state

    let dropdownOrg: any = null
    if (organizations) {
      dropdownOrg = organizations.map(role => ({
        ...role,
        text: role.name,
      }))
    }

    return (
      <div className="panel">
        {collectorConfigStatus === RemoteDataState.Loading
          ? this.LoadingState
          : null}
        <div className="panel-heading">
          <h2 className="panel-title">collector.conf</h2>
          <div className="panel-title-sub">
            <div className="agent-select--button-box">
              {me.superAdmin ? (
                <Dropdown
                  items={dropdownOrg ? dropdownOrg : [{text: GET_STATUS.EMPTY}]}
                  onChoose={this.onChooseDropdown}
                  selected={selectedOrg}
                  className="dropdown-stretch top"
                />
              ) : null}
            </div>
            <div>
              <button
                className="btn btn-inline_block btn-default agent--btn btn-primary"
                onClick={this.onClickTestCall}
                disabled={_.isEmpty(configScript) ? true : false}
              >
                TEST
              </button>
            </div>
            <div>
              <button
                className="btn btn-inline_block btn-default agent--btn btn-primary"
                onClick={this.onClickApplyCall}
                disabled={_.isEmpty(configScript) ? true : false}
              >
                APPLY
              </button>
            </div>
          </div>
        </div>

        <div className="panel-body">{this.CollectorConfigContent}</div>
      </div>
    )
  }

  private get CollectorConfigBody() {
    const {configScript} = this.state
    return (
      <div className="collect-config--half">
        <AgentCodeEditor
          configScript={configScript}
          onBeforeChangeScript={this.onBeforeChangeScript}
          onChangeScript={this.onChangeScript}
        />
      </div>
    )
  }

  private get horizontalDivisions() {
    const {horizontalProportions} = this.state
    const [topSize, bottomSize] = horizontalProportions

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

  private get verticalDivisions() {
    const {verticalProportions} = this.state
    const [rightSize, leftSize] = verticalProportions

    return [
      {
        name: '',
        handleDisplay: 'none',
        headerButtons: [],
        menuOptions: [],
        render: this.Measurements.bind(this),
        headerOrientation: HANDLE_VERTICAL,
        size: rightSize,
      },
      {
        name: '',
        handlePixels: 8,
        headerButtons: [],
        menuOptions: [],
        render: this.CollectorConfig.bind(this),
        headerOrientation: HANDLE_VERTICAL,
        size: leftSize,
      },
    ]
  }

  private onChooseDropdown = (org: Organization) => {
    const {selectedOrg, configScript, focusedHost} = this.state

    if (selectedOrg === org.name) return

    const configObj = TOML.parse(configScript)
    const influxdbs: any = _.get(configObj, 'outputs.influxdb')
    const agent: any = _.get(configObj, 'agent')

    if (!influxdbs || !agent) return

    let isChanged = false

    influxdbs.forEach((influxdb: {database: string}) => {
      if (_.get(influxdb, 'database') !== org.name) {
        _.set(influxdb, 'database', org.name)
      }
    })

    if (_.get(agent, 'hostname') !== focusedHost) {
      _.set(agent, 'hostname', focusedHost)
    }

    const checker = _.some(
      _.map(influxdbs, m => m.database === org.name),
      false
    )

    if (!checker && _.get(agent, 'hostname') === focusedHost) {
      isChanged = true
    }

    if (isChanged)
      this.setState({
        selectedOrg: org.name,
        configScript: TOML.stringify(configObj),
      })
    else
      this.setState({
        selectedOrg: org.name,
      })
  }
}

const mstp = ({adminCloudHub: {organizations}, auth: {me}}) => ({
  organizations,
  me,
})

const mdtp = {
  notify: notifyAction,
  runLocalServiceStartTelegraf: runLocalServiceStartTelegrafAsync,
  runLocalServiceStopTelegraf: runLocalServiceStopTelegrafAsync,
  runLocalGroupAdduser: runLocalGroupAdduserAsync,
  getLocalFileRead: getLocalFileReadAsync,
  getLocalFileWrite: getLocalFileWriteAsync,
  runLocalServiceReStartTelegraf: runLocalServiceReStartTelegrafAsync,
  runLocalServiceTestTelegraf: runLocalServiceTestTelegrafAsync,
  getRunnerSaltCmdTelegraf: getRunnerSaltCmdTelegrafAsync,
  getRunnerSaltCmdTelegrafPlugin: getRunnerSaltCmdTelegrafPluginAsync,
}

export default connect(mstp, mdtp)(AgentConfiguration)
