import React, {PureComponent} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import WizardCheckbox from 'src/reusable_ui/components/wizard/WizardCheckbox'
import WizardTextInput from 'src/reusable_ui/components/wizard/WizardTextInput'
import {
  createElasticSearchInfo,
  updateElasticSearchInfo,
} from 'src/shared/apis/elasticSearch'
import Dropdown from 'src/shared/components/Dropdown'
import {
  notifySourceUpdateFailed,
  notifySourceCreationFailed,
} from 'src/shared/copy/notifications'
import {notifySourceConnectionSucceeded} from 'src/shared/copy/notifications'
import {CreateElasticSearchParams, Me, Organization} from 'src/types'
import {NextReturn} from 'src/types/wizard'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {getDeep} from 'src/utils/wrappers'
import _ from 'lodash'
import {getElasticSearchInfoAsync} from 'src/shared/actions/elasticSearch'

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
        // update redux store
        await this.props.getElasticSearchInfoAsync()

        notify(notifySourceConnectionSucceeded(esSource.name))
        return {error: false, payload: sourceFromServer}
      } catch (err) {
        notify(notifySourceCreationFailed(esSource.name, this.parseError(err)))
        return {error: true, payload: null}
      }
    } else {
      if (!!esSource.id) {
        try {
          const sourceFromServer = await updateElasticSearchInfo(esSource)
          // update redux store
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
    const {isUsingAuth, me, organizations} = this.props

    let dropdownCurOrg: any = null
    if (isUsingAuth) {
      dropdownCurOrg = [
        {
          ...me.currentOrganization,
          text: me.currentOrganization.name,
        },
      ]
    }

    let dropdownOrg: any = null
    if (organizations) {
      dropdownOrg = organizations.map(role => ({
        ...role,
        text: role.name,
      }))
    }

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
        <div className="form-group col-xs-6">
          <label>Organization</label>
          <Dropdown
            items={
              !isUsingAuth || me.superAdmin
                ? dropdownCurOrg
                  ? dropdownCurOrg
                  : [esSource.organization]
                : dropdownOrg
            }
            onChoose={this.onChooseDropdown('organization')}
            selected={esSource.organization}
            className="dropdown-stretch"
          />
        </div>
        <WizardCheckbox
          halfWidth={true}
          isChecked={authToggle}
          text={'Basic Auth'}
          onChange={this.changeAuth}
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
          organization: me.currentOrganization.name,
          name: me.currentOrganization.name,
        },
      })
    } else {
      this.setState({
        esSource: {
          ...this.state.esSource,
          organization: organizations[0].name,
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

  private parseError = (error: any): string => {
    return getDeep<string>(error, 'data.message', error)
  }

  private onChooseDropdown = (key: string) => (org: Organization) => {
    const {esSource} = this.state
    const {setError} = this.props

    this.setState({
      esSource: {...esSource, [key]: org.name, name: org.name},
    })

    setError(false)
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
})

export default connect(mstp, mdtp, null, {forwardRef: true})(ElasticStep)
