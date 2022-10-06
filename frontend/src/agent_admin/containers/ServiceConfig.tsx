// Libraries
import React, {ChangeEvent, PureComponent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import {AxiosResponse} from 'axios'
import * as TOML from '@iarna/toml'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// Actions
import {
  getLocalFileReadAsync,
  getLocalFileWriteAsync,
  getLocalSaltCmdDirectoryAsync,
  runLocalServiceReStartTelegrafAsync,
} from 'src/agent_admin/actions'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  notifyAgentApplySucceeded,
  notifyConfigFileSaveFailed,
  notifyConfigFileReadFailed,
  notifyGetProjectFileFailed,
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
  GetAgentDirectoryInfo,
  MinionsObject,
} from 'src/agent_admin/type'

// Constants
import {
  AGENT_TENANT_DIRECTORY,
  GET_STATUS,
  NETWORK_ACCESS,
} from 'src/agent_admin/constants'

// Components
import CollectorConfig from 'src/agent_admin/components/CollectorConfig'
import ServiceConfigCollectorService from 'src/agent_admin/components/ServiceConfigCollectorService'
import ServiceConfigTenant from 'src/agent_admin/components/ServiceConfigTenant'

interface Props {
  isUserAuthorized: boolean
  saltMasterUrl: string
  saltMasterToken: string
  me: Me
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
  runLocalServiceReStartTelegraf: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string
  ) => Promise<AxiosResponse>
}

interface State {
  isCollectorInstalled: boolean
  configScript: string
  focusedMinion: string
  focusedTenant: string
  activeSection: string
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
      activeSection: 'openstack',
      configScript: '',
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
    })

    try {
      this.getProjectFileList(selectedMinion)
    } catch (error) {
      this.notifyGetProjectFileError(error)
    }
  }

  public notifyGetProjectFileError(error) {
    const {notify} = this.props

    this.setState({
      serviceConfigStatus: RemoteDataState.Done,
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
    })

    notify(notifyGetProjectFileFailed(error))
  }

  public getProjectFileList = async selectedMinion => {
    const {saltMasterUrl, saltMasterToken} = this.props

    const projectFileList: AgentDirFile = await this.getLocalSaltCmdDirectoryData(
      saltMasterUrl,
      saltMasterToken,
      selectedMinion,
      AGENT_TENANT_DIRECTORY.FULL_DIR
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
          applications = getData.split('\n').map((item: string) => {
            const time: string = item.substring(0, item.indexOf(' '))
            const tenant = item.substring(item.indexOf(' ') + 1).split('.')[0]
            return this.generatorFileInfo({time, item: tenant, fullDir})
          })
        } else {
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

  public handleSaveClick = () => {
    const {notify} = this.props
    const {focusedTenant} = this.state

    if (focusedTenant === '') {
      notify(notifyConfigFileSaveFailed())
      return
    }

    this.writeLocalFile()
  }

  public writeLocalFile() {
    const {
      saltMasterUrl,
      saltMasterToken,
      getLocalFileWrite,
      notify,
      runLocalServiceReStartTelegraf,
    } = this.props
    const {focusedMinion, focusedTenant} = this.state
    const configScript = this.updateCollectorConfigTableData()
    const tenantConfigDirectory = `${AGENT_TENANT_DIRECTORY.FULL_DIR}${focusedTenant}.conf`

    const getLocalFileWritePromise = getLocalFileWrite(
      saltMasterUrl,
      saltMasterToken,
      focusedMinion,
      configScript,
      tenantConfigDirectory
    )

    this.setState({
      serviceConfigStatus: RemoteDataState.Loading,
    })

    getLocalFileWritePromise
      .then((): void => {
        const getLocalServiceReStartTelegrafPromise = runLocalServiceReStartTelegraf(
          saltMasterUrl,
          saltMasterToken,
          focusedMinion
        )

        getLocalServiceReStartTelegrafPromise
          .then(() => {
            this.setState({
              serviceConfigStatus: RemoteDataState.Done,
              configScript: configScript,
            })

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

  public updateCollectorConfigTableData() {
    const {
      collectorConfigTableData,
      activeSection,
      configScript,
      selectedService,
    } = this.state
    const configObj = TOML.parse(configScript)
    const inputPlugins = configObj?.['inputs']?.[activeSection]?.[0]

    inputPlugins.authentication_endpoint =
      collectorConfigTableData.authentication
    inputPlugins.project = collectorConfigTableData.project
    inputPlugins.domain = collectorConfigTableData.domain
    inputPlugins.username = collectorConfigTableData.username
    inputPlugins.password = collectorConfigTableData.password
    inputPlugins.interval = collectorConfigTableData.interval
    inputPlugins.enabled_services = selectedService

    return TOML.stringify(configObj)
  }

  public handleClickTenantTableRow = selectedTenant => () => {
    this.readLocalFile(selectedTenant)
  }

  public readLocalFile(selectedTenant) {
    const {saltMasterUrl, saltMasterToken, getLocalFileRead} = this.props
    const {focusedMinion} = this.state
    const tenantConfigDirectory = `${AGENT_TENANT_DIRECTORY.FULL_DIR}${selectedTenant}.conf`

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

        this.setState({
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
    const tomlParsingErrorMessage = `Parsing error on line ${error.line} column ${error.col}: ${error.message}`

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
    })

    notify(notifyConfigFileReadFailed(tomlParsingErrorMessage))
  }

  public getInputPlugins = configObject => {
    const {activeSection} = this.state
    const inputPlugins = configObject?.['inputs']?.[activeSection]?.[0]

    return {
      authentication: inputPlugins?.authentication_endpoint,
      project: inputPlugins?.project,
      domain: inputPlugins?.domain,
      username: inputPlugins?.username,
      password: inputPlugins?.password,
      interval: inputPlugins?.interval,
      enabledService: inputPlugins?.enabled_services,
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

  public handleTabClick = selectedSection => () => {
    this.setState({activeSection: selectedSection.toLowerCase()})
  }

  render() {
    const {isUserAuthorized, minionsObject} = this.props
    const {
      serviceConfigStatus,
      focusedMinion,
      focusedTenant,
      isCollectorInstalled,
      projectFileList,
      collectorConfigTableData,
      activeSection,
      selectedService,
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
                  onClickTableRow={this.handleClickTenantTableRow}
                />
              </div>
            </div>
            <div className="service-config-collector__container">
              <CollectorConfig
                serviceConfigStatus={serviceConfigStatus}
                isCollectorInstalled={isCollectorInstalled}
                collectorConfigTableData={collectorConfigTableData}
                activeSection={activeSection}
                selectedService={selectedService}
                handleTabClick={this.handleTabClick}
                handleInputChange={this.handleInputChange}
                handleUpdateEnableServices={this.handleUpdateEnableServices}
                handleSaveClick={this.handleSaveClick}
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
  runLocalServiceReStartTelegraf: runLocalServiceReStartTelegrafAsync,
}

export default connect(mstp, mdtp)(ServiceConfig)
