import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {ErrorHandling} from 'src/shared/decorators/errors'

import * as adminCloudHubActionCreators from 'src/admin/actions/cloudhub'
import * as sourcesActions from 'src/shared/actions/sources'
import {notify as notifyAction} from 'src/shared/actions/notifications'

import {Page} from 'src/reusable_ui'
import InfluxTable from 'src/sources/components/InfluxTable'
import ConnectionWizard from 'src/sources/components/ConnectionWizard'

import {
  notifySourceDeleted,
  notifySourceDeleteFailed,
} from 'src/shared/copy/notifications'

import {Links, Me, Source, Notification, Organization} from 'src/types'
import {ToggleWizard} from 'src/types/wizard'

interface State {
  wizardVisibility: boolean
  sourceInWizard: Source
  jumpStep: number
  showNewKapacitor: boolean
}

interface Props {
  links: Links
  source: Source
  sources: Source[]
  me: Me
  organizations: Organization[]
  isUsingAuth: boolean
  actionsAdmin: {
    loadOrganizationsAsync: (link: string) => void
  }
  notify: (n: Notification) => void
  deleteKapacitor: sourcesActions.DeleteKapacitorAsync
  fetchKapacitors: sourcesActions.FetchKapacitorsAsync
  removeAndLoadSources: sourcesActions.RemoveAndLoadSources
  setActiveKapacitor: sourcesActions.SetActiveKapacitorAsync
}

const VERSION = process.env.npm_package_version

@ErrorHandling
class ManageSources extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      wizardVisibility: false,
      sourceInWizard: null,
      jumpStep: null,
      showNewKapacitor: null,
    }
  }

  public async componentWillMount() {
    const {
      links,
      actionsAdmin: {loadOrganizationsAsync},
    } = this.props

    await Promise.all([loadOrganizationsAsync(links.organizations)])

    this.fetchKapacitors()
  }

  public componentWillReceiveProps(nextProps: Props) {
    if (nextProps.sources.length !== this.props.sources.length) {
      this.fetchKapacitors()
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
    } = this.props
    const {
      wizardVisibility,
      sourceInWizard,
      jumpStep,
      showNewKapacitor,
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
          />
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

  private handleSetActiveKapacitor = kapacitor => {
    this.props.setActiveKapacitor(kapacitor)
  }
}

const mstp = ({
  links,
  adminCloudHub: {organizations},
  auth: {isUsingAuth, me},
  sources,
}) => ({
  links,
  organizations,
  isUsingAuth,
  me,
  sources,
})

const mdtp = (dispatch: any) => ({
  notify: bindActionCreators(notifyAction, dispatch),
  actionsAdmin: bindActionCreators(adminCloudHubActionCreators, dispatch),
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
})

export default connect(mstp, mdtp)(ManageSources)
