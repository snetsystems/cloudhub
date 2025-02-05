// Library
import React, {Component} from 'react'
import {InjectedRouter} from 'react-router'

// Components
import {ComponentSize, Page, SlideToggle} from 'src/reusable_ui'
import RuleHeaderSave from 'src/kapacitor/components/alert_rules/RuleHeaderSave'
import Dropdown from 'src/shared/components/Dropdown'
import PredictionRuleHandlers from 'src/device_management/components/PredictionRuleHandlers'
import PredictionRuleMessage from 'src/device_management/components/PredictionRuleMessage'

// Type
import {
  Me,
  Source,
  AlertRule,
  Notification,
  Kapacitor,
  Organization,
  DropdownItem,
  CreateDeviceManagmenntScriptRequest,
} from 'src/types'
import {Handler} from 'src/types/kapacitor'

// API
import {
  createDeviceManagementTickScript,
  updateDeviceManagementTickScript,
} from 'src/device_management/apis'

// Action
import {KapacitorRuleActions} from 'src/types/actions'

// Utils
import {
  convertSourcesToDropdownItems,
  getOrganizationNameByID,
  parseErrorMessage,
} from 'src/device_management/utils'

// Constants
import {PREDICT_MODE} from 'src/device_management/constants'

// Notification
import {
  notifyAlertRuleCreated,
  notifyAlertRuleCreateFailed,
  notifyAlertRuleUpdated,
  notifyAlertRuleUpdateFailed,
  notifyKapacitorEngineRequired,
} from 'src/shared/copy/notifications'
import {ErrorHandling} from 'src/shared/decorators/errors'
import isValidMessage from 'src/kapacitor/utils/alertMessageValidation'

interface Props {
  sources: Source[]
  source: Source
  selectedOrganizationID: string
  selectedPredictMode: string
  isTickscriptCreated: boolean
  networkDeviceOrganizationStatus: 'valid' | 'invalid' | 'none'
  me: Me
  rule: AlertRule
  ruleActions: KapacitorRuleActions
  handlersFromConfig: Handler[]
  router: InjectedRouter
  kapacitor: Kapacitor
  organizations: Organization[]
  setOrganizationDropdown: (organization: Source) => void
  setPredictMode: (predictMode: string) => void
  notify: (message: Notification) => void
  setLoadingForCreateAndUpdateScript: (isLoading: boolean) => void
  setisTickscriptCreated: (isTickscriptCreated: boolean) => void
  fetchRuleAfterCreatingPredictionRule: () => void
}

interface State {}

@ErrorHandling
export default class PredictionRule extends Component<Props, State> {
  constructor(props) {
    super(props)
  }

  public render() {
    const {
      rule,
      ruleActions,
      handlersFromConfig,
      me,
      networkDeviceOrganizationStatus,
    } = this.props

    return (
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Title title="Prediction Alert Rule Builder" />
          </Page.Header.Left>
          <Page.Header.Right showSourceIndicator={true}>
            {this.saveButton}
            <RuleHeaderSave
              onSave={this.handleSave}
              validationError={this.validationError}
            />
          </Page.Header.Right>
        </Page.Header>
        <Page.Contents>
          <div className="rule-builder">
            {this.Organization}
            {this.NameSection}

            {this.PredictMode}
            <PredictionRuleHandlers
              me={me}
              rule={rule}
              ruleActions={ruleActions}
              handlersFromConfig={handlersFromConfig}
              onGoToConfig={this.handleSaveToConfig}
              validationError={this.validationError}
              networkDeviceOrganizationStatus={networkDeviceOrganizationStatus}
            />

            <PredictionRuleMessage rule={rule} ruleActions={ruleActions} />
          </div>
        </Page.Contents>
      </Page>
    )
  }

  private get saveButton(): JSX.Element {
    const {source, router} = this.props
    const pageLink = `/sources/${source.id}/ai/prediction`

    return (
      <button
        className="btn btn-default btn-sm"
        title="Return to Anomaly Prediction Page"
        onClick={() => router.push(pageLink)}
      >
        Exit
      </button>
    )
  }

  private get Organization(): JSX.Element {
    const {
      setOrganizationDropdown,
      selectedOrganizationID,
      organizations,
      me,
      sources,
      source,
    } = this.props
    const availableSources =
      me.superAdmin && me.currentOrganization.id === 'default'
        ? sources
        : [source]

    return (
      <div className="rule-section">
        <h3 className="rule-section--heading">Organization</h3>
        <div className="rule-section--body">
          <div className="rule-section--row rule-section--row-first rule-section--row-last">
            <Dropdown
              items={convertSourcesToDropdownItems(availableSources)}
              onChoose={setOrganizationDropdown}
              selected={getOrganizationNameByID(
                organizations,
                selectedOrganizationID
              )}
              className="dropdown-stretch"
            />
          </div>
        </div>
      </div>
    )
  }

  private get NameSection(): JSX.Element {
    const {rule, networkDeviceOrganizationStatus, ruleActions} = this.props
    let ruleName =
      networkDeviceOrganizationStatus !== 'invalid' && rule?.name
        ? rule.name
        : 'Untitled Rule'

    return (
      <div className="rule-section">
        <h3 className="rule-section--heading">Name</h3>
        <div className="rule-section--body">
          <div className="rule-section--row rule-section--row-first rule-section--row-last">
            <input
              type="text"
              className="form-control input-md form-malachite"
              disabled={true}
              placeholder="ex: Ruley McRuleface"
              value={ruleName}
            />
            <div
              className="form-control-static"
              style={{
                border: 'none',
                padding: '5px 0 0 2px',
              }}
            >
              <SlideToggle
                active={rule?.status === 'enabled'}
                onChange={() => {
                  const getStatus = rule => {
                    if (!rule?.status) {
                      return 'disabled'
                    } else if (rule.status === 'enabled') {
                      return 'disabled'
                    } else if (rule.status === 'disabled') {
                      return 'enabled'
                    }
                  }

                  ruleActions.updateRuleStatusSuccess(rule.id, getStatus(rule))
                }}
                size={ComponentSize.ExtraSmall}
              />
              <label style={{padding: '3px 0px 0px 5px'}}>
                Prediction Enabled
              </label>
            </div>
          </div>
        </div>
      </div>
    )
  }

  private get PredictMode(): JSX.Element {
    const {selectedPredictMode, setPredictMode} = this.props

    return (
      <div className="rule-section">
        <h3 className="rule-section--heading">Predict Mode</h3>
        <div className="rule-section--body">
          <div className="rule-section--row rule-section--row-first rule-section--row-last">
            <Dropdown
              items={Object.values(PREDICT_MODE)}
              onChoose={(value: DropdownItem) =>
                setPredictMode(this.convertValueToKey(value.text, PREDICT_MODE))
              }
              selected={PREDICT_MODE[selectedPredictMode]}
              className="dropdown-stretch"
            />
          </div>
        </div>
      </div>
    )
  }

  private handleSave = () => {
    const {
      networkDeviceOrganizationStatus,
      isTickscriptCreated,
      notify,
    } = this.props

    if (networkDeviceOrganizationStatus === 'invalid') {
      notify(notifyKapacitorEngineRequired())
      return
    }

    if (isTickscriptCreated) {
      this.handleEdit()
    } else {
      this.handleCreate()
    }
  }

  private handleCreate = async () => {
    await this.createAlertRule()
  }

  private createAlertRule = async () => {
    const {
      rule,
      notify,
      setisTickscriptCreated,
      fetchRuleAfterCreatingPredictionRule,
    } = this.props

    this.props.setLoadingForCreateAndUpdateScript(true)
    try {
      const request = this.getDeviceManagementScriptRequest()

      await createDeviceManagementTickScript(request)

      notify(notifyAlertRuleCreated(rule?.name || 'Rule'))
      this.props.setLoadingForCreateAndUpdateScript(false)
      fetchRuleAfterCreatingPredictionRule()
      setisTickscriptCreated(true)
    } catch (error) {
      notify(
        notifyAlertRuleCreateFailed(
          rule?.name || 'Rule',
          parseErrorMessage(error)
        )
      )
      this.props.setLoadingForCreateAndUpdateScript(false)
    }
  }

  private getDeviceManagementScriptRequest = (
    updatedRule?: AlertRule
  ): CreateDeviceManagmenntScriptRequest => {
    const {organizations, rule, selectedOrganizationID} = this.props

    let _rule = updatedRule ? updatedRule : rule

    const predictModeAndEnsembleCondition = this.getPredictModeAndEnsembleCondition()

    return {
      ..._rule,
      ...predictModeAndEnsembleCondition,
      organization: selectedOrganizationID,
      organization_name: getOrganizationNameByID(
        organizations,
        selectedOrganizationID
      ),
    }
  }

  private handleEdit = async () => {
    await this.updateAlertRule()
  }

  private updateAlertRule = async () => {
    const {notify, rule, selectedOrganizationID} = this.props

    this.props.setLoadingForCreateAndUpdateScript(true)
    try {
      const updatedRule = this.replaceTickscript()
      const request = this.getDeviceManagementScriptRequest(updatedRule)

      await updateDeviceManagementTickScript(request, selectedOrganizationID)
      notify(notifyAlertRuleUpdated(rule?.name || ''))
      this.props.setLoadingForCreateAndUpdateScript(false)
    } catch (error) {
      notify(
        notifyAlertRuleUpdateFailed(rule?.name || '', parseErrorMessage(error))
      )
      this.props.setLoadingForCreateAndUpdateScript(false)
    }
  }

  private replaceTickscript = (): AlertRule => {
    const {rule} = this.props
    const predictModeAndEnsembleCondition = this.getPredictModeAndEnsembleCondition()
    const message = rule?.message || ''

    if (rule?.tickscript === undefined) {
      throw new Error('Failed to update TICKscript')
    }

    const replaceScript = (
      script: string,
      regex: RegExp,
      replacement: string
    ): string => script.replace(regex, replacement)

    let newTickscript = replaceScript(
      rule.tickscript,
      /var predict_mode = '([^']*)'/,
      `var predict_mode = '${predictModeAndEnsembleCondition.predict_mode}'`
    )

    newTickscript = replaceScript(
      newTickscript,
      /var ensemble_condition = '([^']*)'/,
      `var ensemble_condition = '${predictModeAndEnsembleCondition.predict_mode_condition}'`
    )

    newTickscript = replaceScript(
      newTickscript,
      /var message = '([^']*)'/,
      `var message = '${message}'`
    )

    return {
      ...rule,
      tickscript: newTickscript,
    }
  }

  private getPredictModeAndEnsembleCondition = () => {
    const {selectedPredictMode} = this.props
    let predict_mode = ''
    let ensemble_condition = ''

    switch (selectedPredictMode) {
      case 'ML':
      case 'DL':
        predict_mode = PREDICT_MODE[selectedPredictMode]
        break
      case 'EnsembleOrCondition':
        predict_mode = 'Ensemble'
        ensemble_condition = 'or'
        break
      case 'EnsembleAndCondition':
        predict_mode = 'Ensemble'
        ensemble_condition = 'and'
        break
      default:
        throw new Error('Invalid PREDICT_MODE')
    }

    return {predict_mode, predict_mode_condition: ensemble_condition}
  }

  private handleSaveToConfig = (configName: string) => async () => {
    const {rule, notify} = this.props

    if (this.checkValidSourceAndKapacitor()) {
      notify(
        notifyAlertRuleCreateFailed(
          rule?.name || '',
          'Source ID or Kapacitor ID is invalid.'
        )
      )
      return
    }

    const {source, kapacitor, router, isTickscriptCreated} = this.props
    const configLink = `/sources/${source.id}/kapacitors/${kapacitor.id}/edit`

    const pathname = `${configLink}#${configName}`
    const validationError = this.validationError

    if (validationError) {
      notify(notifyAlertRuleCreateFailed(rule?.name || '', validationError))
      return
    }

    if (isTickscriptCreated) {
      await this.handleEdit()
    } else {
      await this.handleCreate()
    }

    router.push(pathname)
  }

  private checkValidSourceAndKapacitor = () => {
    const {source, kapacitor} = this.props

    if (!source?.id || !kapacitor?.id) return true

    return false
  }

  private get validationError(): string {
    const {rule} = this.props

    if (rule?.message && !isValidMessage(rule.message)) {
      return 'Please correct template values in the alert message.'
    }

    return ''
  }

  private convertValueToKey = (value: string, obj: Object) => {
    const index = Object.values(obj).findIndex(i => i === value)
    return Object.keys(obj)[index]
  }
}
