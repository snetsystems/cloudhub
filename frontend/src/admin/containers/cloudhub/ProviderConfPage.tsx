// libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import * as TOML from '@iarna/toml'
import uuid from 'uuid'
import _ from 'lodash'
import path from 'path'

// apis
import {setRunnerFileRemoveApi} from 'src/hosts/apis'
import {
  runServicePluginTestTelegrafByRunner,
  runServiceReLoadTelegrafByRunner,
} from 'src/shared/apis/saltStack'

// actions
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  deleteCloudServiceProviderAsync,
  getCSPListInstancesAsync,
  getRunnerFileReadAsync,
  loadCloudServiceProvidersAsync,
  writeCSPConfigAsync,
  writeCSPKeyAsync,
} from 'src/hosts/actions'
import {
  createCloudServiceProviderAsync,
  updateCloudServiceProviderAsync,
} from 'src/admin/actions/cloudhub'

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

// components
import {ErrorHandling} from 'src/shared/decorators/errors'
import {
  notifyCreateProviderConf,
  notifyDeleteProviderConf,
  notifyError,
  notifyExceptionRunner,
  notifygetCSPConfigFailed,
  notifyUpdateProviderConf,
} from 'src/shared/copy/notifications'
import {ProviderOpenStackConfigs} from 'src/admin/components/cloudhub/ProviderOpenStackConfigs'
import PageSpinner from 'src/shared/components/PageSpinner'

// constants
import {
  ADMIN_TENANT_DIRECTORY,
  HandleType,
  ProviderTypes,
} from 'src/admin/constants/providerConf'
import {AddonType} from 'src/shared/constants'

// utils
import {valiDationCheck} from 'src/admin/utils/conf'
import {cryptoJSAESdecrypt, cryptoJSAESencrypt} from 'src/hosts/utils'

interface Props {
  meCurrentOrganization: {id: string; name: string}
  cspProviders: string[]
  source: Source
  sources: Source[]
  meRole: string
  notify: (message: Notification | NotificationFunc) => void
  handleLoadCspsAsync: () => Promise<any>
  handleWriteConfig: (
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
  handleGetRunnerFileReadAsync: (
    saltMasterUrl: string,
    saltMasterToken: string,
    filePath: string[]
  ) => Promise<any>
  addons: Addon[]
  links: Links
}

interface State {
  isLoading: boolean
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

  private telegrafConfigPath = ADMIN_TENANT_DIRECTORY.DIR

  private secretKey = _.find(
    this.props.links.addons,
    addon => addon.name === AddonType.ipmiSecretKey
  )
  private defaultProperties = {
    [ProviderTypes.OpenStack]: {
      id: '',
      projectName: '',
      prevProjectName: '',
      authUrl: '',
      userName: '',
      password: '',
      projectDomain: 'default',
      userDomain: 'default',
      minion: '',
      disabled: false,
    },
  }
  constructor(props: Props) {
    super(props)

    this.state = {
      isLoading: true,
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

  public async componentDidMount() {
    const {focusedTab} = this.state

    if (!focusedTab) {
      const getFocusedTab = ProviderTypes.OpenStack
      const focusedInputs = await this.getFocusedInputs(getFocusedTab)
      this.setState({
        focusedTab: ProviderTypes.OpenStack,
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
    const {providerPageStatus} = this.state
    if (providerPageStatus === RemoteDataState.NotStarted) {
      return this.LoadingState
    }

    return (
      <div className="provider-conf-wrap">
        {this.renderTabNav}
        {this.renderTab}
      </div>
    )
  }

  private get LoadingState(): JSX.Element {
    return <PageSpinner />
  }

  private get renderTabNav(): JSX.Element {
    const {cspProviders} = this.props
    const {focusedTab} = this.state
    return (
      <div className="provider-conf-csp">
        <div className="col-md-2 subsection--nav" data-test="subsectionNav">
          <div className="subsection--tabs">
            {_.map(cspProviders, tabNav => (
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
      case ProviderTypes.OpenStack:
        return (
          <ProviderOpenStackConfigs
            onHandleSubmit={this.handleSubmit(ProviderTypes.OpenStack)}
            cspInput={cspInput as OpenStackCspInput}
            pageStatus={providerPageStatus}
          />
        )

      default:
        return (
          <ProviderOpenStackConfigs
            onHandleSubmit={this.handleSubmit(ProviderTypes.OpenStack)}
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
    const {saltMasterUrl, saltMasterToken} = this.state
    const {notify} = this.props
    try {
      this.setState(state => ({
        ...state,
        providerPageStatus: RemoteDataState.Loading,
      }))

      switch (handleType) {
        case HandleType.Save: {
          const invalidProperty = valiDationCheck(properties, section)
          if (!_.isNull(invalidProperty)) {
            notify(invalidProperty)
            this.setState(state => ({
              ...state,
              providerPageStatus: RemoteDataState.Done,
            }))
            return
          }
          await this.writeConfFile(properties, section)
          break
        }
        case HandleType.Update: {
          const invalidProperty = valiDationCheck(properties, section)
          if (!_.isNull(invalidProperty)) {
            notify(invalidProperty)
            this.setState(state => ({
              ...state,
              providerPageStatus: RemoteDataState.Done,
            }))
            return
          }
          await this.updateConfFile(properties, section)

          break
        }
        case HandleType.Delete: {
          await this.deleteConfFile(properties, section)
          break
        }
      }

      const reloadResult = await runServiceReLoadTelegrafByRunner(
        saltMasterUrl,
        saltMasterToken
      )

      if (reloadResult.data.return[0] !== true) {
        throw new Error('telegraf Reload Failed')
      }
      this.setState(state => ({
        ...state,
        providerPageStatus: RemoteDataState.Done,
      }))

      this.submitSuccessNotify(section, handleType)
    } catch (error) {
      if (error.message) {
        notify(notifyError(error.message))
      } else {
        notify(notifyExceptionRunner())
      }

      this.setState(state => ({
        ...state,
        providerPageStatus: RemoteDataState.Done,
      }))
    }
  }

  private writeConfFile = async (properties, section) => {
    const {saltMasterUrl, saltMasterToken} = this.state
    const {handleWriteConfig, handleCreateCspAsync, notify} = this.props

    switch (section) {
      case ProviderTypes.OpenStack: {
        try {
          const {
            projectName,
            authUrl,
            userName,
            password,
            projectDomain,
            userDomain,
          } = properties as OpenStackCspInput

          const telegrafPlugin = TOML.parse(`
          [[outputs.influxdb]]
          urls = [ 'http://10.20.2.51:8086' ]
          database = '${projectName.trim()}'

          [outputs.influxdb.tagpass]
            tenant = ['${projectName.trim()}']

          [[inputs.openstack]]
          interval = '2m'
          authentication_endpoint = '${authUrl}'
          enabled_services = ['servers','projects']
          domain = '${projectDomain}'
          project = '${projectName.trim()}'
          username = '${userName}'
          password = '${password}'
          server_diagnotics = true
          
          [inputs.openstack.tags]
            tenant='${projectName.trim()}'`)

          const telelgrafConfigScript = TOML.stringify(telegrafPlugin)

          const telegrafScript = {
            path: this.getTelegrafPath('osp'),
            fileName: `${projectName.trim()}.conf`,
            script: telelgrafConfigScript,
          }
          const telegrafConfig = await handleWriteConfig(
            saltMasterUrl,
            saltMasterToken,
            telegrafScript
          )

          if (!telegrafConfig) {
            notify(notifygetCSPConfigFailed())
            throw new Error(notifygetCSPConfigFailed().message)
          }

          await this.telegrafPluginTest({
            namespace: projectName,
            plugin: 'openstack',
          })

          const saltStackProviderConfig = `osp_${projectName.trim()}.conf`

          const script = `${projectName.trim()}:
  driver: openstack
  region_name: RegionOne
  auth:
    username: '${userName}'
    password: '${password}'
    project_name: '${projectName.trim()}'
    user_domain_name: ${userDomain}
    project_domain_name: ${projectDomain}
    auth_url: '${authUrl}'`

          const saltConfigScript = {
            path: this.confPath,
            fileName: saltStackProviderConfig,
            script,
          }

          const saltConfig = handleWriteConfig(
            saltMasterUrl,
            saltMasterToken,
            saltConfigScript
          )

          const etcdData = {
            provider: 'osp',
            namespace: projectName.trim(),
            accesskey: userName,
            secretkey: cryptoJSAESencrypt(password, this.secretKey.url),
            authurl: authUrl,
            projectdomain: projectDomain,
            userdomain: userDomain,
          }

          const cspConfig = handleCreateCspAsync(etcdData)

          const [saltRes, cspRes] = await Promise.all([saltConfig, cspConfig])

          if (!saltRes || !cspRes) {
            notify(notifygetCSPConfigFailed())
            throw new Error(notifygetCSPConfigFailed().message)
          }

          this.setState(preState => {
            return {
              ...preState,
              cspInput: {
                ...properties,
                password: '*'.repeat(password.length),
                prevProjectName: projectName.trim(),
                disabled: true,
                id: cspRes.id,
              },
            }
          })
        } catch (error) {
          throw error
        }
        return
      }
    }
  }
  private updateConfFile = async (properties: object, section: string) => {
    try {
      switch (section) {
        case ProviderTypes.OpenStack: {
          const {saltMasterUrl, saltMasterToken} = this.state
          const {
            handleWriteConfig,
            handleUpdateCspAsync,
            notify,
            handleGetRunnerFileReadAsync,
          } = this.props

          const {
            id,
            projectName,
            authUrl,
            userName,
            password,
            projectDomain,
            userDomain,
            prevProjectName,
            enCryptPassword,
          } = properties as OpenStackCspInput

          const deCryptPassword = cryptoJSAESdecrypt(
            enCryptPassword,
            this.secretKey.url
          )
          const updatePassword =
            '*'.repeat(deCryptPassword.length) === password
              ? enCryptPassword
              : cryptoJSAESencrypt(password, this.secretKey.url)

          const saltStackProviderConfig = `osp_${projectName.trim()}.conf`
          const script = `${projectName.trim()}:
  driver: openstack
  region_name: RegionOne
  auth:
    username: '${userName}'
    password: '${cryptoJSAESdecrypt(updatePassword, this.secretKey.url)}'
    project_name: '${projectName.trim()}'
    user_domain_name: ${userDomain}
    project_domain_name: ${projectDomain}
    auth_url: '${authUrl}'`

          const saltConfigScript = {
            path: this.confPath,
            fileName: saltStackProviderConfig,
            script,
          }

          const saltConfig = handleWriteConfig(
            saltMasterUrl,
            saltMasterToken,
            saltConfigScript
          )

          const telelgrafConfPath = this.getTelegrafPath(
            'osp',
            `${prevProjectName.trim()}.conf`
          )

          prevProjectName.trim()

          const getSavedTelegrafConfig = await handleGetRunnerFileReadAsync(
            saltMasterUrl,
            saltMasterToken,
            [telelgrafConfPath]
          )

          const localFileReadData = getSavedTelegrafConfig.return[0].substring(
            0,
            getSavedTelegrafConfig.return[0].lastIndexOf('\n')
          )

          const savedTelegrafConfigInput = TOML.parse(localFileReadData)[
            'inputs'
          ]['openstack'][0]

          const savedTelegrafConfigOutput = TOML.parse(localFileReadData)[
            'outputs'
          ]['influxdb'][0]

          const saltPlugin = TOML.parse(`
          [[outputs.influxdb]]
          urls = [ ${_.map(
            savedTelegrafConfigOutput.urls,
            url => `'${url}'`
          ).join()} ]
          database = '${projectName.trim()}'
          [outputs.influxdb.tagpass]
            tenant = ['${projectName.trim()}']
        
          [[inputs.openstack]]
          interval = '${savedTelegrafConfigInput.interval}'
          authentication_endpoint = '${authUrl}'
          enabled_services = [${_.map(
            savedTelegrafConfigInput.enabled_services,
            service => `'${service}'`
          ).join()}]
          domain = '${savedTelegrafConfigInput.domain}'
          project = '${projectName.trim()}'
          username = '${userName}'
          password = '${cryptoJSAESdecrypt(updatePassword, this.secretKey.url)}'
          server_diagnotics = ${savedTelegrafConfigInput.server_diagnotics}
          [inputs.openstack.tags]
            tenant='${projectName.trim()}'
          `)
          const telelgrafConfigScript = TOML.stringify(saltPlugin)

          const telegrafScript = {
            path: this.getTelegrafPath('osp'),
            fileName: `${projectName.trim()}.conf`,
            script: telelgrafConfigScript,
          }

          const telegrafConfig = await handleWriteConfig(
            saltMasterUrl,
            saltMasterToken,
            telegrafScript
          )

          if (!telegrafConfig) {
            throw new Error('telegraf update Failed')
          }

          await this.telegrafPluginTest({
            namespace: projectName,
            plugin: 'openstack',
          })

          const etcdData = {
            provider: 'osp',
            namespace: projectName.trim(),
            accesskey: userName,
            secretkey: updatePassword,
            authurl: authUrl,
            projectdomain: projectDomain,
            userdomain: userDomain,
          }

          const updateData = {
            ...etcdData,
            id: id,
          }

          const cspConfig = handleUpdateCspAsync(updateData)

          const [saltRes, cspRes] = await Promise.all([saltConfig, cspConfig])

          if (!saltRes || !cspRes) {
            notify(notifygetCSPConfigFailed())
            throw new Error(notifygetCSPConfigFailed().message)
          }

          if (prevProjectName !== projectName) {
            const saltConfFileName = path.join(
              this.confPath,
              `${'osp_' + prevProjectName.trim()}.conf`
            )
            const telelgrafConfFileName = this.getTelegrafPath(
              'osp',
              `${prevProjectName.trim()}.conf`
            )
            await setRunnerFileRemoveApi(saltMasterUrl, saltMasterToken, [
              saltConfFileName,
              telelgrafConfFileName,
            ])
          }

          this.setState(prevState => {
            return {
              ...prevState,
              cspInput: {
                ...properties,
                prevProjectName: projectName.trim(),
                disabled: true,
                id: id,
              },
            }
          })
        }
      }
    } catch (error) {
      throw error
    }
  }
  private deleteConfFile = async (properties: object, section: string) => {
    const {saltMasterUrl, saltMasterToken} = this.state
    const {handleDeleteCspAsync} = this.props

    try {
      switch (section) {
        case ProviderTypes.OpenStack: {
          const {id, prevProjectName} = properties as OpenStackCspInput

          try {
            const saltConfFileName = path.join(
              this.confPath,
              `${ProviderTypes.OpenStack + '_' + prevProjectName.trim()}.conf`
            )

            const telelgrafConfFileName = path.join(
              this.telegrafConfigPath,
              `${prevProjectName.trim()}.conf`
            )

            const deleteConfFileRes = await setRunnerFileRemoveApi(
              saltMasterUrl,
              saltMasterToken,
              [saltConfFileName, telelgrafConfFileName]
            )

            const cspDelte = handleDeleteCspAsync(id)
            this.setState({
              cspInput: this.defaultProperties[ProviderTypes.OpenStack],
            })

            await Promise.all([deleteConfFileRes, cspDelte])
          } catch (error) {
            throw error
          }
          break
        }
      }
    } catch (error) {
      throw error
    }
  }
  private telegrafPluginTest = async ({namespace, plugin}) => {
    const {saltMasterUrl, saltMasterToken, focusedTab} = this.state
    const testFilePath = path.join(
      this.getTelegrafPath(focusedTab),
      `${namespace.trim()}.conf`
    )

    const testPlugin = {
      path: testFilePath,
      plugin: plugin,
    }

    const testResult = await runServicePluginTestTelegrafByRunner(
      saltMasterUrl,
      saltMasterToken,
      testPlugin
    )

    if (testResult.includes('E!')) {
      await setRunnerFileRemoveApi(saltMasterUrl, saltMasterToken, [
        testFilePath,
      ])
      throw new Error(
        `${plugin}: unable to authenticate ${plugin} \n Please check your connection information again`
      )
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
      case ProviderTypes.OpenStack: {
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
          } = await this.getCurrentCspData(ProviderTypes.OpenStack)

          return {
            id: id,
            projectName: namespace,
            prevProjectName: namespace,
            authUrl: authurl,
            userName: accesskey,
            password: '*'.repeat(
              cryptoJSAESdecrypt(secretkey, this.secretKey.url).length
            ),
            enCryptPassword: secretkey,
            projectDomain: projectdomain,
            userDomain: userdomain,
            minion: minion,
            disabled: true,
          }
        } catch (error) {
          return this.defaultProperties[ProviderTypes.OpenStack]
        }
      }

      default: {
        return {}
      }
    }
  }
  private submitSuccessNotify = (provider: string, handleType: string) => {
    const {notify} = this.props
    const notifyType = {
      Save: () => {
        notify(notifyCreateProviderConf(provider))
      },
      Update: () => {
        notify(notifyUpdateProviderConf(provider))
      },
      Delete: () => {
        notify(notifyDeleteProviderConf(provider))
      },
    }
    notifyType[handleType]()
  }

  private getTelegrafPath(provider: string, fileName = '') {
    if (fileName) {
      return path.join(this.telegrafConfigPath, provider, fileName)
    } else {
      return path.join(this.telegrafConfigPath, provider)
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
  handleWriteConfig: writeCSPConfigAsync,
  handleWriteCspKey: writeCSPKeyAsync,
  handleGetCSPListInstancesAsync: getCSPListInstancesAsync,
  handleCreateCspAsync: createCloudServiceProviderAsync,
  handleUpdateCspAsync: updateCloudServiceProviderAsync,
  handleDeleteCspAsync: deleteCloudServiceProviderAsync,
  handleGetRunnerFileReadAsync: getRunnerFileReadAsync,
}
export default connect(mstp, mdtp)(ProviderConfPage)
