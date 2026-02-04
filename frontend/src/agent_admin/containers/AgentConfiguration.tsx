// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'

import * as TOML from '@iarna/toml'
import {EditorChange} from 'codemirror'
import {AxiosResponse} from 'axios'
import path from 'path'
import moment from 'moment'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import AgentConfigurationTable from 'src/agent_admin/components/AgentConfigurationTable'
import AgentCodeEditor from 'src/agent_admin/components/AgentCodeEditor'
import AgentConfigModal from 'src/agent_admin/components/AgentConfigModal'
import AgentConfigConsoleModal from 'src/agent_admin/components/AgentConfigConsoleModal'
import PageSpinner from 'src/shared/components/PageSpinner'
import Dropdown from 'src/shared/components/Dropdown'
import AgentConfigPlugin from 'src/agent_admin/components/AgentConfigPlugins'

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
  notifyAgentConfigLoadFailed,
  notifyTelegrafReloadFailed,
  notifyAgentApplyFailed,
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
  DropdownItem,
} from 'src/types'
import {MinionsObject} from 'src/agent_admin/type'

// API
import {
  getLocalDirectoryMake,
  runLocalServiceReloadTelegraf,
  runLocalServiceReStartTelegraf,
} from 'src/shared/apis/saltStack'

// Utils
import {getTelegrafConfigPath} from 'src/agent_admin/utils'

interface LocalStorageAgentConfig {
  focusedHost?: string
  focusedHostIp?: string
  configScript?: string
  isApplyBtnEnabled?: boolean
}

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
  collectorConfigStatus: RemoteDataState
  horizontalProportions: number[]
  verticalProportions: number[]
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
  isConsoleModalVisible: boolean
  isConsoleModalMessage: string
  timeStampTempFile: string
  errorState: string
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
      collectorConfigStatus: RemoteDataState.NotStarted,
      horizontalProportions: [0.43, 0.57],
      verticalProportions: [0.3, 0.7],
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
      isConsoleModalVisible: false,
      isConsoleModalMessage: '',
      timeStampTempFile: '',
      errorState: '',
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

    this.setState({
      isModalCall: checkData.isModalCall,
      isModalVisible: checkData.isModalVisible,
      isConsoleModalVisible: checkData.isConsoleModalVisible,
      isGetLocalStorage: checkData.isGetLocalStorage,
      isCollectorInstalled: checkData.isCollectorInstalled,
      configPageStatus: this.props.minionsStatus,
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

  public onClickTableRowCall = async (host: string) => {
    if (this.state.focusedHost === host) return
    const {
      notify,
      saltMasterUrl,
      saltMasterToken,
      getLocalFileRead,
      minionsObject,
    } = this.props

    this.setState({
      configPageStatus: RemoteDataState.Loading,
      collectorConfigStatus: RemoteDataState.Loading,
      focusedHost: host,
      isInitEditor: true,
      isGetLocalStorage: false,
    })
    const configPath = getTelegrafConfigPath(minionsObject[host].os)
    const getLocalFileReadPromise = getLocalFileRead(
      saltMasterUrl,
      saltMasterToken,
      host,
      configPath.FILE
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
          configScript: hostLocalFileReadData,
          isGetLocalStorage: isChanged,
          isApplyBtnEnabled: isChanged ? true : !isChanged,
          collectorConfigStatus: RemoteDataState.Done,
          configPageStatus: RemoteDataState.Done,
          selectedOrg: this.DEFAULT_DROPDOWN_TEXT,
        })
      })
      .catch(error => {
        console.error(error)
        const message =
          error instanceof Error ? error.message : 'Failed to load config file.'
        notify(notifyAgentConfigLoadFailed(error))
        this.setState({
          errorState: message,
          configPageStatus: RemoteDataState.Done,
          collectorConfigStatus: RemoteDataState.Done,
        })
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
    const telegrafConfigPath = getTelegrafConfigPath(
      minionsObject[focusedHost].os
    )
    const getLocalFileWritePromise = getLocalFileWrite(
      saltMasterUrl,
      saltMasterToken,
      focusedHost,
      configScript,
      telegrafConfigPath.FILE
    )

    getLocalFileWritePromise
      .then(({data}): void => {
        responseMessage = data.return[0][focusedHost]

        const getLocalServiceReloadTelegrafPromise =
          minionsObject[focusedHost].os.toLowerCase() === 'windows'
            ? runLocalServiceReStartTelegraf(
                saltMasterUrl,
                saltMasterToken,
                focusedHost
              )
            : runLocalServiceReloadTelegraf(
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
            })

            await handleTelegrafStatus(focusedHost)
            notify(notifyAgentApplySucceeded('is applied'))
          })
          .catch(error => {
            notify(notifyTelegrafReloadFailed(error))

            this.setState({
              configPageStatus: RemoteDataState.Done,
              collectorConfigStatus: RemoteDataState.Done,
            })
          })
      })
      .catch(error => {
        notify(notifyAgentApplyFailed(error))

        this.setState({
          configPageStatus: RemoteDataState.Done,
          collectorConfigStatus: RemoteDataState.Done,
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
      minionsObject,
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
    const telegrafConfigPath = getTelegrafConfigPath(
      minionsObject[focusedHost].os
    )
    const getLocalDirectoryMakePromise = getLocalDirectoryMake(
      saltMasterUrl,
      saltMasterToken,
      focusedHost,
      telegrafConfigPath.TEMPDIRECTORY
    )

    getLocalDirectoryMakePromise
      .then(data => {
        const isDirectoryMadeSucceeded = data[0][focusedHost]

        if (!isDirectoryMadeSucceeded) {
          throw new Error('Failed to Make Temp Directory')
        }

        const timeStamp = moment().format('YYYYMMDDHHmmssSS')
        const tempDirectory = path.join(
          telegrafConfigPath.TEMPDIRECTORY,
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
      minionsObject,
    } = this.props
    const {
      selectedInputPlugin,
      focusedHost,
      isApplyBtnEnabled,
      timeStampTempFile,
    } = this.state
    const telegrafConfigPath = getTelegrafConfigPath(
      minionsObject[focusedHost].os
    )
    const telegrafConfDirectory = isApplyBtnEnabled
      ? timeStampTempFile
      : telegrafConfigPath.FILE

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
    const {saltMasterUrl, saltMasterToken, minionsObject} = this.props
    const {focusedHost} = this.state
    const focusedMinionsObject = minionsObject?.[focusedHost]
    return (
      <AgentConfigPlugin
        loadingState={this.LoadingState}
        errorStateComponent={this.ErrorState}
        saltMasterUrl={saltMasterUrl}
        saltMasterToken={saltMasterToken}
        minionsObject={focusedMinionsObject}
      />
    )
  }

  public getExistingInputPluginList(pluginList: string[]): DropdownItem[] {
    return _.map(pluginList, plugin => ({
      text: plugin,
    }))
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

    const lines = configScript.split('\n')
    let currentSection = ''

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const sectionHeaderMatch = line.match(/^\s*\[+\s*([^\]]+)\s*\]+/)

      if (sectionHeaderMatch) {
        currentSection = sectionHeaderMatch[1].trim()
      } else {
        if (
          currentSection === 'outputs.influxdb' &&
          /^\s*database\s*=/.test(line)
        ) {
          lines[i] = line.replace(
            /(^\s*database\s*=\s*)(['"])(.*?)\2/,
            (_, prefix, quote) => `${prefix}${quote}${org.name}${quote}`
          )
        } else if (
          currentSection === 'agent' &&
          /^\s*hostname\s*=/.test(line)
        ) {
          lines[i] = line.replace(
            /(^\s*hostname\s*=\s*)(['"])(.*?)\2/,
            (_, prefix, quote) => `${prefix}${quote}${focusedHost}${quote}`
          )
        }
      }
    }

    const newConfigScript = lines.join('\n')

    this.setState({
      selectedOrg: org.name,
      configScript: newConfigScript,
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
}

export default connect(mstp, mdtp)(AgentConfiguration)
