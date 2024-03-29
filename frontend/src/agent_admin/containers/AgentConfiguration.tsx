// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import memoize from 'memoize-one'
import * as TOML from '@iarna/toml'
import {EditorChange} from 'codemirror'
import {AxiosResponse} from 'axios'
import path from 'path'
import moment from 'moment'

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
  notifyAgentConfigTempDirectoryMakeFailed,
  notifyAgentConfigTempFileWriteFailed,
  notifyTelegrafReloadFailed,
  notifyAgentApplyFailed,
} from 'src/shared/copy/notifications'

// Constants
import {HANDLE_HORIZONTAL, HANDLE_VERTICAL} from 'src/shared/constants'
import {AGENT_TELEGRAF_CONFIG, GET_STATUS} from 'src/agent_admin/constants'

// Types
import {
  Me,
  Organization,
  RemoteDataState,
  Notification,
  NotificationFunc,
  DropdownItem,
} from 'src/types'
import {MinionsObject, SortDirection} from 'src/agent_admin/type'

// API
import {
  getLocalDirectoryMake,
  runLocalServiceReloadTelegraf,
} from 'src/shared/apis/saltStack'

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
  getLocalFileRead: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string,
    path?: string
  ) => Promise<AxiosResponse>
  getLocalFileWrite: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string,
    script: string,
    path?: string
  ) => Promise<AxiosResponse>
  getRunnerSaltCmdTelegraf: (
    saltMasterUrl: string,
    saltMasterToken: string,
    measurements: string
  ) => Promise<AxiosResponse>
  getRunnerSaltCmdTelegrafPlugin: (
    saltMasterUrl: string,
    saltMasterToken: string,
    cmd: string
  ) => Promise<AxiosResponse>
  runLocalServiceTestTelegraf: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string,
    selectedInputPlugin?: string,
    path?: string
  ) => Promise<AxiosResponse>
}

interface State {
  inputPluginTestStatus: RemoteDataState
  existingInputPluginList: DropdownItem[]
  selectedInputPlugin: string
  isOpenPlugin: boolean
  isDisabledPlugins: boolean
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
  isApplyBtnEnabled: boolean
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
  timeStampTempFile: string
}
interface Plugin {
  inoutType: string
  name: string
  isActivity: boolean
}
interface LocalStorageAgentConfig {
  focusedHost?: string
  focusedHostIp?: string
  configScript?: string
  isApplyBtnEnabled?: boolean
}

@ErrorHandling
export class AgentConfiguration extends PureComponent<Props, State> {
  private DEFAULT_DROPDOWN_TEXT = 'Select Database(= Group)'

  constructor(props: Props) {
    super(props)
    this.state = {
      inputPluginTestStatus: RemoteDataState.NotStarted,
      existingInputPluginList: [{text: 'All'}],
      selectedInputPlugin: 'All',
      isOpenPlugin: false,
      isDisabledPlugins: false,
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
      isApplyBtnEnabled: false,
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
      timeStampTempFile: '',
    }
  }

  public componentWillMount() {
    verifyLocalStorage(getLocalStorage, setLocalStorage, 'AgentConfigPage', {
      focusedHost: '',
      focusedHostIp: '',
      configScript: '',
      isApplyBtnEnabled: false,
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
    const {focusedHost, configScript, isApplyBtnEnabled} = this.state

    setLocalStorage('AgentConfigPage', {
      focusedHost: isApplyBtnEnabled ? focusedHost : '',
      configScript: isApplyBtnEnabled ? configScript : '',
      isApplyBtnEnabled,
    })
  }

  public getTelegrafPlugin = async () => {
    const {
      saltMasterUrl,
      saltMasterToken,
      getRunnerSaltCmdTelegrafPlugin,
    } = this.props
    const telegrafPlugin = await Promise.all([
      getRunnerSaltCmdTelegrafPlugin(
        saltMasterUrl,
        saltMasterToken,
        'telegraf --input-list'
      ),
      getRunnerSaltCmdTelegrafPlugin(
        saltMasterUrl,
        saltMasterToken,
        'telegraf --output-list'
      ),
    ])

    const inputPlugin = _.get(telegrafPlugin[0], 'return')[0]
      .replace(/ /g, '')
      .split('\n')
    const outputPlugin = _.get(telegrafPlugin[1], 'return')[0]
      .replace(/ /g, '')
      .split('\n')

    inputPlugin.shift()
    outputPlugin.shift()

    const inputPluginList = _.map(inputPlugin, input => ({
      inoutType: 'IN',
      name: input,
      isActivity: false,
    }))
    const outputPluginList = _.map(outputPlugin, output => ({
      inoutType: 'OUT',
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
          existingInputPluginList: this.getExistingInputPluginList([
            'All',
            ..._.keys(configObj.inputs),
          ]),
          configScript: TOML.stringify(configObj),
          isGetLocalStorage: isChanged,
          isApplyBtnEnabled: isChanged ? true : !isChanged,
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
      handleTelegrafStatus,
    } = this.props

    this.setState({
      configPageStatus: RemoteDataState.Loading,
    })

    isRunning
      ? await runLocalServiceStopTelegraf(saltMasterUrl, saltMasterToken, host)
      : await runLocalServiceStartTelegraf(saltMasterUrl, saltMasterToken, host)

    await handleTelegrafStatus(host)
  }

  public onClickApplyCall = () => {
    const {
      notify,
      saltMasterUrl,
      saltMasterToken,
      organizations,
      me,
      getLocalFileWrite,
      minionsObject,
      handleTelegrafStatus,
    } = this.props
    const {focusedHost, configScript} = this.state
    let {
      isModalCall,
      isApplyBtnEnabled,
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
        responseMessage = data.return[0][focusedHost]

        const getLocalServiceReloadTelegrafPromise = runLocalServiceReloadTelegraf(
          saltMasterUrl,
          saltMasterToken,
          focusedHost
        )

        getLocalServiceReloadTelegrafPromise
          .then(async ({data}) => {
            const isReloadSucceeded = data.return[0][focusedHost]

            if (isReloadSucceeded !== true) {
              throw new Error('Failed to Reload Telegraf')
            }

            isGetLocalStorage = false
            isApplyBtnEnabled = false

            const checkData = this.checkData({
              isModalCall,
              isApplyBtnEnabled,
              isGetLocalStorage,
              minionsObject,
            })

            this.setState({
              isModalCall: checkData.isModalCall,
              isGetLocalStorage: checkData.isGetLocalStorage,
              isCollectorInstalled: checkData.isCollectorInstalled,
              isApplyBtnEnabled: checkData.isApplyBtnEnabled,
              responseMessage,
              configPageStatus: RemoteDataState.Done,
              collectorConfigStatus: RemoteDataState.Done,
              measurementsStatus: RemoteDataState.Done,
            })

            await handleTelegrafStatus(focusedHost)
            notify(notifyAgentApplySucceeded('is applied'))
          })
          .catch(error => {
            notify(notifyTelegrafReloadFailed(error))

            this.setState({
              configPageStatus: RemoteDataState.Done,
              collectorConfigStatus: RemoteDataState.Done,
              measurementsStatus: RemoteDataState.Done,
            })
          })
      })
      .catch(error => {
        notify(notifyAgentApplyFailed(error))

        this.setState({
          configPageStatus: RemoteDataState.Done,
          collectorConfigStatus: RemoteDataState.Done,
          measurementsStatus: RemoteDataState.Done,
        })
      })
  }

  handleSelectPlugin = (newPlugin: DropdownItem) => {
    const newPluginName = newPlugin.text === undefined ? 'All' : newPlugin.text

    this.setState({selectedInputPlugin: newPluginName})
  }

  onClickInputPluginsDropdown = async () => {
    const {isOpenPlugin} = this.state

    if (!isOpenPlugin) {
      this.setState({isDisabledPlugins: true})
      this.handleOpenPluginsDropdown()
      this.setState({isDisabledPlugins: false})
    } else {
      this.handleCloseInputPluginsDropdown()
    }
  }

  handleOpenPluginsDropdown = () => {
    this.setState({isOpenPlugin: true})
  }

  handleCloseInputPluginsDropdown = () => {
    this.setState({isOpenPlugin: false})
  }

  handleCloseConsoleModal = () => {
    this.setState({
      isConsoleModalVisible: !this.state.isConsoleModalVisible,
      selectedInputPlugin: 'All',
    })
  }

  public onClickShowConsoleModal = () => {
    const {
      notify,
      saltMasterUrl,
      saltMasterToken,
      organizations,
      me,
      getLocalFileWrite,
    } = this.props
    const {focusedHost, configScript} = this.state
    let {isApplyBtnEnabled, responseMessage} = this.state

    let isCheckDone = true
    let existingInputPlugins

    try {
      if (!configScript) return

      const configObj = TOML.parse(configScript)
      const influxdbs: any = _.get(configObj, 'outputs.influxdb')
      const agent: any = _.get(configObj, 'agent')
      existingInputPlugins = configObj.inputs

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

    if (!isApplyBtnEnabled) {
      this.setState({
        isConsoleModalVisible: true,
        isConsoleModalMessage: '',
        existingInputPluginList: this.getExistingInputPluginList([
          'All',
          ..._.keys(existingInputPlugins),
        ]),
      })
      return
    }

    this.setState({
      inputPluginTestStatus: RemoteDataState.Loading,
      isConsoleModalVisible: true,
      isConsoleModalMessage: '',
    })

    const getLocalDirectoryMakePromise = getLocalDirectoryMake(
      saltMasterUrl,
      saltMasterToken,
      focusedHost,
      AGENT_TELEGRAF_CONFIG.TEMPDIRECTORY
    )

    getLocalDirectoryMakePromise
      .then(data => {
        const isDirectoryMadeSucceeded = data[0][focusedHost]

        if (!isDirectoryMadeSucceeded) {
          throw new Error('Failed to Make Temp Directory')
        }

        const timeStamp = moment().format('YYYYMMDDHHmmssSS')
        const tempDirectory = path.join(
          AGENT_TELEGRAF_CONFIG.TEMPDIRECTORY,
          `${timeStamp}.conf`
        )
        const getLocalFileWritePromise = getLocalFileWrite(
          saltMasterUrl,
          saltMasterToken,
          focusedHost,
          configScript,
          tempDirectory
        )

        getLocalFileWritePromise
          .then(({data}): void => {
            responseMessage = data.return[0][focusedHost]

            this.setState({
              existingInputPluginList: this.getExistingInputPluginList([
                'All',
                ..._.keys(existingInputPlugins),
              ]),
              responseMessage,
              inputPluginTestStatus: RemoteDataState.Done,
              timeStampTempFile: tempDirectory,
            })
          })
          .catch(error => {
            this.setState({
              isConsoleModalVisible: false,
              inputPluginTestStatus: RemoteDataState.Done,
            })

            notify(notifyAgentConfigTempFileWriteFailed(error))
          })
      })
      .catch(error => {
        this.setState({
          isConsoleModalVisible: false,
          inputPluginTestStatus: RemoteDataState.Done,
        })

        notify(notifyAgentConfigTempDirectoryMakeFailed(error.data))
      })
  }

  public onClickTestCall = () => {
    const {
      saltMasterUrl,
      saltMasterToken,
      runLocalServiceTestTelegraf,
    } = this.props
    const {
      selectedInputPlugin,
      focusedHost,
      isApplyBtnEnabled,
      timeStampTempFile,
    } = this.state
    const telegrafConfDirectory = isApplyBtnEnabled
      ? timeStampTempFile
      : AGENT_TELEGRAF_CONFIG.FILE

    const getLocalServiceTestTelegrafPromise = runLocalServiceTestTelegraf(
      saltMasterUrl,
      saltMasterToken,
      focusedHost,
      selectedInputPlugin,
      telegrafConfDirectory
    )

    this.setState({
      inputPluginTestStatus: RemoteDataState.Loading,
      isConsoleModalMessage: '',
    })

    getLocalServiceTestTelegrafPromise
      .then((data): void => {
        this.setState({
          inputPluginTestStatus: RemoteDataState.Done,
          isConsoleModalMessage: data['return'][0][focusedHost],
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
      isApplyBtnEnabled,
    }: LocalStorageAgentConfig = getLocalStorage('AgentConfigPage')

    if (answer) {
      this.setState({
        configScript,
        focusedHost,
        isApplyBtnEnabled,
        isInitEditor: false,
      })
    } else {
      setLocalStorage('AgentConfigPage', {
        focusedHost: '',
        focusedHostIp: '',
        configScript: '',
        isApplyBtnEnabled: false,
      })
    }
  }

  render() {
    const {isUserAuthorized} = this.props
    const {
      existingInputPluginList,
      inputPluginTestStatus,
      isOpenPlugin,
      isDisabledPlugins,
      selectedInputPlugin,
      isConsoleModalVisible,
      isConsoleModalMessage,
      isModalVisible,
    } = this.state

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
              visible={isModalVisible}
              headingTitle={'Confirm'}
              message={'Do you want to import previous changes?'}
              cancelText={'No'}
              confirmText={'Yes'}
              onCancel={() => {
                this.setState({isModalVisible: !isModalVisible})
                this.getConfigInfo(false)
              }}
              onConfirm={() => {
                this.setState({isModalVisible: !isModalVisible})
                this.getConfigInfo(true)
              }}
            />
            <div className="agent-console">
              <AgentConfigConsoleModal
                inputPluginTestStatus={inputPluginTestStatus}
                onClickTestCall={this.onClickTestCall}
                existingInputPluginList={existingInputPluginList}
                isOpenPlugin={isOpenPlugin}
                isDisabledPlugins={isDisabledPlugins}
                onChoose={this.handleSelectPlugin}
                onClickInputPluginsDropdown={this.onClickInputPluginsDropdown}
                onCloseInputPluginsDropdown={
                  this.handleCloseInputPluginsDropdown
                }
                selectedInputPlugin={selectedInputPlugin}
                visible={isConsoleModalVisible}
                headingTitle={'Agent Plugin Test'}
                message={isConsoleModalMessage}
                cancelText={'Close'}
                onClose={this.handleCloseConsoleModal}
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
    isApplyBtnEnabled,
    isConsoleModalVisible,
  }: {
    minionsObject?: Props['minionsObject']
    isModalCall?: State['isModalCall']
    isModalVisible?: State['isModalVisible']
    isGetLocalStorage?: State['isGetLocalStorage']
    isCollectorInstalled?: State['isCollectorInstalled']
    isApplyBtnEnabled?: State['isApplyBtnEnabled']
    isConsoleModalVisible?: State['isConsoleModalVisible']
  }): {
    minionsObject?: Props['minionsObject']
    isModalCall?: State['isModalCall']
    isModalVisible?: State['isModalVisible']
    isGetLocalStorage?: State['isGetLocalStorage']
    isCollectorInstalled?: State['isCollectorInstalled']
    isApplyBtnEnabled?: State['isApplyBtnEnabled']
    isConsoleModalVisible?: State['isConsoleModalVisible']
  } => {
    const CollectorInstalledMinions = _.filter(minionsObject, [
      'isInstall',
      true,
    ])

    isCollectorInstalled = Boolean(CollectorInstalledMinions.length)

    if (!isModalCall) {
      const {
        isApplyBtnEnabled,
        focusedHost,
      }: LocalStorageAgentConfig = getLocalStorage('AgentConfigPage')

      const getHostCompare = _.find(CollectorInstalledMinions, [
        'host',
        focusedHost,
      ])

      if (isApplyBtnEnabled && Boolean(getHostCompare)) {
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
      isApplyBtnEnabled,
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
    const {inputPluginList, outputPluginList} = this.state
    const {name, inoutkind} = _thisProps

    this.setState({
      isPluginModalVisible: true,
      focusedMeasure: name,
      description: '',
    })

    const mapInputPlugin = inputPluginList.map(m => {
      if (m.inoutType === inoutkind && m.name === name) m.isActivity = true
      else m.isActivity = false
      return m
    })

    const mapOutputPlugin = outputPluginList.map(m => {
      if (m.inoutType === inoutkind && m.name === name) m.isActivity = true
      else m.isActivity = false
      return m
    })

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
    const {inputPluginList, outputPluginList} = this.state

    const mapInputPlugin = inputPluginList.map(m => {
      m.isActivity = false
      return m
    })

    const mapOutputPlugin = outputPluginList.map(m => {
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
      isApplyBtnEnabled: true,
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
          isApplyBtnEnabled: true,
          isInitEditor: false,
        })
      } else {
        this.setState({
          isApplyBtnEnabled: false,
          isInitEditor: false,
        })
      }
    } else {
      this.setState({
        isApplyBtnEnabled: true,
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

  public getExistingInputPluginList(pluginList: string[]): DropdownItem[] {
    return _.map(pluginList, plugin => ({
      text: plugin,
    }))
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
    const {
      collectorConfigStatus,
      selectedOrg,
      configScript,
      isApplyBtnEnabled,
    } = this.state

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
                onClick={this.onClickShowConsoleModal}
                disabled={_.isEmpty(configScript) ? true : false}
              >
                TEST
              </button>
            </div>
            <div>
              <button
                className="btn btn-inline_block btn-default agent--btn btn-primary"
                onClick={this.onClickApplyCall}
                disabled={!isApplyBtnEnabled}
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
  runLocalServiceTestTelegraf: runLocalServiceTestTelegrafAsync,
  getRunnerSaltCmdTelegraf: getRunnerSaltCmdTelegrafAsync,
  getRunnerSaltCmdTelegrafPlugin: getRunnerSaltCmdTelegrafPluginAsync,
}

export default connect(mstp, mdtp)(AgentConfiguration)
