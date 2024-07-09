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
import PredictionRule from 'src/device_management/containers/PredictionRule'

// Actions
import * as kapacitorRuleActionCreators from 'src/kapacitor/actions/view'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {KapacitorRuleActions} from 'src/types/actions'

// API
import {
  getKapacitorConfig,
  getSource,
  getKapacitors,
} from 'src/shared/apis/index'
import {getAllDevicesOrg} from 'src/device_management/apis'

// Utils
import parseHandlersFromConfig from 'src/shared/parsing/parseHandlersFromConfig'
import {getOrganizationNameByID} from 'src/device_management/utils'

import {
  DEFAULT_ALERT_RULE,
  DEFAULT_PREDICT_MODE,
  PREDICT_TASK_PREFIX,
} from 'src/device_management/constants/deviceData'
import {DEFAULT_KAPACITOR, DEFAULT_SOURCE} from 'src/shared/constants'

// ETC
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Auth {
  me: Me
  isUsingAuth: boolean
}

interface Props {
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
  isTickscriptCreated: boolean
  isLoading: boolean
  predictMode: PredictModeKey
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
      selectedOrganizationID: 'default',
      predictMode: DEFAULT_PREDICT_MODE,
    }
  }

  public async componentDidMount() {
    const {me} = this.props

    try {
      this.setState({
        isLoading: true,
        selectedOrganizationID: me?.currentOrganization?.id,
      })

      await this.getNetworkDeviceOrganizationsAJAX()
      await this.fetchSpecificAlertRule(me.currentOrganization.id)

      this.setState({isLoading: false})
    } catch (error) {
      console.error(error.message || '')
      this.setState({isLoading: false})
    }
  }

  public async componentDidUpdate(_, prevState) {
    if (
      prevState.selectedOrganizationID !== this.state.selectedOrganizationID
    ) {
      this.setState({isLoading: true})

      try {
        await this.getNetworkDeviceOrganizationsAJAX()
        await this.fetchSpecificAlertRule(this.state.selectedOrganizationID)
        this.setState({isLoading: false})
      } catch (error) {
        this.setState({isLoading: false})

        console.error(error)
      }
    }
  }

  private getNetworkDeviceOrganizationsAJAX = async () => {
    try {
      const {data} = await getAllDevicesOrg()
      const networkDeviceOrganization = data?.organizations || []

      this.setState({
        orgLearningModel: networkDeviceOrganization,
      })
    } catch (error) {
      console.error(error.message || '')
    }
  }

  private getSourceForNetworkDeviceOrganizationKapacitor = async (): Promise<Source | null> => {
    const {selectedOrganizationID} = this.state
    let source: Source | null = null

    if (selectedOrganizationID === '') {
      return null
    }

    const currentNetworkDeviceOrganization = this.getCurrentNetworkDeviceOrganization(
      selectedOrganizationID
    )
    if (!currentNetworkDeviceOrganization) {
      return null
    }

    const kapacitorForCurrentNetworkDeviceOrganization =
      currentNetworkDeviceOrganization.ai_kapacitor
    if (!kapacitorForCurrentNetworkDeviceOrganization) {
      return null
    }

    const {srcId} = kapacitorForCurrentNetworkDeviceOrganization
    if (!srcId) {
      return null
    }

    try {
      source = await getSource(srcId)
      this.setState({sourceForNetworkDeviceOrganizationKapacitor: source})
    } catch (error) {
      console.error(error.message || '')
      return null
    }

    return source
  }

  private getCurrentNetworkDeviceOrganization = (
    organizationID
  ): DevicesOrgData => {
    const {orgLearningModel} = this.state

    return orgLearningModel.find(i => i.organization === organizationID)
  }

  private fetchSpecificAlertRule = async (organizationID: string) => {
    if (!this.checkNetworkDeviceOrganizationCreated(organizationID)) {
      this.initializeState()
      return
    }

    const currentNetworkDeviceOrganization = this.getCurrentNetworkDeviceOrganization(
      organizationID
    )
    const kapacitorID = currentNetworkDeviceOrganization?.ai_kapacitor?.kapaId

    if (!kapacitorID) {
      this.initializeState()
      return
    }

    try {
      const source = await this.getSourceForNetworkDeviceOrganizationKapacitor()
      if (!source) {
        this.initializeState()
        return
      }

      const kapacitors = await getKapacitors(source)
      const kapacitorStoredInNetworkDeviceOrganization = kapacitors?.find(
        kapacitor => kapacitor.id === kapacitorID
      )
      const ruleID = `${PREDICT_TASK_PREFIX}${organizationID}`

      if (kapacitorStoredInNetworkDeviceOrganization) {
        await this.props.ruleActions.fetchRuleWithCallback(
          source,
          ruleID,
          this.setRuleAndPredictModeForFetchedRule.bind(this)
        )

        await this.getKapacitorConfig(
          kapacitorStoredInNetworkDeviceOrganization
        )
      } else {
        this.initializeState()
      }
    } catch (error) {
      console.error(error)
    }
  }

  private initializeState = () => {
    this.props.ruleActions.loadDefaultRule()
    this.setState({
      handlersFromConfig: [],
      kapacitor: DEFAULT_KAPACITOR,
      sourceForNetworkDeviceOrganizationKapacitor: DEFAULT_SOURCE as Source,
      isTickscriptCreated: false,
      predictMode: DEFAULT_PREDICT_MODE,
    })
  }

  private checkNetworkDeviceOrganizationCreated(organizationID) {
    const {orgLearningModel} = this.state
    return orgLearningModel.some(item => item.organization === organizationID)
  }

  private setRuleAndPredictModeForFetchedRule = (fetchedRule: {
    rule: AlertRule
  }) => {
    const _fetchedRule = fetchedRule?.rule

    if (_fetchedRule) {
      this.setState({
        rule: _fetchedRule,
        predictMode: this.getOriginalPredictMode(_fetchedRule),
        isTickscriptCreated: true,
      })
    } else {
      this.initializeState()
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
    try {
      const kapacitorConfig = await getKapacitorConfig(kapacitor)
      const handlersFromConfig = parseHandlersFromConfig(kapacitorConfig)

      this.setState({kapacitor, handlersFromConfig})
    } catch (error) {
      console.error(error)
    }
  }

  private setLearningDropdownState = (organization: Organization) => {
    this.setState({selectedOrganizationID: organization.id})
  }

  private setPredictMode = predictMode => {
    this.setState({predictMode: predictMode})
  }

  public render() {
    const {source, router, ruleActions, auth, organizations} = this.props
    const {
      handlersFromConfig,
      kapacitor,
      selectedOrganizationID,
      rule,
      isTickscriptCreated,
      predictMode,
    } = this.state

    const selectedOrganizationName = getOrganizationNameByID(
      organizations,
      selectedOrganizationID
    )

    return (
      <>
        {this.LoadingState}
        <PredictionRule
          source={source}
          me={auth.me}
          rule={rule}
          ruleActions={ruleActions}
          handlersFromConfig={handlersFromConfig}
          router={router}
          kapacitor={kapacitor}
          selectedOrganizationName={selectedOrganizationName}
          organizations={organizations}
          selectedPredictMode={predictMode}
          isTickscriptCreated={isTickscriptCreated}
          setLearningDropdownState={this.setLearningDropdownState}
          setPredictMode={this.setPredictMode}
          setisTickscriptCreated={this.setisTickscriptCreated}
          setLoading={this.setLoading}
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

  private setLoading = (isLoading: boolean) => {
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
