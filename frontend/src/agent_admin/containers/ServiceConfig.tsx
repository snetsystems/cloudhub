// Libraries
import React, {ChangeEvent, PureComponent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import {AxiosResponse} from 'axios'
import * as TOML from '@iarna/toml'
import {EditorChange} from 'codemirror'
import path from 'path'
import moment from 'moment'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// Actions
import {
  getLocalFileReadAsync,
  getLocalFileWriteAsync,
  getLocalSaltCmdDirectoryAsync,
} from 'src/agent_admin/actions'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  notifyAgentApplySucceeded,
  notifyConfigFileSaveFailed,
  notifyConfigFileReadFailed,
  notifyGetProjectFileFailed,
  notifyMinionNotSelected,
  notifyConfigFileSaveFailedByNoTenant,
  notifyTelegrafReloadFailed,
  notifyAgentApplyFailed,
  notifyAgentConfigTempFileWriteFailed,
  notifyAgentConfigTempDirectoryMakeFailed,
  notifyTelegrafDubugFailed,
} from 'src/shared/copy/notifications'

// Types
import {
  Me,
  Organization,
  RemoteDataState,
  Notification,
  NotificationFunc,
} from 'src/types'

import {
  AgentDirFile,
  AgentDirFileInfo,
  CollectorConfigTableData,
  CollectorConfigTabName,
  GetAgentDirectoryInfo,
  MinionsObject,
} from 'src/agent_admin/type'

// Constants
import {
  AGENT_TENANT_DIRECTORY,
  GET_STATUS,
  NETWORK_ACCESS,
  AGENT_TENANT_CLOUD_DIRECTORY,
  COLLECTOR_CONFIG_TAB_ORDER,
  AGENT_TELEGRAF_CONFIG,
} from 'src/agent_admin/constants'

// Components
import CollectorConfig from 'src/agent_admin/components/CollectorConfig'
import ServiceConfigCollectorService from 'src/agent_admin/components/ServiceConfigCollectorService'
import ServiceConfigTenant from 'src/agent_admin/components/ServiceConfigTenant'

// APIS
import {
  getLocalDirectoryMake,
  getLocalFileWrite,
  runLocalServiceDebugTelegraf,
  runLocalServiceReloadTelegraf,
} from 'src/shared/apis/saltStack'

interface Props {
  isUserAuthorized: boolean
  saltMasterUrl: string
  saltMasterToken: string
  me: Me
  collectorConfigTableTabs: CollectorConfigTabName[]
  organizations: Organization[]
  minionsObject: MinionsObject
  minionsStatus: RemoteDataState
  notify: (message: Notification | NotificationFunc) => void
  handleGetMinionKeyListAll: () => void
  getLocalSaltCmdDirectory: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minionID: string,
    saltDirectory: string
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
}

interface State {
  isCollectorInstalled: boolean
  configScript: string
  inputConfigScript: string
  configEditStyle: 'basic' | 'toml'
  focusedMinion: string
  focusedTenant: string
  focusedCollectorConfigTab: CollectorConfigTabName | ''
  selectedService: string[]
  serviceConfigStatus: RemoteDataState
  collectorConfigTableData: CollectorConfigTableData
  projectFileList: AgentDirFile
}

@ErrorHandling
export class ServiceConfig extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      focusedCollectorConfigTab: '',
      inputConfigScript: '',
      configScript: '',
      configEditStyle: 'basic',
      isCollectorInstalled: false,
      serviceConfigStatus: RemoteDataState.Loading,
      focusedMinion: '',
      focusedTenant: '',
      collectorConfigTableData: {
        authentication: '',
        project: '',
        domain: '',
        username: '',
        password: '',
        interval: '',
      },
      selectedService: [],
      projectFileList: {files: [], isLoading: true},
    }
  }

  public componentWillMount() {
    this.setState({serviceConfigStatus: this.props.minionsStatus})
  }

  public componentDidMount() {
    const {minionsObject, collectorConfigTableTabs} = this.props
    const CollectorInstalledMinions = _.filter(minionsObject, [
      'isInstall',
      true,
    ])
    const defaultSelectedCollectorConfigTab = this.getDefaultCollectorConfigTab(
      collectorConfigTableTabs
    )

    this.setState({
      focusedCollectorConfigTab: defaultSelectedCollectorConfigTab,
      isCollectorInstalled: Boolean(CollectorInstalledMinions.length),
      serviceConfigStatus: this.props.minionsStatus,
    })
  }

  public getDefaultCollectorConfigTab(
    collectorConfigTableTabs: CollectorConfigTabName[]
  ): CollectorConfigTabName {
    const cloudTabOrder: CollectorConfigTabName[] = COLLECTOR_CONFIG_TAB_ORDER

    return cloudTabOrder.find(
      cloudTab => collectorConfigTableTabs.indexOf(cloudTab) !== -1
    )
  }

  public componentDidUpdate(prevProps: Props) {
    if (
      prevProps.minionsObject !== this.props.minionsObject ||
      prevProps.minionsStatus !== this.props.minionsStatus
    ) {
      const {minionsObject} = this.props
      const CollectorInstalledMinions = _.filter(minionsObject, [
        'isInstall',
        true,
      ])

      this.setState({
        isCollectorInstalled: Boolean(CollectorInstalledMinions.length),
        serviceConfigStatus: this.props.minionsStatus,
      })
    }
  }

  public handleClickConfigEditStyle = configEditStyle => {
    this.setState({
      configEditStyle: configEditStyle,
    })
  }

  public handleClickMinionTableRow = selectedMinion => () => {
    this.setState({
      serviceConfigStatus: RemoteDataState.Loading,
      focusedMinion: selectedMinion,
      focusedTenant: '',
      collectorConfigTableData: {
        authentication: '',
        project: '',
        domain: '',
        username: '',
        password: '',
        interval: '',
      },
      selectedService: [],
      projectFileList: {files: [], isLoading: true},
      configScript: '',
      inputConfigScript: '',
    })

    try {
      this.getProjectFileListFromMinion(selectedMinion)
    } catch (error) {
      this.notifyGetProjectFileError(error)
    }
  }

  public getProjectFileListFromMinion = async selectedMinion => {
    const {saltMasterUrl, saltMasterToken} = this.props
    const {focusedCollectorConfigTab} = this.state
    const agentTenantDirectory = path.join(
      AGENT_TENANT_DIRECTORY.DIR,
      AGENT_TENANT_CLOUD_DIRECTORY[focusedCollectorConfigTab]
    )

    const projectFileList: AgentDirFile = await this.getLocalSaltCmdDirectoryData(
      saltMasterUrl,
      saltMasterToken,
      selectedMinion,
      agentTenantDirectory
    )

    this.setState({
      projectFileList: projectFileList,
      serviceConfigStatus: RemoteDataState.Done,
    })
  }

  public getLocalSaltCmdDirectoryData = async (
    url: string,
    token: string,
    minionID: string,
    fullDir: string
  ): Promise<AgentDirFile> => {
    const fileExtensionCheckRegex = /conf$/
    let applications: AgentDirFileInfo[] = []
    const getDirectoryItems: GetAgentDirectoryInfo = await this.props.getLocalSaltCmdDirectory(
      url,
      token,
      minionID,
      fullDir
    )

    if (
      getDirectoryItems.status === 200 &&
      getDirectoryItems.statusText === 'OK'
    ) {
      const getData: string = getDirectoryItems?.data?.return[0][minionID]

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
          applications = getData
            .split('\n')
            .filter(item => fileExtensionCheckRegex.test(item))
            .map((item: string) => {
              const time: string = item.substring(0, item.indexOf(' '))
              const tenant = item.substring(item.indexOf(' ') + 1).split('.')[0]
              return this.generatorFileInfo({time, item: tenant, fullDir})
            })
        } else if (fileExtensionCheckRegex.test(getData)) {
          const time: string = getData.substring(0, getData.indexOf(' '))
          const tenant = getData
            .substring(getData.indexOf(' ') + 1)
            .split('.')[0]
          applications = [this.generatorFileInfo({time, item: tenant, fullDir})]
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

  public handleBeforeChangeScript = (
    __: CodeMirror.Editor,
    ___: EditorChange,
    script: string
  ) => {
    this.setState({
      inputConfigScript: script,
    })
  }

  public handleChangeScript = (
    _: CodeMirror.Editor,
    __: EditorChange,
    ___: string
  ) => {}

  public handleSaveClick = () => {
    const {notify} = this.props
    const {focusedTenant} = this.state

    if (focusedTenant === '') {
      notify(notifyConfigFileSaveFailedByNoTenant())
      return
    }

    this.setState({
      serviceConfigStatus: RemoteDataState.Loading,
    })

    try {
      const configScript = this.updateCollectorConfigTableData()

      this.debugTelegrafCloudPlugin(configScript)
    } catch (error) {
      error.message =
        error.line === undefined
          ? error.message
          : `Parsing error on line ${error.line} column ${error.col}`
      notify(notifyConfigFileSaveFailed(error))
      this.setState({
        serviceConfigStatus: RemoteDataState.Done,
      })
    }
  }

  public updateCollectorConfigTableData() {
    const {
      collectorConfigTableData,
      focusedCollectorConfigTab,
      configScript,
      selectedService,
      configEditStyle,
    } = this.state

    if (configEditStyle === 'toml') {
      return this.updateCollectorConfigTableDataByTOM(configScript)
    }

    const configObj = TOML.parse(configScript)
    const inputPlugins = configObj['inputs'][focusedCollectorConfigTab][0]

    inputPlugins.authentication_endpoint =
      collectorConfigTableData.authentication
    inputPlugins.project = collectorConfigTableData.project
    inputPlugins.domain = collectorConfigTableData.domain
    inputPlugins.username = collectorConfigTableData.username
    inputPlugins.password = collectorConfigTableData.password
    inputPlugins.interval = collectorConfigTableData.interval
    inputPlugins.enabled_services = selectedService

    const inputConfigObj = _.cloneDeep(configObj)

    delete inputConfigObj.outputs
    this.setState({
      inputConfigScript: TOML.stringify(inputConfigObj),
    })

    return TOML.stringify(configObj)
  }

  public updateCollectorConfigTableDataByTOM(configScript) {
    const {focusedCollectorConfigTab, inputConfigScript} = this.state
    const configObj = TOML.parse(configScript)
    const inputConfigObj = TOML.parse(inputConfigScript)
    const inputPlugins = inputConfigObj['inputs'][focusedCollectorConfigTab][0]

    configObj.inputs = inputConfigObj.inputs

    this.setState({
      collectorConfigTableData: {
        authentication: inputPlugins.authentication_endpoint,
        project: inputPlugins.project,
        domain: inputPlugins.domain,
        username: inputPlugins.username,
        password: inputPlugins.password,
        interval: inputPlugins.interval,
      },
      selectedService: inputPlugins.enabled_services,
    })

    return TOML.stringify(configObj)
  }

  public debugTelegrafCloudPlugin(configScript) {
    const {notify, saltMasterUrl, saltMasterToken} = this.props
    const {focusedMinion, focusedCollectorConfigTab} = this.state
    const getLocalDirectoryMakePromise = getLocalDirectoryMake(
      saltMasterUrl,
      saltMasterToken,
      focusedMinion,
      AGENT_TELEGRAF_CONFIG.TEMPDIRECTORY
    )

    getLocalDirectoryMakePromise
      .then(data => {
        const isDirectoryMadeSucceeded = data[0][focusedMinion]

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
          focusedMinion,
          configScript,
          tempDirectory
        )

        getLocalFileWritePromise
          .then((): void => {
            const getRunLocalServiceDebugTelegraf = runLocalServiceDebugTelegraf(
              saltMasterUrl,
              saltMasterToken,
              focusedMinion,
              focusedCollectorConfigTab,
              tempDirectory
            )

            getRunLocalServiceDebugTelegraf
              .then(({data}): void => {
                const isTestFailed = data.indexOf('E!') !== -1 ? true : false

                if (isTestFailed) {
                  const errorMessage = data.split('[telegraf]')[1]

                  throw new Error(errorMessage)
                }

                this.writeLocalFile(configScript)
              })
              .catch(error => {
                this.setState({
                  serviceConfigStatus: RemoteDataState.Done,
                })
                notify(notifyTelegrafDubugFailed(error))
              })
          })
          .catch(error => {
            this.setState({
              serviceConfigStatus: RemoteDataState.Done,
            })
            notify(notifyAgentConfigTempFileWriteFailed(error))
          })
      })
      .catch(error => {
        this.setState({
          serviceConfigStatus: RemoteDataState.Done,
        })
        notify(notifyAgentConfigTempDirectoryMakeFailed(error.data))
      })
  }

  public writeLocalFile(configScript) {
    const {
      saltMasterUrl,
      saltMasterToken,
      getLocalFileWrite,
      notify,
    } = this.props
    const {focusedMinion, focusedTenant, focusedCollectorConfigTab} = this.state
    const agentTenantDirectory = path.join(
      AGENT_TENANT_DIRECTORY.DIR,
      AGENT_TENANT_CLOUD_DIRECTORY[focusedCollectorConfigTab]
    )
    const tenantConfigDirectory = path.join(
      agentTenantDirectory,
      `${focusedTenant}.conf`
    )

    const getLocalFileWritePromise = getLocalFileWrite(
      saltMasterUrl,
      saltMasterToken,
      focusedMinion,
      configScript,
      tenantConfigDirectory
    )

    getLocalFileWritePromise
      .then((): void => {
        const getLocalServiceReloadTelegrafPromise = runLocalServiceReloadTelegraf(
          saltMasterUrl,
          saltMasterToken,
          focusedMinion
        )
        getLocalServiceReloadTelegrafPromise
          .then(({data}) => {
            const isReloadSucceeded = data.return[0][focusedMinion]

            if (isReloadSucceeded !== true) {
              throw new Error('Failed to Reload Telegraf')
            }

            this.setState({
              serviceConfigStatus: RemoteDataState.Done,
              configScript: configScript,
            })
            notify(notifyAgentApplySucceeded('is applied'))
          })
          .catch(error => {
            notify(notifyTelegrafReloadFailed(error))
            this.setState({
              serviceConfigStatus: RemoteDataState.Done,
              configScript: configScript,
            })
          })
      })
      .catch(error => {
        notify(notifyAgentApplyFailed(error))

        this.setState({
          serviceConfigStatus: RemoteDataState.Done,
        })
      })
  }

  public handleClickTenantTableRow = selectedTenant => () => {
    this.readLocalFile(selectedTenant)
  }

  public readLocalFile(selectedTenant) {
    const {saltMasterUrl, saltMasterToken, getLocalFileRead} = this.props
    const {focusedMinion, focusedCollectorConfigTab} = this.state
    const agentTenantDirectory = path.join(
      AGENT_TENANT_DIRECTORY.DIR,
      AGENT_TENANT_CLOUD_DIRECTORY[focusedCollectorConfigTab]
    )
    const tenantConfigDirectory = path.join(
      agentTenantDirectory,
      `${selectedTenant}.conf`
    )

    const getLocalFileReadPromise = getLocalFileRead(
      saltMasterUrl,
      saltMasterToken,
      focusedMinion,
      tenantConfigDirectory
    )

    this.setState({
      focusedTenant: selectedTenant,
      serviceConfigStatus: RemoteDataState.Loading,
    })

    getLocalFileReadPromise
      .then(({data}) => {
        const hostData = data.return[0][focusedMinion]
        const hostLocalFileReadData = hostData.substring(
          0,
          hostData.lastIndexOf('\n')
        )
        const configObj = TOML.parse(hostLocalFileReadData)
        const inputPlugins = this.getInputPlugins(configObj)
        const inputConfigObj = _.cloneDeep(configObj)

        delete inputConfigObj.outputs

        this.setState({
          inputConfigScript: TOML.stringify(inputConfigObj),
          configScript: TOML.stringify(configObj),
          serviceConfigStatus: RemoteDataState.Done,
          focusedTenant: selectedTenant,
          collectorConfigTableData: {
            authentication: inputPlugins.authentication,
            project: inputPlugins.project,
            domain: inputPlugins.domain,
            username: inputPlugins.username,
            password: inputPlugins.password,
            interval: inputPlugins.interval,
          },
          selectedService: inputPlugins.enabledService,
        })
      })
      .catch(error => {
        this.notifyReadLocalFileError(error)
      })
  }

  public notifyReadLocalFileError(error) {
    const {notify} = this.props
    const tomlParsingErrorMessage =
      error.name === 'PluginNotFound'
        ? error.message
        : `Parsing error on line ${error.line} column ${error.col}`

    this.setState({
      serviceConfigStatus: RemoteDataState.Done,
      focusedTenant: '',
      collectorConfigTableData: {
        authentication: '',
        project: '',
        domain: '',
        username: '',
        password: '',
        interval: '',
      },
      selectedService: [],
      configScript: '',
      inputConfigScript: '',
    })

    notify(notifyConfigFileReadFailed(tomlParsingErrorMessage))
  }

  public getInputPlugins = configObject => {
    const {focusedCollectorConfigTab} = this.state
    const cloudInputPlugins = configObject['inputs'][focusedCollectorConfigTab]

    if (cloudInputPlugins === undefined) {
      let error = new Error(
        `${focusedCollectorConfigTab.toUpperCase()} Plugin is not found`
      )
      error.name = 'PluginNotFound'

      throw error
    }

    const cloudInputPlugin = cloudInputPlugins[0]

    return {
      authentication: cloudInputPlugin?.authentication_endpoint,
      project: cloudInputPlugin?.project,
      domain: cloudInputPlugin?.domain,
      username: cloudInputPlugin?.username,
      password: cloudInputPlugin?.password,
      interval: cloudInputPlugin?.interval,
      enabledService: cloudInputPlugin?.enabled_services,
    }
  }

  public handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const {value, name} = e.target

    this.setState(prevState => {
      const update = {[name]: value}

      return {
        collectorConfigTableData: {
          ...prevState.collectorConfigTableData,
          ...update,
        },
      }
    })
  }

  public handleUpdateEnableServices = (enabledServices: string[]): void => {
    this.setState({selectedService: enabledServices})
  }

  public handleTabClick = (
    selectedCollectorConfigTab: CollectorConfigTabName
  ) => () => {
    const {notify} = this.props
    const {focusedMinion} = this.state

    if (focusedMinion === '') {
      notify(notifyMinionNotSelected())
      return
    }

    this.setState({
      focusedTenant: '',
      collectorConfigTableData: {
        authentication: '',
        project: '',
        domain: '',
        username: '',
        password: '',
        interval: '',
      },
      selectedService: [],
      focusedCollectorConfigTab: selectedCollectorConfigTab,
      serviceConfigStatus: RemoteDataState.Loading,
      configScript: '',
      inputConfigScript: '',
    })

    try {
      this.getProjectFileList(selectedCollectorConfigTab)
    } catch (error) {
      this.notifyGetProjectFileError(error)
    }
  }

  public getProjectFileList = async selectedCollectorConfigTab => {
    const {saltMasterUrl, saltMasterToken} = this.props
    const {focusedMinion} = this.state
    const agentTenantDirectory = path.join(
      AGENT_TENANT_DIRECTORY.DIR,
      AGENT_TENANT_CLOUD_DIRECTORY[selectedCollectorConfigTab]
    )

    const projectFileList: AgentDirFile = await this.getLocalSaltCmdDirectoryData(
      saltMasterUrl,
      saltMasterToken,
      focusedMinion,
      agentTenantDirectory
    )

    this.setState({
      projectFileList: projectFileList,
      serviceConfigStatus: RemoteDataState.Done,
    })
  }

  public notifyGetProjectFileError(error) {
    const {notify} = this.props

    this.setState({
      focusedMinion: '',
      focusedTenant: '',
      collectorConfigTableData: {
        authentication: '',
        project: '',
        domain: '',
        username: '',
        password: '',
        interval: '',
      },
      selectedService: [],
      projectFileList: {files: [], isLoading: true},
      serviceConfigStatus: RemoteDataState.Done,
      configScript: '',
      inputConfigScript: '',
    })

    notify(notifyGetProjectFileFailed(error))
  }

  render() {
    const {
      isUserAuthorized,
      minionsObject,
      collectorConfigTableTabs,
    } = this.props

    const {
      serviceConfigStatus,
      focusedMinion,
      focusedTenant,
      isCollectorInstalled,
      projectFileList,
      collectorConfigTableData,
      focusedCollectorConfigTab,
      selectedService,
      configScript,
      inputConfigScript,
      configEditStyle,
    } = this.state

    return (
      <>
        {isUserAuthorized ? (
          <div className="service-config_wrap">
            <div className="service-config-table__container">
              <div
                className="service-config-table__content"
                style={{height: '35%'}}
              >
                <ServiceConfigCollectorService
                  minions={_.values(minionsObject)}
                  serviceConfigStatus={serviceConfigStatus}
                  focusedMinion={focusedMinion}
                  isCollectorInstalled={isCollectorInstalled}
                  onClickTableRow={this.handleClickMinionTableRow}
                />
              </div>
              <div
                className="service-config-table__content"
                style={{height: '52%', paddingTop: '10%'}}
              >
                <ServiceConfigTenant
                  projectFileList={projectFileList}
                  serviceConfigStatus={serviceConfigStatus}
                  focusedMinion={focusedMinion}
                  focusedTenant={focusedTenant}
                  isCollectorInstalled={isCollectorInstalled}
                  focusedCollectorConfigTab={focusedCollectorConfigTab}
                  onClickTableRow={this.handleClickTenantTableRow}
                />
              </div>
            </div>
            <div className="service-config-collector__container">
              <CollectorConfig
                inputConfigScript={inputConfigScript}
                configScript={configScript}
                configEditStyle={configEditStyle}
                collectorConfigTableTabs={collectorConfigTableTabs}
                serviceConfigStatus={serviceConfigStatus}
                isCollectorInstalled={isCollectorInstalled}
                collectorConfigTableData={collectorConfigTableData}
                focusedCollectorConfigTab={focusedCollectorConfigTab}
                selectedService={selectedService}
                handleTabClick={this.handleTabClick}
                handleInputChange={this.handleInputChange}
                handleUpdateEnableServices={this.handleUpdateEnableServices}
                handleSaveClick={this.handleSaveClick}
                handleClickConfigEditStyle={this.handleClickConfigEditStyle}
                handleBeforeChangeScript={this.handleBeforeChangeScript}
                handleChangeScript={this.handleChangeScript}
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
}

const mstp = ({adminCloudHub: {organizations}, auth: {me}}) => ({
  organizations,
  me,
})

const mdtp = {
  notify: notifyAction,
  getLocalFileRead: getLocalFileReadAsync,
  getLocalFileWrite: getLocalFileWriteAsync,
  getLocalSaltCmdDirectory: getLocalSaltCmdDirectoryAsync,
}

export default connect(mstp, mdtp)(ServiceConfig)
