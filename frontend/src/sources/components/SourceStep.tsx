// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'

// Components
import {ErrorHandling} from 'src/shared/decorators/errors'
import WizardTextInput from 'src/reusable_ui/components/wizard/WizardTextInput'
import WizardCheckbox from 'src/reusable_ui/components/wizard/WizardCheckbox'
import Dropdown from 'src/shared/components/Dropdown'

// Actions
import {
  addSource as addSourceAction,
  updateSource as updateSourceAction,
} from 'src/shared/actions/sources'
import {notify as notifyAction} from 'src/shared/actions/notifications'

// Utils
import {getDeep} from 'src/utils/wrappers'

// APIs
import {createSource, updateSource} from 'src/shared/apis'

// Constants
import {
  notifySourceUpdateFailed,
  notifySourceCreationFailed,
  notifySourceConnectionSucceeded,
} from 'src/shared/copy/notifications'
import {insecureSkipVerifyText} from 'src/shared/copy/tooltipText'
import {
  DEFAULT_SOURCE,
  SOURCE_TYPE_INFLUX_V2,
  SOURCE_TYPE_INFLUX_V1,
} from 'src/shared/constants'

// Types
import {Source, Me, Organization} from 'src/types'
import {NextReturn} from 'src/types/wizard'

const isNewSource = (source: Partial<Source>) => !source.id
const isSourceV2 = (source: Partial<Source>) =>
  source.type && source.type === SOURCE_TYPE_INFLUX_V2

interface Props {
  notify: typeof notifyAction
  addSource: typeof addSourceAction
  updateSource: typeof updateSourceAction
  setError: (b: boolean) => void
  source: Source
  onBoarding?: boolean
  me: Me
  organizations: Organization[]
  isUsingAuth: boolean
}

interface State {
  source: Partial<Source>
}

@ErrorHandling
class SourceStep extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    onBoarding: false,
  }
  constructor(props: Props) {
    super(props)
    this.state = {
      source: this.props.source || DEFAULT_SOURCE,
    }

    if (!this.props.source && props.isUsingAuth) {
      this.state.source.telegraf = props.me.currentOrganization.name
    }
  }

  public next = async (): Promise<NextReturn> => {
    const {source} = this.state
    const {notify} = this.props

    if (isNewSource(source)) {
      try {
        const sourceFromServer = await createSource(source)
        this.props.addSource(sourceFromServer)
        notify(notifySourceConnectionSucceeded(source.name))
        return {error: false, payload: sourceFromServer}
      } catch (err) {
        notify(notifySourceCreationFailed(source.name, this.parseError(err)))
        return {error: true, payload: null}
      }
    } else {
      if (this.sourceIsEdited) {
        try {
          const sourceFromServer = await updateSource(source)
          this.props.updateSource(sourceFromServer)
          // if the url field is blurred on a new source, the source is already created with no alert best to give a neutral success message
          notify(notifySourceConnectionSucceeded(source.name))
          return {error: false, payload: sourceFromServer}
        } catch (err) {
          notify(notifySourceUpdateFailed(source.name, this.parseError(err)))
          return {error: true, payload: null}
        }
      }
      return {error: false, payload: source}
    }
  }

  public render() {
    const {source} = this.state
    const {me, organizations, isUsingAuth, onBoarding} = this.props
    const sourceIsV2 = isSourceV2(source)

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
      <>
        {isUsingAuth && onBoarding && this.authIndicator}
        <WizardTextInput
          value={source.url}
          label="Connection URL"
          onChange={this.onChangeInput('url')}
          valueModifier={this.URLModifier}
        />
        <WizardTextInput
          value={source.name}
          label="Connection Name"
          onChange={this.onChangeInput('name')}
        />
        <WizardTextInput
          value={source.username}
          label={sourceIsV2 ? 'Organization' : 'Username'}
          onChange={this.onChangeInput('username')}
        />
        <WizardTextInput
          value={source.password}
          label={sourceIsV2 ? 'Token' : 'Password'}
          placeholder={this.passwordPlaceholder}
          type="password"
          onChange={this.onChangeInput('password')}
        />
        <div className="form-group col-xs-6">
          <label>Database(= Group) Name</label>
          <Dropdown
            items={
              !isUsingAuth || me.superAdmin
                ? onBoarding
                  ? dropdownCurOrg
                    ? dropdownCurOrg
                    : [source.telegraf]
                  : dropdownOrg
                : dropdownCurOrg
            }
            onChoose={this.onChooseDropdown('telegraf')}
            selected={source.telegraf}
            className="dropdown-stretch"
          />
        </div>
        <WizardTextInput
          value={source.defaultRP}
          label="Default Retention Policy"
          onChange={this.onChangeInput('defaultRP')}
        />
        {this.isEnterprise && (
          <WizardTextInput
            value={source.metaUrl}
            label="Meta Service Connection URL"
            onChange={this.onChangeInput('metaUrl')}
          />
        )}
        {!onBoarding && (
          <WizardCheckbox
            halfWidth={true}
            isChecked={source.default}
            text={'Default connection'}
            onChange={this.onChangeInput('default')}
          />
        )}
        <WizardCheckbox
          halfWidth={!onBoarding}
          isChecked={sourceIsV2}
          text={'InfluxDB v2 Auth'}
          onChange={this.changeVersion}
        />

        {this.isHTTPS && (
          <WizardCheckbox
            isChecked={source.insecureSkipVerify}
            text={`Unsafe SSL`}
            onChange={this.onChangeInput('insecureSkipVerify')}
            subtext={insecureSkipVerifyText}
          />
        )}
      </>
    )
  }

  private get passwordPlaceholder() {
    const {source} = this.props
    if (source && source.authentication === 'basic') {
      return 'Value saved in server'
    }
  }

  private get authIndicator(): JSX.Element {
    const {me} = this.props
    return (
      <div className="text-center">
        {me.superAdmin ? (
          <h4>
            The organization{' '}
            <strong>
              <i>{me.currentOrganization.name}</i>
            </strong>{' '}
            currently has no connections
          </h4>
        ) : (
          <h3>
            The organization{' '}
            <strong>
              <i>{me.currentOrganization.name}</i>
            </strong>{' '}
            has no connections available to <em>{me.role}s</em>
          </h3>
        )}
      </div>
    )
  }

  private URLModifier = (value: string): string => {
    const url = value.trim()
    if (url.startsWith('http')) {
      return url
    }
    return `http://${url}`
  }

  private parseError = (error: any): string => {
    return getDeep<string>(error, 'data.message', error)
  }

  private onChooseDropdown = (key: string) => (org: Organization) => {
    const {source} = this.state
    const {setError} = this.props
    this.setState({source: {...source, [key]: org.name}})
    setError(false)
  }

  private onChangeInput = (key: string) => (value: string | boolean) => {
    const {source} = this.state
    const {setError} = this.props
    this.setState({source: {...source, [key]: value}})
    setError(false)
  }
  private changeVersion = (v2: boolean) => {
    const {source} = this.state
    this.setState({
      source: {
        ...source,
        type: v2 ? SOURCE_TYPE_INFLUX_V2 : SOURCE_TYPE_INFLUX_V1,
        version: v2 ? '2.x' : '1.x',
      },
    })
  }

  private get sourceIsEdited(): boolean {
    const sourceInProps = this.props.source
    const sourceInState = this.state.source
    return !_.isEqual(sourceInProps, sourceInState)
  }

  private get isHTTPS(): boolean {
    const {source} = this.state
    return getDeep<string>(source, 'url', '').startsWith('https')
  }

  private get isEnterprise(): boolean {
    const {source} = this.state
    return _.get(source, 'type', '').includes('enterprise')
  }
}

const mdtp = {
  notify: notifyAction,
  addSource: addSourceAction,
  updateSource: updateSourceAction,
}

export default connect(null, mdtp, null, {withRef: true})(SourceStep)
