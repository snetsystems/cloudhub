// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'

// Components
import ManualRefresh, {
  ManualRefreshProps,
} from 'src/shared/components/ManualRefresh'
import {Page} from 'src/reusable_ui'
import {ErrorHandling} from 'src/shared/decorators/errors'
import HostsPage from 'src/hosts/containers/HostsPage'
import InventoryTopology from 'src/hosts/containers/InventoryTopology'
import DashboardHeader from 'src/dashboards/components/DashboardHeader'
import ImportOverlay from 'src/dashboards/components/ImportOverlay'
import TemplateControlBar from 'src/tempVars/components/TemplateControlBar'

// Actions
import {
  setAutoRefresh,
  delayEnablePresentationMode,
} from 'src/shared/actions/app'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {setCloudAutoRefresh} from 'src/clouds/actions'

// Types
import {
  Source,
  Links,
  TimeRange,
  RefreshRate,
  NotificationAction,
  Template,
  TemplateValue,
  TimeZones,
  Me,
} from 'src/types'
import {timeRanges} from 'src/shared/data/timeRanges'
import * as AppActions from 'src/types/actions/app'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'
import {setTimeZone} from 'src/shared/actions/app'
import {toggleTemplateVariableControlBar} from 'src/shared/actions/app'

import {
  loadCloudServiceProvidersAsync,
  getAWSInstancesAsync,
} from 'src/hosts/actions'

// Utils
import {RouterState, InjectedRouter} from 'react-router'
import {AutoRefreshOption} from 'src/shared/components/dropdown_auto_refresh/autoRefreshOptions'

// Constants
import {getTimeOptionByGroup} from 'src/clouds/constants/autoRefresh'
import {setCloudTimeRange} from 'src/clouds/actions/clouds'
import {generateForHosts} from 'src/utils/tempVars'
import {createTimeRangeTemplates} from 'src/shared/utils/templates'
import {interval} from 'src/shared/constants'
import {
  getLocalStorage,
  setLocalStorage,
} from 'src/shared/middleware/localStorage'

interface RouterProps extends InjectedRouter {
  params: RouterState['params']
}

interface Props extends ManualRefreshProps {
  source: Source
  links: Links
  cloudAutoRefresh: CloudAutoRefresh
  cloudTimeRange: CloudTimeRange
  autoRefresh: number
  inPresentationMode: boolean
  notify: NotificationAction
  onChooseAutoRefresh: (milliseconds: RefreshRate) => void
  onChooseCloudAutoRefresh: (autoRefreshGroup: CloudAutoRefresh) => void
  onChooseCloudTimeRange: (autoRefreshGroup: CloudTimeRange) => void
  handleClearTimeout: (key: string) => void
  handleClickPresentationButton: AppActions.DelayEnablePresentationModeDispatcher
  handleChooseAutoRefresh: AppActions.SetAutoRefreshActionCreator
  router: RouterProps
  timeZone: TimeZones
  onSetTimeZone: typeof setTimeZone
  showTemplateVariableControlBar: boolean
  toggleTemplateVariableControlBar: typeof toggleTemplateVariableControlBar
  me: Me
  isUsingAuth: boolean
}

interface State {
  timeRange: TimeRange
  activeTab: string
  autoRefreshOptions: AutoRefreshOption[] | null
  templates: Template[]
  zoomedTimeRange: TimeRange
  showImportOverlay: boolean
  selectedDashboardItems: any[]
}

@ErrorHandling
class Infrastructure extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    // 로컬 스토리지에서 template variables 복원
    const savedTemplates = getLocalStorage('infrastructureTemplates')
    const initialTemplates =
      savedTemplates?.templates || generateForHosts(props.source)

    this.state = {
      timeRange:
        props.cloudTimeRange?.infrastructure ??
        timeRanges.find(tr => tr.lower === 'now() - 1h'),
      autoRefreshOptions: getTimeOptionByGroup('topology'),
      activeTab: 'topology',
      templates: initialTemplates,
      zoomedTimeRange: {
        upper: null,
        lower: null,
      },
      showImportOverlay: false,
      selectedDashboardItems: [],
    }
  }

  public handleChooseAutoRefresh = (option: {
    milliseconds: RefreshRate
    group?: string
  }) => {
    const {onChooseAutoRefresh, onChooseCloudAutoRefresh} = this.props
    const {milliseconds, group} = option

    group
      ? onChooseCloudAutoRefresh({[group]: milliseconds})
      : onChooseAutoRefresh(milliseconds)
  }

  public componentDidMount() {
    // host 탭일 때 template variable control bar를 기본적으로 표시
    const {
      router,
      showTemplateVariableControlBar,
      toggleTemplateVariableControlBar,
    } = this.props
    const infraTab = _.get(router.params, 'infraTab', 'topology')

    if (infraTab === 'host' && !showTemplateVariableControlBar) {
      toggleTemplateVariableControlBar()
    }
  }

  public static getDerivedStateFromProps(nextProps: Props) {
    const {router} = nextProps

    const infraTab = _.get(router.params, 'infraTab', 'topology')
    return {
      autoRefreshOptions: getTimeOptionByGroup(infraTab),
      activeTab: infraTab,
    }
  }

  public componentDidUpdate(prevProps: Props) {
    // 탭이 host로 변경될 때 template variable control bar를 표시
    const {
      router,
      showTemplateVariableControlBar,
      toggleTemplateVariableControlBar,
    } = this.props
    const prevInfraTab = _.get(prevProps.router.params, 'infraTab', 'topology')
    const infraTab = _.get(router.params, 'infraTab', 'topology')

    if (
      infraTab === 'host' &&
      prevInfraTab !== 'host' &&
      !showTemplateVariableControlBar
    ) {
      toggleTemplateVariableControlBar()
    }
  }

  public render() {
    const {
      autoRefresh,
      cloudAutoRefresh,
      manualRefresh,
      onManualRefresh,
      inPresentationMode,
      source,
      timeZone,
      onSetTimeZone,
      showTemplateVariableControlBar,
      me,
      isUsingAuth,
    } = this.props
    const {activeTab, timeRange, templates, zoomedTimeRange} = this.state

    const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates(
      timeRange,
      zoomedTimeRange
    )

    const templatesIncludingDashTime = [
      ...templates,
      dashboardTime,
      upperDashboardTime,
      interval,
    ]

    return (
      <Page className="hosts-list-page">
        <DashboardHeader
          dashboard={null}
          timeRange={timeRange}
          timeZone={timeZone}
          onSetTimeZone={onSetTimeZone}
          autoRefresh={autoRefresh}
          isHidden={inPresentationMode}
          onAddCell={() => {}}
          onImportFromLibrary={this.handleShowImportOverlay}
          onManualRefresh={onManualRefresh}
          zoomedTimeRange={zoomedTimeRange}
          onRenameDashboard={undefined}
          dashboardLinks={{links: [], active: undefined}}
          activeDashboard="Infrastructure"
          showAnnotationControls={false}
          showTempVarControls={showTemplateVariableControlBar}
          handleChooseAutoRefresh={this.handleChooseAutoRefresh}
          handleChooseTimeRange={this.handleChooseTimeRange}
          onToggleShowTempVarControls={
            this.props.toggleTemplateVariableControlBar
          }
          onToggleShowAnnotationControls={undefined}
          handleClickPresentationButton={
            this.props.handleClickPresentationButton
          }
        />
        {!inPresentationMode && showTemplateVariableControlBar && (
          <TemplateControlBar
            templates={templates}
            me={me}
            isUsingAuth={isUsingAuth}
            onSaveTemplates={this.handleSaveTemplates}
            onPickTemplate={this.handlePickTemplate}
            source={source}
          />
        )}
        <ImportOverlay
          isVisible={this.state.showImportOverlay}
          onDismiss={this.handleHideImportOverlay}
          onImportItems={this.handleImportDashboardItems}
        />
        <Page.Contents scrollable={true} fullWidth={activeTab !== 'host'}>
          <>
            {activeTab === 'host' && (
              //@ts-ignore
              <HostsPage
                {...this.props}
                timeRange={timeRange}
                templates={templatesIncludingDashTime}
                onAddCellsFromLibrary={this.state.selectedDashboardItems}
                onCellsAdded={() => {
                  // Cells added, reset state
                  this.setState({selectedDashboardItems: []})
                }}
              />
            )}
            {activeTab === 'topology' && (
              //@ts-ignore
              <InventoryTopology
                source={source}
                manualRefresh={manualRefresh}
                autoRefresh={cloudAutoRefresh?.topology || 0}
                timeRange={timeRange}
              />
            )}
          </>
        </Page.Contents>
      </Page>
    )
  }

  private handleChooseTimeRange = (timeRange: TimeRange): void => {
    const {onChooseCloudTimeRange} = this.props
    if (timeRange.upper) {
      this.setState({
        timeRange: {lower: timeRange.lower, upper: timeRange.upper},
      })
      onChooseCloudTimeRange({
        infrastructure: {lower: timeRange.lower, upper: timeRange.upper},
      })
    } else {
      const foundTimeRange = timeRanges.find(
        range => range.lower === timeRange.lower
      )
      if (foundTimeRange) {
        this.setState({timeRange: foundTimeRange})
        onChooseCloudTimeRange({
          infrastructure: foundTimeRange,
        })
      }
    }
  }

  private handleShowImportOverlay = () => {
    this.setState({showImportOverlay: true})
  }

  private handleHideImportOverlay = () => {
    this.setState({showImportOverlay: false})
  }

  private handleImportDashboardItems = (items: any[]) => {
    this.setState({selectedDashboardItems: items})
  }

  private handleSaveTemplates = (newTemplates: Template[]): void => {
    this.setState({templates: newTemplates})
    setLocalStorage('infrastructureTemplates', {templates: newTemplates})
  }

  private handlePickTemplate = (
    template: Template,
    value: TemplateValue
  ): void => {
    const {templates} = this.state
    const updatedTemplates = templates.map(t => {
      if (t.id === template.id) {
        return {
          ...t,
          values: t.values.map(v => ({
            ...v,
            localSelected: v.value === value.value,
          })),
        }
      }
      return t
    })
    this.setState({templates: updatedTemplates})
    setLocalStorage('infrastructureTemplates', {templates: updatedTemplates})
  }
}

const mstp = state => {
  const {
    app: {
      persisted: {
        autoRefresh,
        cloudAutoRefresh,
        cloudTimeRange,
        showTemplateVariableControlBar,
        timeZone,
      },
      ephemeral: {inPresentationMode},
    },
    links,
    auth,
  } = state
  return {
    links,
    autoRefresh,
    cloudTimeRange,
    cloudAutoRefresh,
    inPresentationMode,
    showTemplateVariableControlBar,
    timeZone,
    me: auth.me,
    isUsingAuth: !!auth.me,
  }
}

const mdtp = dispatch => ({
  onChooseAutoRefresh: bindActionCreators(setAutoRefresh, dispatch),
  onChooseCloudAutoRefresh: bindActionCreators(setCloudAutoRefresh, dispatch),
  onChooseCloudTimeRange: bindActionCreators(setCloudTimeRange, dispatch),
  handleClickPresentationButton: bindActionCreators(
    delayEnablePresentationMode,
    dispatch
  ),
  notify: bindActionCreators(notifyAction, dispatch),
  handleLoadCspsAsync: bindActionCreators(
    loadCloudServiceProvidersAsync,
    dispatch
  ),
  handleGetAWSInstancesAsync: bindActionCreators(
    getAWSInstancesAsync,
    dispatch
  ),
  onSetTimeZone: bindActionCreators(setTimeZone, dispatch),
  toggleTemplateVariableControlBar: bindActionCreators(
    toggleTemplateVariableControlBar,
    dispatch
  ),
})

export default connect(mstp, mdtp, null)(ManualRefresh<Props>(Infrastructure))
