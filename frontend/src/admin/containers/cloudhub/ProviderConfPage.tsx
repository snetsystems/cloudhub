// libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import * as TOML from '@iarna/toml'
import uuid from 'uuid'
import _ from 'lodash'
import {AxiosResponse} from 'axios'

// apis
import {setRunnerFileRemoveApi} from 'src/hosts/apis'

// actions
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  deleteCloudServiceProviderAsync,
  getCSPListInstancesAsync,
  loadCloudServiceProvidersAsync,
  writeCSPConfigAsync,
  writeCSPKeyAsync,
} from 'src/hosts/actions'
import {
  getLocalFileWriteAsync,
  getMinionKeyListAllAdminAsync,
  runLocalServiceReStartTelegrafAsync,
} from 'src/agent_admin/actions'

// types
import {
  Links,
  Notification,
  NotificationFunc,
  RemoteDataState,
  Source,
} from 'src/types'
import {CSPData, OpenStackCspInput} from 'src/types/providerConf'
import {Addon} from 'src/types/auth'
import {CSPFileWriteParam} from 'src/hosts/types'
import {MinionsObject} from 'src/agent_admin/type'
import {
  createCloudServiceProviderAsync,
  updateCloudServiceProviderAsync,
} from 'src/admin/actions/cloudhub'

// components
import {ErrorHandling} from 'src/shared/decorators/errors'
import {
  notifygetCSPConfigFailed,
  notifyRequiredFailed,
} from 'src/shared/copy/notifications'
import {ProviderOpenStackConfigs} from 'src/admin/components/cloudhub/ProviderOpenStackConfigs'

// constants
import {HandleType, ProviderTypes} from 'src/admin/constants/providerConf'
import {AddonType} from 'src/shared/constants'

// utils
import {isRequiredCheck} from 'src/admin/utils/conf'

interface Props {
  meCurrentOrganization: {id: string; name: string}
  source: Source
  sources: Source[]
  meRole: string
  notify: (message: Notification | NotificationFunc) => void
  handleLoadCspsAsync: () => Promise<any>
  handleWriteCspConfig: (
    saltMasterUrl: string,
    saltMasterToken: string,
    fileWrite: CSPFileWriteParam
  ) => Promise<any>
  handleWriteCspKey: (
    saltMasterUrl: string,
    saltMasterToken: string,
    fileWrite: CSPFileWriteParam
  ) => Promise<any>
  handleGetCSPListInstancesAsync: (
    saltMasterUrl: string,
    saltMasterToken: string,
    pCsp: any[]
  ) => Promise<any>
  handleCreateCspAsync: (data) => Promise<any>
  handleUpdateCspAsync: (data) => Promise<any>
  handleDeleteCspAsync: (id: string) => Promise<any>
  runLocalServiceReStartTelegraf: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string
  ) => Promise<AxiosResponse>
  getLocalFileWrite: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minion: string,
    script: string,
    path?: string
  ) => Promise<AxiosResponse>
  handleGetMinionKeyListAll: (
    saltMasterUrl: string,
    saltMasterToken: string,
    source: Source,
    meRole: string
  ) => Promise<MinionsObject>
  addons: Addon[]
  links: Links
}

interface State {
  isLoading: boolean
  cspTabs: string[]
  focusedTab: string
  cspInput: OpenStackCspInput | object
  providerPageStatus: RemoteDataState
  saltMasterUrl: string
  saltMasterToken: string
}

@ErrorHandling
export class ProviderConfPage extends PureComponent<Props, State> {
  private isComponentMounted: boolean = true
  private confPath = `${
    _.get(
      _.find(
        this.props.links.addons,
        addon => addon.name === 'salt-config-path'
      ),
      'url'
    ) || '/etc/salt/'
  }cloud.providers.d/`
  private telegrafConfigPath = '/etc/telegraf/telegraf.d/'

  constructor(props: Props) {
    super(props)

    const addOnCsp = _.values(
      _.filter(ProviderTypes, (_value, key) => {
        return (
          _.get(
            _.find(this.props.links.addons, addon => addon.name === key),
            'url',
            'off'
          ) === 'on'
        )
      })
    )

    this.state = {
      isLoading: true,
      cspTabs: [...addOnCsp],
      focusedTab: null,
      cspInput: {},
      providerPageStatus: RemoteDataState.NotStarted,
      saltMasterUrl: '',
      saltMasterToken: '',
    }

    this.setState = (args, callback) => {
      if (!this.isComponentMounted) return
      PureComponent.prototype.setState.bind(this)(args, callback)
    }

    this.handleClickTab = this.handleClickTab.bind(this)
    this.handleSubmit = this.handleSubmit.bind(this)
  }

  public async componentWillMount() {
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token

    this.setState({
      saltMasterUrl: saltMasterUrl,
      saltMasterToken: saltMasterToken,
    })
  }
  public UNSAFE_componentWillMount() {}

  public async componentDidMount() {
    const {focusedTab} = this.state

    if (!focusedTab) {
      const getFocusedTab = ProviderTypes.osp
      const focusedInputs = await this.getFocusedInputs(getFocusedTab)
      this.setState({
        focusedTab: ProviderTypes.osp,
        cspInput: focusedInputs,
        providerPageStatus: RemoteDataState.Done,
      })
    }
  }
  public async componentDidUpdate(
    _prevProps: Readonly<Props>,
    prevState: Readonly<State>
  ) {
    const {focusedTab: preFocusedTab} = prevState
    const {focusedTab} = this.state
    if (preFocusedTab && preFocusedTab !== focusedTab) {
      const focusedInputs = await this.getFocusedInputs(focusedTab)
      this.setState({
        cspInput: focusedInputs,
      })
    }
  }

  public componentWillUnmount() {
    this.isComponentMounted = false
  }

  public render() {
    return (
      <div className="provider-conf-wrap">
        {this.renderTabNav}
        {this.renderTab}
      </div>
    )
  }
  private get renderTabNav(): JSX.Element {
    const {cspTabs, focusedTab} = this.state
    return (
      <div className="provider-conf-csp">
        <div className="col-md-2 subsection--nav" data-test="subsectionNav">
          <div className="subsection--tabs">
            {_.map(cspTabs, tabNav => (
              <div
                onClick={this.handleClickTab}
                key={uuid.v4()}
                className={`subsection--tab ${
                  tabNav === focusedTab ? 'active' : ''
                }`}
                data-csp={tabNav}
              >
                {tabNav}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  private get renderTab(): JSX.Element {
    const {focusedTab, cspInput, providerPageStatus} = this.state
    switch (focusedTab) {
      case ProviderTypes.osp:
        return (
          <ProviderOpenStackConfigs
            onHandleSubmit={this.handleSubmit(ProviderTypes.osp)}
            cspInput={cspInput as OpenStackCspInput}
            pageStatus={providerPageStatus}
          />
        )

      default:
        return (
          <ProviderOpenStackConfigs
            onHandleSubmit={this.handleSubmit(ProviderTypes.osp)}
            cspInput={cspInput as OpenStackCspInput}
            pageStatus={providerPageStatus}
          />
        )
    }
  }
  private handleClickTab({target}) {
    this.setState({focusedTab: target.getAttribute('data-csp')})
  }

  private handleSubmit = (section: string) => async (
    properties: Record<string, string>,
    handleType: string
  ): Promise<void> => {
    const {runLocalServiceReStartTelegraf} = this.props
    const {saltMasterUrl, saltMasterToken} = this.state
    const {minion} = properties
    this.setState({providerPageStatus: RemoteDataState.Loading})

    switch (handleType) {
      case HandleType.Save: {
        await this.writeConfFile(properties, section)
        break
      }
      case HandleType.Update: {
        await this.updateConfFile(properties, section)
        break
      }
      case HandleType.Delete: {
        await this.deleteConfFile(properties, section)
        break
      }
    }

    await runLocalServiceReStartTelegraf(saltMasterUrl, saltMasterToken, minion)
    this.setState({providerPageStatus: RemoteDataState.Done})
  }

  private writeConfFile = async (properties, section) => {
    const {saltMasterUrl, saltMasterToken} = this.state
    const {
      handleWriteCspConfig,
      handleCreateCspAsync,
      handleUpdateCspAsync,
      notify,
      getLocalFileWrite,
      runLocalServiceReStartTelegraf,
    } = this.props

    switch (section) {
      case ProviderTypes.osp: {
        try {
          const {
            id,
            projectName,
            authUrl,
            userName,
            password,
            projectDomain,
            userDomain,
            minion,
          } = properties as OpenStackCspInput

          const requiredCheck = isRequiredCheck(properties, section)

          if (!_.isNull(requiredCheck)) {
            notify(notifyRequiredFailed(requiredCheck))
            this.setState({cspInput: properties})
            return
          }

          const saltStackProviderConfig = `osp_${projectName.trim()}.conf`

          const script = `
${projectName.trim()}:
  driver: openstack
  region_name: RegionOne
  auth:
    username: ${userName}
    password: ${password}
    project_name: ${projectName.trim()}
    user_domain_name: ${userDomain}
    project_domain_name: ${projectDomain}
    auth_url: ${authUrl}`

          const saltConfig = {
            path: this.confPath,
            fileName: saltStackProviderConfig,
            script,
          }

          const cspSaltConfigRes = await handleWriteCspConfig(
            saltMasterUrl,
            saltMasterToken,
            saltConfig
          )

          if (!cspSaltConfigRes) {
            notify(notifygetCSPConfigFailed())
            throw new Error(notifygetCSPConfigFailed().message)
          }

          const saltPlugin = TOML.parse(`
          [[outputs.influxdb]]
          urls = [ "http://influxdb:8086" ]
          database = "${projectName.trim()}"
          [outputs.influxdb.tagpass]
            tenant = "${projectName.trim()}"
        
          [[inputs.openstack]]
          interval = "2m"
          authentication_endpoint = "http://openstack:5000/v3"
          enabled_services = ["servers","projects"]
          domain = "default"
          project = "${projectName.trim()}"
          username = "${userName}"
          password = "${password}"
          server_diagnotics = true
          [inputs.openstack.tags]
            tenant="${projectName.trim()}"
          `)
          const stringifyToML = TOML.stringify(saltPlugin)
          const telelgrafConf = stringifyToML
          const telelgrafConfPath = `${
            this.telegrafConfigPath + 'tenant/osp_' + projectName.trim()
          }.conf`

          const focusedHost = minion
          const telegrafConfigRes = await getLocalFileWrite(
            saltMasterUrl,
            saltMasterToken,
            focusedHost,
            telelgrafConf,
            telelgrafConfPath
          )

          if (!telegrafConfigRes) {
            notify(notifygetCSPConfigFailed())
            throw new Error(notifygetCSPConfigFailed().message)
          }

          await runLocalServiceReStartTelegraf(
            saltMasterUrl,
            saltMasterToken,
            focusedHost
          )

          const etcdData = {
            provider: 'osp',
            namespace: projectName.trim(),
            accesskey: userName,
            secretkey: password,
            authurl: authUrl,
            projectdomain: projectDomain,
            userdomain: userDomain,
          }
          let dbResp = null
          if (!id) {
            dbResp = await handleCreateCspAsync(etcdData)
          } else {
            const updateData = {
              ...etcdData,
              id: id,
            }
            dbResp = await handleUpdateCspAsync(updateData)
          }

          this.setState({
            cspInput: {
              ...properties,
              prevProjectName: projectName.trim(),
              disabled: true,
              id: dbResp.id,
            },
          })
        } catch (error) {
          console.log(error)
        }
        return
      }
    }
  }
  private updateConfFile = async (properties: object, section: string) => {
    try {
      switch (section) {
        case ProviderTypes.osp: {
          await this.writeConfFile(properties, section)
          const {saltMasterUrl, saltMasterToken} = this.state
          const {prevProjectName} = properties as OpenStackCspInput

          const saltConfFileName = `${
            this.confPath + 'osp_' + prevProjectName.trim()
          }.conf`
          const telelgrafConfFileName = `${
            this.telegrafConfigPath + 'tenant/osp_' + prevProjectName.trim()
          }.conf`

          await setRunnerFileRemoveApi(saltMasterUrl, saltMasterToken, [
            saltConfFileName,
            telelgrafConfFileName,
          ])
        }
      }
    } catch (error) {
      console.log(error)
    }
  }
  private deleteConfFile = async (properties: object, section: string) => {
    const {handleDeleteCspAsync} = this.props
    const {saltMasterUrl, saltMasterToken} = this.state

    try {
      switch (section) {
        case ProviderTypes.osp: {
          const {id, prevProjectName} = properties as OpenStackCspInput

          try {
            const saltConfFileName = `${
              this.confPath + 'osp_' + prevProjectName.trim()
            }.conf`
            const telelgrafConfFileName = `${
              this.telegrafConfigPath + 'tenant/osp_' + prevProjectName.trim()
            }.conf`

            const deleteConfFileRes = await setRunnerFileRemoveApi(
              saltMasterUrl,
              saltMasterToken,
              [saltConfFileName, telelgrafConfFileName]
            )

            if (deleteConfFileRes) {
              await handleDeleteCspAsync(id)
              this.setState({
                cspInput: {},
              })
            }
          } catch (error) {
            console.error(error)
          }
          break
        }
      }
    } catch (error) {
      console.log(error)
    }
  }

  private getCurrentCspData = async provider => {
    const {meCurrentOrganization, handleLoadCspsAsync} = this.props
    try {
      const dbResp: any[] = await handleLoadCspsAsync()

      const cspData = _.filter(dbResp, csp => {
        if (
          csp.provider == provider &&
          csp.organization == meCurrentOrganization.id
        ) {
          return csp
        }
      })[0] as CSPData

      return cspData
    } catch (error) {
      return {} as Partial<CSPData>
    }
  }
  private getFocusedInputs = async (section: string): Promise<object> => {
    switch (section) {
      case ProviderTypes.osp: {
        try {
          const {
            id,
            namespace,
            authurl,
            accesskey,
            secretkey,
            projectdomain,
            userdomain,
            minion,
          } = await this.getCurrentCspData('osp')

          if (!id) {
            return {
              id: '',
              projectName: '',
              authUrl: '',
              userName: '',
              password: '',
              projectDomain: '',
              prevProjectName: '',
              userDomain: '',
              minion: '',
              disabled: false,
            }
          }

          return {
            id: id,
            projectName: namespace,
            authUrl: authurl,
            userName: accesskey,
            password: secretkey,
            projectDomain: projectdomain,
            prevProjectName: namespace,
            userDomain: userdomain,
            minion: minion,
            disabled: true,
          }
        } catch (error) {
          return {}
        }
      }

      default: {
        return {}
      }
    }
  }
}

const mstp = ({
  adminCloudHub: {organizations},
  auth: {me},
  links: {addons},
  links,
  sources,
  source: {sourceID},
}) => {
  const meRole = _.get(me, 'role', null)
  const meSource = sources.find((s: Source) => s.id == sourceID)

  return {
    organizations,
    me,
    addons,
    links,
    sources,
    meRole,
    source: meSource,
  }
}

const mdtp = {
  notify: notifyAction,
  handleLoadCspsAsync: loadCloudServiceProvidersAsync,
  handleWriteCspConfig: writeCSPConfigAsync,
  handleWriteCspKey: writeCSPKeyAsync,
  handleGetCSPListInstancesAsync: getCSPListInstancesAsync,
  handleCreateCspAsync: createCloudServiceProviderAsync,
  handleUpdateCspAsync: updateCloudServiceProviderAsync,
  handleDeleteCspAsync: deleteCloudServiceProviderAsync,
  getLocalFileWrite: getLocalFileWriteAsync,
  runLocalServiceReStartTelegraf: runLocalServiceReStartTelegrafAsync,
  handleGetMinionKeyListAll: getMinionKeyListAllAdminAsync,
}
export default connect(mstp, mdtp)(ProviderConfPage)
