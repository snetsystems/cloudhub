// Library
import React, {Component} from 'react'
import _ from 'lodash'
import {InjectedRouter} from 'react-router'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

// Types
import {
  Me,
  Source,
  Notification,
  AlertRule,
  Kapacitor,
  Organization,
  DevicesOrgData,
  PredictModeKey,
} from 'src/types'

// Components
import PageSpinner from 'src/shared/components/PageSpinner'
import PredictionRule from 'src/device_management/components/PredictionRule'

// Actions
import * as kapacitorRuleActionCreators from 'src/kapacitor/actions/view'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {KapacitorRuleActions} from 'src/types/actions'

// API
import {getKapacitorConfig, getKapacitors} from 'src/shared/apis/index'
import {getAllDevicesOrg} from 'src/device_management/apis'

// Utils
import parseHandlersFromConfig from 'src/shared/parsing/parseHandlersFromConfig'
import {
  getOrganizationIdByName,
  getOrganizationNameByID,
  getSourceByTelegrafDatabase,
  getSourceBySourceID,
  isNetworkDeviceOrganizationCreatedWithSrcId,
} from 'src/device_management/utils'

// Constants
import {
  DEFAULT_ALERT_RULE,
  DEFAULT_PREDICT_MODE,
  PREDICT_TASK_PREFIX,
} from 'src/device_management/constants/deviceData'
import {DEFAULT_KAPACITOR, DEFAULT_SOURCE} from 'src/shared/constants'
import {DEFAULT_RULE_ID} from 'src/kapacitor/constants'

// ETC
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Auth {
  me: Me
  isUsingAuth: boolean
}

interface Props {
  sources: Source[]
  source: Source
  rules: AlertRule[]
  ruleActions: KapacitorRuleActions
  router: InjectedRouter
  auth: Auth
  me: Me
  organizations: Organization[]
  notify: (notification: Notification) => void
}

interface State {
  handlersFromConfig: any[]
  rule: AlertRule
  kapacitor: Kapacitor
  selectedOrganizationID: string
  orgLearningModel: DevicesOrgData[]
  sourceForNetworkDeviceOrganizationKapacitor: Source
  predictMode: PredictModeKey
  isLoading: boolean
  isTickscriptCreated: boolean
  isNetworkDeviceOrganizationValid: boolean
}

@ErrorHandling
class PredictionRulePage extends Component<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      rule: DEFAULT_ALERT_RULE,
      isLoading: false,
      isTickscriptCreated: false,
      handlersFromConfig: [],
      kapacitor: DEFAULT_KAPACITOR,
      orgLearningModel: [],
      sourceForNetworkDeviceOrganizationKapacitor: DEFAULT_SOURCE as Source,
      selectedOrganizationID: '',
      predictMode: DEFAULT_PREDICT_MODE,
      isNetworkDeviceOrganizationValid: true,
    }
  }

  public async componentDidMount() {
    const {me} = this.props

    try {
      this.setState({
        selectedOrganizationID: me?.currentOrganization?.id,
      })

      await this.getNetworkDeviceOrganizationsAJAX()
      await this.fetchSpecificAlertRule(me.currentOrganization.id)
    } catch (error) {
      this.initializeState(true)
      console.error(error?.message || 'Unknown Error')
    }
  }

  public async componentDidUpdate(prevProps, prevState) {
    this.updateRuleIfChanged(prevProps.rules, this.props.rules)

    if (
      prevState.selectedOrganizationID !== '' &&
      prevState.selectedOrganizationID !== this.state.selectedOrganizationID
    ) {
      try {
        await this.getNetworkDeviceOrganizationsAJAX()
        await this.fetchSpecificAlertRule(this.state.selectedOrganizationID)
      } catch (error) {
        this.initializeState(true)
        console.error(error)
      }
    }
  }

  private updateRuleIfChanged(
    prevRules: AlertRule[],
    currentRules: AlertRule[]
  ) {
    const {selectedOrganizationID} = this.state
    const prevRule = this.getRuleFromProps(prevRules, selectedOrganizationID)
    const currentRule = this.getRuleFromProps(
      currentRules,
      selectedOrganizationID
    )
    if (
      currentRule.status !== prevRule.status ||
      currentRule.id !== prevRule.id ||
      currentRule.tickscript !== prevRule.tickscript ||
      !_.isEqual(currentRule.alertNodes, prevRule.alertNodes) ||
      currentRule.message !== prevRule.message ||
      currentRule.name !== prevRule.name ||
      currentRule.details !== prevRule.details ||
      currentRule.queryID !== prevRule.queryID
    ) {
      this.setState({rule: currentRule})
    }
  }

  private getRuleFromProps(
    rules: AlertRule[],
    selectedOrganizationID: string
  ): AlertRule {
    const ruleID = `${PREDICT_TASK_PREFIX}${selectedOrganizationID}`
    return rules[ruleID] || rules[DEFAULT_RULE_ID] || DEFAULT_ALERT_RULE
  }

  private getNetworkDeviceOrganizationsAJAX = async () => {
    try {
      const {data} = await getAllDevicesOrg()
      const networkDeviceOrganization = data?.organizations || []

      this.setState({
        orgLearningModel: networkDeviceOrganization,
      })
    } catch (error) {
      console.error(error?.message || 'Unknown Error')
    }
  }

  private fetchSpecificAlertRule = async (organizationID: string) => {
    const {sources, organizations} = this.props
    const {orgLearningModel} = this.state

    try {
      const isNetworkDeviceOrganizationValid = isNetworkDeviceOrganizationCreatedWithSrcId(
        orgLearningModel,
        organizationID
      )
      const organizationName =
        getOrganizationNameByID(organizations, organizationID) || ''
      const selectedSource = getSourceByTelegrafDatabase(
        sources,
        organizationName
      )

      if (!selectedSource || !isNetworkDeviceOrganizationValid) {
        this.initializeState(true)
        this.setState({
          isNetworkDeviceOrganizationValid: false,
        })
        return
      }

      const ruleID = `${PREDICT_TASK_PREFIX}${organizationID}`

      await this.props.ruleActions.fetchRuleWithCallback(
        selectedSource,
        ruleID,
        this.setRuleAndPredictModeForFetchedRule.bind(this),
        this.initializeState.bind(this, true)()
      )

      const kapacitors = await getKapacitors(selectedSource)
      await this.getKapacitorConfig(kapacitors?.[0])
    } catch (error) {
      this.initializeState(true)
      console.error(error)
    }
  }

  private initializeState = (isFetchingRule?: boolean) => {
    if (isFetchingRule) {
      this.props.ruleActions.loadDefaultRule()
    }

    this.setState({
      isTickscriptCreated: false,
      kapacitor: DEFAULT_KAPACITOR,
      predictMode: DEFAULT_PREDICT_MODE,
      handlersFromConfig: [],
    })
  }

  private setRuleAndPredictModeForFetchedRule = (fetchedRule: {
    rule: AlertRule
  }) => {
    const _fetchedRule = _.cloneDeep(fetchedRule?.rule)

    if (_fetchedRule) {
      this.setState({
        rule: _fetchedRule,
        predictMode: this.getOriginalPredictMode(_fetchedRule),
        isTickscriptCreated: true,
      })
      this.setOriginalRuleMessage(_fetchedRule)
    } else {
      this.initializeState(true)
    }
  }

  private getOriginalPredictMode = (fetchedRule: AlertRule) => {
    const predictModeRegex = /var predict_mode = '([^']*)'/
    const ensembleConditionRegex = /var ensemble_condition = '([^']*)'/

    const predictModeMatch = fetchedRule?.tickscript?.match(predictModeRegex)
    const ensembleConditionMatch = fetchedRule?.tickscript?.match(
      ensembleConditionRegex
    )

    const predictMode = predictModeMatch
      ? predictModeMatch[1]
      : DEFAULT_PREDICT_MODE
    const ensembleCondition = ensembleConditionMatch
      ? ensembleConditionMatch[1]
      : ''

    const combinedMode = this.getPredictModeKey(predictMode, ensembleCondition)
    return combinedMode
  }

  private setOriginalRuleMessage = (fetchedRule: AlertRule) => {
    const {ruleActions} = this.props
    const ruleMessageRegex = /var message = '([^']*)'/
    const ruleMessageMatch = fetchedRule?.tickscript?.match(ruleMessageRegex)
    const ruleMessage = ruleMessageMatch ? ruleMessageMatch[1] : ''

    if (ruleMessage) {
      ruleActions.updateMessage(fetchedRule.id, ruleMessage)
    }
  }

  private getPredictModeKey = (
    predict_mode: string,
    ensemble_condition: string
  ): PredictModeKey => {
    switch (predict_mode) {
      case 'ML':
        return 'ML'
      case 'DL':
        return 'DL'
      case 'Ensemble':
        if (ensemble_condition === 'or') {
          return 'EnsembleOrCondition'
        } else if (ensemble_condition === 'and') {
          return 'EnsembleAndCondition'
        }
        break
      default:
        return DEFAULT_PREDICT_MODE
    }
    return DEFAULT_PREDICT_MODE
  }

  private getKapacitorConfig = async (kapacitor: Kapacitor) => {
    if (!kapacitor) {
      this.setState({
        isNetworkDeviceOrganizationValid: false,
      })
      this.initializeState(true)
    }

    try {
      const kapacitorConfig = await getKapacitorConfig(kapacitor)
      const handlersFromConfig = parseHandlersFromConfig(kapacitorConfig)

      this.setState({kapacitor, handlersFromConfig})
    } catch (error) {
      this.setState({
        isNetworkDeviceOrganizationValid: false,
      })
      this.initializeState(true)
      console.error(error)
    }
  }

  private setOrganizationDropdown = (organization: Source) => {
    const {organizations, sources} = this.props
    const {selectedOrganizationID} = this.state
    const selectedSource = getSourceBySourceID(sources, organization.id)
    const organizationID =
      getOrganizationIdByName(organizations, selectedSource?.telegraf) || ''

    if (selectedOrganizationID === organizationID) {
      return
    }

    this.setState({
      isNetworkDeviceOrganizationValid: true,
      selectedOrganizationID: organizationID,
    })
  }

  private setPredictMode = predictMode => {
    this.setState({predictMode: predictMode})
  }

  public render() {
    const {
      sources,
      source,
      router,
      ruleActions,
      auth,
      organizations,
      notify,
    } = this.props
    const {
      handlersFromConfig,
      kapacitor,
      selectedOrganizationID,
      rule,
      isTickscriptCreated,
      isNetworkDeviceOrganizationValid,
      predictMode,
    } = this.state

    return (
      <>
        {this.LoadingState}
        <PredictionRule
          notify={notify}
          sources={sources}
          source={source}
          me={auth.me}
          rule={rule}
          ruleActions={ruleActions}
          handlersFromConfig={handlersFromConfig}
          router={router}
          kapacitor={kapacitor}
          selectedOrganizationID={selectedOrganizationID}
          organizations={organizations}
          selectedPredictMode={predictMode}
          isTickscriptCreated={isTickscriptCreated}
          isNetworkDeviceOrganizationValid={isNetworkDeviceOrganizationValid}
          setOrganizationDropdown={this.setOrganizationDropdown}
          setPredictMode={this.setPredictMode}
          setisTickscriptCreated={this.setisTickscriptCreated}
          setLoadingForCreateAndUpdateScript={
            this.setLoadingForCreateAndUpdateScript
          }
        />
      </>
    )
  }

  private get LoadingState(): JSX.Element {
    const {isLoading} = this.state

    if (!isLoading) {
      return <></>
    }

    return (
      <div className="device-management--loading">
        <PageSpinner />
      </div>
    )
  }

  private setLoadingForCreateAndUpdateScript = (isLoading: boolean) => {
    this.setState({isLoading: isLoading})
  }

  private setisTickscriptCreated = (isTickscriptCreated: boolean) => {
    this.setState({isTickscriptCreated})
  }
}

const mapStateToProps = ({adminCloudHub: {organizations}, rules, auth}) => ({
  rules,
  me: auth.me,
  organizations,
})

const mapDispatchToProps = dispatch => ({
  ruleActions: bindActionCreators(kapacitorRuleActionCreators, dispatch),
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(mapStateToProps, mapDispatchToProps)(PredictionRulePage)
