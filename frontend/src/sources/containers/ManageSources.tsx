import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {ErrorHandling} from 'src/shared/decorators/errors'

import * as sourcesActions from 'src/shared/actions/sources'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {UserRole, ForceSessionAbortInputRole} from 'src/shared/actions/session'
import {SUPERADMIN_ROLE} from 'src/auth/Authorized'

import {Page} from 'src/reusable_ui'
import InfluxTable from 'src/sources/components/InfluxTable'
import ConnectionWizard from 'src/sources/components/ConnectionWizard'
import {connectedSourceAction, connectedSource} from 'src/sources/actions'

import {
  notifySourceDeleted,
  notifySourceDeleteFailed,
} from 'src/shared/copy/notifications'

import {
  Me,
  Source,
  Notification,
  Organization,
  BaseElasticSearchData,
  ToggleEsWizard,
} from 'src/types'
import {ToggleWizard} from 'src/types/wizard'
import ElasticTable from '../components/ElasticTable'
import EsConnectionWizard from '../components/EsConnectionWizard'
import {checkAndConnectElasticSearch} from 'src/utils/changeEsSource'
import {
  connectElasticSearch,
  getElasticSearchInfoAsync,
} from 'src/shared/actions/elasticSearch'
import {disconnectElasticSearch} from 'src/shared/actions/elasticSearch'
import _ from 'lodash'

interface State {
  wizardVisibility: boolean
  esWizardVisibility: boolean
  esSourceInWizard: BaseElasticSearchData
  sourceInWizard: Source
  jumpStep: number
  showNewKapacitor: boolean
}

interface Props {
  source: Source
  sources: Source[]
  me: Me
  organizations: Organization[]
  isUsingAuth: boolean
  notify: (n: Notification) => void
  deleteKapacitor: sourcesActions.DeleteKapacitor
  fetchKapacitors: sourcesActions.FetchKapacitorsAsync
  removeAndLoadSources: sourcesActions.RemoveAndLoadSources
  setActiveKapacitor: sourcesActions.SetActiveKapacitorAsync
  connectedSource: connectedSourceAction
  ForceSessionAbortInputRole: (
    requireRole: UserRole,
    isNoAuthOuting?: boolean
  ) => void

  esSource?: BaseElasticSearchData
  esSources?: BaseElasticSearchData[]
  handleGetElasticSearchInfo?: () => void
  handleDisconnectElasticSearch?: () => void
  handleConnectElasticSearch?: (params: {
    elasticSearchInfo?: BaseElasticSearchData
  }) => void
}

const VERSION = process.env.npm_package_version

@ErrorHandling
class ManageSources extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      wizardVisibility: false,
      esWizardVisibility: false,
      sourceInWizard: null,
      jumpStep: null,
      showNewKapacitor: null,
      esSourceInWizard: null,
    }
  }

  public async componentDidMount() {
    const {ForceSessionAbortInputRole} = this.props

    ForceSessionAbortInputRole(SUPERADMIN_ROLE)
    this.fetchKapacitors()
  }

  public componentDidUpdate(prevProps: Props) {
    if (prevProps.sources.length !== this.props.sources.length) {
      this.fetchKapacitors()
    }

    if (!_.isEqual(prevProps.esSources.length, this.props.esSources.length)) {
      checkAndConnectElasticSearch({
        me: this.props.me,
        esSource: this.props.esSource,
        esSources: this.props.esSources,
        handleGetElasticSearchInfo: this.props.handleGetElasticSearchInfo,
        handleDisconnectElasticSearch: this.props.handleDisconnectElasticSearch,
        handleConnectElasticSearch: this.props.handleConnectElasticSearch,
      })
    }
  }

  public render() {
    const {
      me,
      organizations,
      isUsingAuth,
      sources,
      source,
      deleteKapacitor,
      connectedSource,
    } = this.props
    const {
      wizardVisibility,
      esWizardVisibility,
      sourceInWizard,
      jumpStep,
      showNewKapacitor,
      esSourceInWizard,
    } = this.state
    return (
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Title title="Configuration" />
          </Page.Header.Left>
          <Page.Header.Right showSourceIndicator={true} />
        </Page.Header>
        <Page.Contents>
          <InfluxTable
            source={source}
            sources={sources}
            deleteKapacitor={deleteKapacitor}
            onDeleteSource={this.handleDeleteSource}
            setActiveKapacitor={this.handleSetActiveKapacitor}
            toggleWizard={this.toggleWizard}
            connectedSource={connectedSource}
          />
          <ElasticTable toggleEsWizard={this.toggleEsWizard} />
          <p className="version-number">CloudHub Version: {VERSION}</p>
        </Page.Contents>
        <ConnectionWizard
          me={me}
          organizations={organizations}
          isUsingAuth={isUsingAuth}
          isVisible={wizardVisibility}
          toggleVisibility={this.toggleWizard}
          source={sourceInWizard}
          jumpStep={jumpStep}
          showNewKapacitor={showNewKapacitor}
        />
        <EsConnectionWizard
          isVisible={esWizardVisibility}
          toggleEsWizard={this.toggleEsWizard}
          esSource={esSourceInWizard}
        />
      </Page>
    )
  }

  private handleDeleteSource = (source: Source) => {
    const {notify} = this.props

    try {
      this.props.removeAndLoadSources(source)
      notify(notifySourceDeleted(source.name))
    } catch (e) {
      notify(notifySourceDeleteFailed(source.name))
    }
  }

  private fetchKapacitors = () => {
    this.props.sources.forEach(source => {
      this.props.fetchKapacitors(source)
    })
  }

  private toggleWizard: ToggleWizard = (
    isVisible,
    source = null,
    jumpStep = null,
    showNewKapacitor = null
  ) => () => {
    if (!isVisible) {
      this.fetchKapacitors()
    }
    this.setState({
      wizardVisibility: isVisible,
      sourceInWizard: source,
      jumpStep,
      showNewKapacitor,
    })
  }

  private toggleEsWizard: ToggleEsWizard = (
    isVisible,
    esSource = null
  ) => () => {
    this.setState({
      esWizardVisibility: isVisible,
      esSourceInWizard: esSource,
    })
  }

  private handleSetActiveKapacitor = kapacitor => {
    this.props.setActiveKapacitor(kapacitor)
  }
}

const mstp = ({
  adminCloudHub: {organizations},
  app: {
    persisted: {esSource},
  },
  auth: {isUsingAuth, me},
  sources,
  esSources: {esSources},
}) => ({
  organizations,
  isUsingAuth,
  me,
  sources,
  esSources,
  esSource,
})

const mdtp = (dispatch: any) => ({
  notify: bindActionCreators(notifyAction, dispatch),
  removeAndLoadSources: bindActionCreators(
    sourcesActions.removeAndLoadSources,
    dispatch
  ),
  fetchKapacitors: bindActionCreators(
    sourcesActions.fetchKapacitorsAsync,
    dispatch
  ),
  setActiveKapacitor: bindActionCreators(
    sourcesActions.setActiveKapacitorAsync,
    dispatch
  ),
  deleteKapacitor: bindActionCreators(
    sourcesActions.deleteKapacitorAsync,
    dispatch
  ),
  connectedSource: bindActionCreators(connectedSource, dispatch),
  ForceSessionAbortInputRole: bindActionCreators(
    ForceSessionAbortInputRole,
    dispatch
  ),
  handleGetElasticSearchInfo: bindActionCreators(
    getElasticSearchInfoAsync,
    dispatch
  ),
  handleDisconnectElasticSearch: bindActionCreators(
    disconnectElasticSearch,
    dispatch
  ),
  handleConnectElasticSearch: bindActionCreators(
    connectElasticSearch,
    dispatch
  ),
})

export default connect(mstp, mdtp, null)(ManageSources)
