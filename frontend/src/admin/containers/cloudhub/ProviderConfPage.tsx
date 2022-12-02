// libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import uuid from 'uuid'
import _ from 'lodash'

// actions
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  deleteCloudServiceProviderAsync,
  loadCloudServiceProvidersAsync,
} from 'src/hosts/actions'
import {createCloudServiceProviderAsync} from 'src/admin/actions/cloudhub'

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

// components
import {ErrorHandling} from 'src/shared/decorators/errors'
import {
  notifyCreateProviderConf,
  notifyDeleteProviderConf,
  notifyError,
  notifyExceptionRunner,
  notifygetCSPConfigFailed,
} from 'src/shared/copy/notifications'
import {ProviderOpenStackConfigs} from 'src/admin/components/cloudhub/ProviderOpenStackConfigs'
import PageSpinner from 'src/shared/components/PageSpinner'

// constants
import {HandleType, ProviderTypes} from 'src/admin/constants/providerConf'

interface Props {
  meCurrentOrganization: {id: string; name: string}
  cspProviders: string[]
  source: Source
  sources: Source[]
  notify: (message: Notification | NotificationFunc) => void
  handleLoadCspsAsync: () => Promise<any>
  handleCreateCspAsync: (data) => Promise<any>
  handleDeleteCspAsync: (id: string) => Promise<any>
  addons: Addon[]
  links: Links
}

interface State {
  isLoading: boolean
  focusedTab: string
  cspInput: OpenStackCspInput | object
  providerPageStatus: RemoteDataState
}

@ErrorHandling
export class ProviderConfPage extends PureComponent<Props, State> {
  private isComponentMounted: boolean = true

  private defaultProperties = provider => {
    const storeData = this.props.links.osp
    const convertProperties = {
      [ProviderTypes.OpenStack]: {
        id: '',
        provider: ProviderTypes.OpenStack,
        projectName: this.props.meCurrentOrganization.name,
        authUrl: storeData['auth-url'],
        userName: storeData['admin-user'],
        password: storeData['admin-pw'],
        projectDomain: storeData['pj-domain-id'],
        userDomain: storeData['user-domain-id'],
      },
    }
    return convertProperties[provider]
  }
  constructor(props: Props) {
    super(props)

    this.state = {
      isLoading: true,
      focusedTab: null,
      cspInput: {},
      providerPageStatus: RemoteDataState.NotStarted,
    }

    this.setState = (args, callback) => {
      if (!this.isComponentMounted) return
      PureComponent.prototype.setState.bind(this)(args, callback)
    }

    this.handleClickTab = this.handleClickTab.bind(this)
    this.handleSubmit = this.handleSubmit.bind(this)
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
                  ProviderTypes[tabNav] === focusedTab ? 'active' : ''
                }`}
                data-csp={ProviderTypes[tabNav]}
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
            onHandleSubmit={this.handleSubmit(focusedTab)}
            cspInput={cspInput as OpenStackCspInput}
            pageStatus={providerPageStatus}
          />
        )

      default:
        return (
          <ProviderOpenStackConfigs
            onHandleSubmit={this.handleSubmit(focusedTab)}
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
    const {notify} = this.props
    try {
      this.setState(preState => ({
        ...preState,
        providerPageStatus: RemoteDataState.Loading,
      }))

      switch (handleType) {
        case HandleType.Create: {
          await this.createCsp(properties, section)
          break
        }

        case HandleType.Delete: {
          await this.deleteCsp(properties, section)
          break
        }
      }

      this.setState(preState => ({
        ...preState,
        providerPageStatus: RemoteDataState.Done,
      }))

      this.submitSuccessNotify(section, handleType)
    } catch (error) {
      if (error.message) {
        notify(notifyError(error.message))
      } else {
        notify(notifyExceptionRunner())
      }

      this.setState(preState => ({
        ...preState,
        providerPageStatus: RemoteDataState.Done,
      }))
    }
  }

  private createCsp = async (properties, section) => {
    const {handleCreateCspAsync, notify} = this.props
    switch (section) {
      case ProviderTypes.OpenStack: {
        const {
          projectName,
          authUrl,
          userName,
          password,
          projectDomain,
          userDomain,
        } = properties as OpenStackCspInput

        const etcdData = {
          provider: ProviderTypes.OpenStack,
          namespace: projectName.trim(),
          accesskey: userName,
          secretkey: password,
          authurl: authUrl,
          projectdomain: projectDomain,
          userdomain: userDomain,
        }
        const cspRes = await handleCreateCspAsync(etcdData)

        if (!cspRes) {
          notify(notifygetCSPConfigFailed())
          throw new Error(notifygetCSPConfigFailed().message)
        }

        this.setState(preState => {
          return {
            ...preState,
            cspInput: {
              ...properties,
              id: cspRes.id,
            },
          }
        })
      }
    }
  }

  private deleteCsp = async (properties, section) => {
    const {handleDeleteCspAsync} = this.props
    switch (section) {
      case ProviderTypes.OpenStack: {
        try {
          const cspDelte = await handleDeleteCspAsync(properties.id)
          if (cspDelte.isDelete) {
            this.setState({
              cspInput: this.defaultProperties(ProviderTypes.OpenStack),
            })
          }
        } catch (error) {
          throw error
        }
      }
    }
  }

  private getCurrentCspData = async provider => {
    const {meCurrentOrganization, handleLoadCspsAsync} = this.props

    const dbResp: any[] = await handleLoadCspsAsync()

    const cspData = _.filter(dbResp, csp => {
      if (
        csp.provider == provider &&
        csp.organization == meCurrentOrganization.id
      ) {
        return csp
      }
    })[0] as CSPData

    return cspData?.id || ''
  }

  private getFocusedInputs = async (section: string): Promise<object> => {
    const defaultProperties = this.defaultProperties(section)

    const cspId = await this.getCurrentCspData(section)

    const foucsedInputsProperties = {
      [ProviderTypes.OpenStack]: {
        ...defaultProperties,
        id: cspId,
      } as OpenStackCspInput,
    }

    return foucsedInputsProperties[section]
  }

  private submitSuccessNotify = (provider: string, handleType: string) => {
    try {
      const {notify} = this.props

      const notifyType = {
        [HandleType.Create]: () => {
          notify(
            notifyCreateProviderConf(
              _.findKey(ProviderTypes, value => value == provider)
            )
          )
        },
        [HandleType.Delete]: () => {
          notify(
            notifyDeleteProviderConf(
              _.findKey(ProviderTypes, value => value == provider)
            )
          )
        },
      }
      notifyType[handleType]()
    } catch (error) {
      throw error
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
  const meSource = sources.find((s: Source) => s.id == sourceID)

  return {
    organizations,
    me,
    addons,
    links,
    sources,
    source: meSource,
  }
}

const mdtp = {
  notify: notifyAction,
  handleLoadCspsAsync: loadCloudServiceProvidersAsync,
  handleCreateCspAsync: createCloudServiceProviderAsync,
  handleDeleteCspAsync: deleteCloudServiceProviderAsync,
}
export default connect(mstp, mdtp)(ProviderConfPage)
