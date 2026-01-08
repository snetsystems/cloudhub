import React, {PureComponent} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import WizardCheckbox from 'src/reusable_ui/components/wizard/WizardCheckbox'
import WizardTextInput from 'src/reusable_ui/components/wizard/WizardTextInput'
import {
  createElasticSearchInfo,
  updateElasticSearchInfo,
} from 'src/shared/apis/elasticSearch'
import {
  notifySourceUpdateFailed,
  notifySourceCreationFailed,
} from 'src/shared/copy/notifications'
import {notifySourceConnectionSucceeded} from 'src/shared/copy/notifications'
import {
  BaseElasticSearchData,
  CreateElasticSearchParams,
  Me,
  Organization,
} from 'src/types'
import {NextReturn} from 'src/types/wizard'
import {getDeep} from 'src/utils/wrappers'
import _ from 'lodash'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  connectElasticSearch,
  getElasticSearchInfoAsync,
} from 'src/shared/actions/elasticSearch'

interface Props {
  esSource: CreateElasticSearchParams
  setError: (error: boolean) => void
  createElasticSearchInfo?: (params: CreateElasticSearchParams) => void
  isUsingAuth?: boolean
  me?: Me
  organizations?: Organization[]
  notify?: typeof notifyAction
  updateElasticSearchInfo?: (params: CreateElasticSearchParams) => void
  getElasticSearchInfoAsync?: () => void
  connectElasticSearch?: (params: {
    elasticSearchInfo: BaseElasticSearchData
  }) => void
}
interface State {
  esSource: CreateElasticSearchParams | null
  authToggle: boolean
}

const isNewSource = (source: Partial<CreateElasticSearchParams>) => !source.id

class ElasticStep extends PureComponent<Props, State> {
  public state: State = {
    esSource: {
      url: '',
      name: '',
      authentication: 'unknown',
      basicAuth: null,
      apiKeyAuth: null,
      insecureSkipVerify: true,
      organization: '',
      default: false,
    },
    authToggle: true,
  }

  componentDidMount(): void {
    const {esSource} = this.props
    this.setDefaultOrganization()

    if (!!esSource) {
      if (esSource.authentication === 'basic') {
        this.setState({authToggle: true})
      } else {
        this.setState({authToggle: false})
      }
      this.setState({esSource})
    }
  }

  public next = async (): Promise<NextReturn> => {
    const {esSource, authToggle} = this.state
    const {notify} = this.props

    if (isNewSource(esSource)) {
      if (!this.onSubmitVerify(esSource, authToggle)) {
        return {error: true, payload: null}
      }

      if (authToggle) {
        esSource.authentication = 'basic'
      } else {
        esSource.authentication = 'apiKey'
      }
      try {
        const sourceFromServer = await createElasticSearchInfo(esSource)
        this.connectDefaultEsSource(sourceFromServer)
        await this.props.getElasticSearchInfoAsync()

        notify(notifySourceConnectionSucceeded(esSource.name))
        return {error: false, payload: sourceFromServer}
      } catch (err) {
        notify(notifySourceCreationFailed(esSource.name, this.parseError(err)))
        return {error: true, payload: null}
      }
    } else {
      if (!!esSource.id) {
        if (!esSource.url) {
          notify(notifySourceCreationFailed(esSource.name, 'Url is required'))
          return
        }
        if (!esSource.name) {
          notify(notifySourceCreationFailed(esSource.name, 'Name is required'))
          return
        }

        try {
          const sourceFromServer = await updateElasticSearchInfo(esSource)
          await this.props.getElasticSearchInfoAsync()

          notify(notifySourceConnectionSucceeded(esSource.name))
          return {error: false, payload: sourceFromServer}
        } catch (err) {
          notify(notifySourceUpdateFailed(esSource.name, this.parseError(err)))
          return {error: true, payload: null}
        }
      }
      return {error: false, payload: esSource}
    }
  }

  public onChangeInput = (key: string) => (value: string) => {
    const {esSource} = this.state
    this.setState({esSource: {...esSource, [key]: value}})
  }

  public urlModifier = (value: string): string => {
    const url = value.trim()
    if (url.startsWith('http')) {
      return url
    }
    return `http://${url}`
  }

  public render() {
    const {esSource, authToggle} = this.state

    return (
      <div className="form-group">
        <WizardTextInput
          value={esSource.url}
          label="Connection URL"
          onChange={this.onChangeInput('url')}
          valueModifier={this.urlModifier}
        />
        <WizardTextInput
          value={esSource.name}
          label="Connection Name"
          onChange={this.onChangeInput('name')}
        />
        {authToggle ? (
          <>
            <WizardTextInput
              value={esSource.basicAuth?.username ?? ''}
              label={'Username'}
              onChange={this.onChangeInputBasicAuth('username')}
            />
            <WizardTextInput
              value={esSource.basicAuth?.password ?? ''}
              label={'Password'}
              placeholder={this.passwordPlaceholder}
              type="password"
              onChange={this.onChangeInputBasicAuth('password')}
            />
          </>
        ) : (
          <>
            <WizardTextInput
              value={esSource.apiKeyAuth?.id ?? ''}
              label={'id'}
              onChange={this.onChangeInputApiKeyAuth('id')}
              placeholder={this.passwordPlaceholder}
            />
            <WizardTextInput
              value={esSource.apiKeyAuth?.apiKey ?? ''}
              label={'apiKey'}
              onChange={this.onChangeInputApiKeyAuth('apiKey')}
              placeholder={this.passwordPlaceholder}
            />
          </>
        )}

        <WizardCheckbox
          halfWidth={true}
          isChecked={authToggle}
          text={'Basic Auth'}
          onChange={this.changeAuth}
        />
        <WizardCheckbox
          halfWidth={true}
          isChecked={esSource.default}
          text={'Default'}
          onChange={this.changeDefault}
        />
        {/* {this.isHTTPS && (
          <WizardCheckbox
            isChecked={esSource.insecureSkipVerify}
            text={`Unsafe SSL`}
            onChange={this.onChangeInput('insecureSkipVerify')}
            subtext={insecureSkipVerifyText}
          />
        )} */}
      </div>
    )
  }

  private setDefaultOrganization = () => {
    const {isUsingAuth, me, organizations} = this.props
    if (isUsingAuth) {
      this.setState({
        esSource: {
          ...this.state.esSource,
          organization: me.currentOrganization.id,
          name: me.currentOrganization.name,
        },
      })
    } else {
      this.setState({
        esSource: {
          ...this.state.esSource,
          organization: organizations[0].id,
          name: organizations[0].name,
        },
      })
    }
  }

  private get sourceIsEdited(): boolean {
    const sourceInProps = this.props.esSource
    const sourceInState = this.state.esSource
    return !_.isEqual(sourceInProps, sourceInState)
  }

  private changeAuth = (value: boolean) => {
    const {esSource} = this.state
    if (value) {
      this.setState({
        esSource: {
          ...esSource,
          apiKeyAuth: {id: '', apiKey: ''},
        },
        authToggle: true,
      })
    } else {
      this.setState({
        esSource: {
          ...esSource,
          basicAuth: {username: '', password: ''},
        },
        authToggle: false,
      })
    }
  }

  private changeDefault = (value: boolean) => {
    const {esSource} = this.state
    this.setState({
      esSource: {...esSource, default: value},
    })
  }

  private parseError = (error: any): string => {
    return getDeep<string>(error, 'data.message', error)
  }

  private get passwordPlaceholder() {
    const {esSource} = this.state

    if (esSource.authentication !== 'unknown') {
      return 'Value saved in server'
    }
  }

  private onChangeInputBasicAuth = (key: string) => (value: string) => {
    const {esSource} = this.state
    this.setState({
      esSource: {...esSource, basicAuth: {...esSource.basicAuth, [key]: value}},
    })
  }

  private onChangeInputApiKeyAuth = (key: string) => (value: string) => {
    const {esSource} = this.state
    this.setState({
      esSource: {
        ...esSource,
        apiKeyAuth: {...esSource.apiKeyAuth, [key]: value},
      },
    })
  }

  private onSubmitVerify = (
    esSource: CreateElasticSearchParams,
    authToggle: boolean
  ) => {
    const {notify} = this.props

    if (esSource.url === '') {
      notify(notifySourceCreationFailed(esSource.name, 'Url is required'))
      return false
    }

    if (!esSource.name) {
      notify(notifySourceCreationFailed(esSource.name, 'Name is required'))
      return
    }

    if (esSource.organization === '') {
      notify(
        notifySourceCreationFailed(esSource.name, 'Organization is required')
      )
      return false
    }

    if (authToggle) {
      if (
        esSource.basicAuth === null ||
        esSource.basicAuth?.password === '' ||
        esSource.basicAuth?.password === undefined
      ) {
        notify(
          notifySourceCreationFailed(
            esSource.name,
            'User name, Password is required'
          )
        )
        return false
      }
    } else {
      if (
        esSource.apiKeyAuth === null ||
        esSource.apiKeyAuth?.apiKey === undefined ||
        esSource.apiKeyAuth?.id === undefined ||
        esSource.apiKeyAuth?.apiKey === '' ||
        esSource.apiKeyAuth?.id === ''
      ) {
        notify(
          notifySourceCreationFailed(esSource.name, 'Id, Api Key is required')
        )
        return false
      }
    }
    return true
  }

  private connectDefaultEsSource = (result: BaseElasticSearchData) => {
    const {connectElasticSearch} = this.props

    if (result.default) {
      connectElasticSearch({elasticSearchInfo: result})
    }
  }
}

const mstp = ({adminCloudHub: {organizations}, auth: {isUsingAuth, me}}) => ({
  organizations,
  isUsingAuth,
  me,
})

const mdtp = dispatch => ({
  notify: bindActionCreators(notifyAction, dispatch),
  setTimeSeriesHeight: bindActionCreators(createElasticSearchInfo, dispatch),
  updateElasticSearchInfo: bindActionCreators(
    updateElasticSearchInfo,
    dispatch
  ),
  getElasticSearchInfoAsync: bindActionCreators(
    getElasticSearchInfoAsync,
    dispatch
  ),
  connectElasticSearch: bindActionCreators(connectElasticSearch, dispatch),
})

export default connect(mstp, mdtp, null, {forwardRef: true})(ElasticStep)
