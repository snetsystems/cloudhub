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
import InventoryTopology from 'src/hosts/containers/InventoryTopology'
import DashboardHeader from 'src/dashboards/components/DashboardHeader'

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
  TimeZones,
} from 'src/types'
import {timeRanges} from 'src/shared/data/timeRanges'
import * as AppActions from 'src/types/actions/app'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'
import {setTimeZone} from 'src/shared/actions/app'

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
  // Not used in Topology but kept for compatibility with parent props if needed
  showTemplateVariableControlBar: boolean
}

interface State {
  timeRange: TimeRange
  autoRefreshOptions: AutoRefreshOption[] | null
  zoomedTimeRange: TimeRange
}

@ErrorHandling
class TopologyPageContainer extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      timeRange:
        props.cloudTimeRange?.infrastructure ??
        timeRanges.find(tr => tr.lower === 'now() - 1h'),
      autoRefreshOptions: getTimeOptionByGroup('topology'),
      zoomedTimeRange: {
        upper: null,
        lower: null,
      },
    }
  }

  public handleChooseAutoRefresh = (option: {
    milliseconds: RefreshRate
    group?: string
  }) => {
    const {onChooseCloudAutoRefresh} = this.props
    const {milliseconds} = option

    // Always update 'topology' group for this container
    onChooseCloudAutoRefresh({topology: milliseconds})
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
    } = this.props
    const {timeRange, zoomedTimeRange} = this.state

    return (
      <Page className="hosts-list-page">
        <DashboardHeader
          dashboard={null}
          timeRange={timeRange}
          timeZone={timeZone}
          onSetTimeZone={onSetTimeZone}
          autoRefresh={autoRefresh}
          isHidden={inPresentationMode}
          onAddCell={undefined} // Hidden in Topology
          onImportFromLibrary={undefined} // Hidden in Topology
          onManualRefresh={onManualRefresh}
          zoomedTimeRange={zoomedTimeRange}
          onRenameDashboard={undefined}
          dashboardLinks={{links: [], active: undefined}}
          activeDashboard="Infrastructure"
          showAnnotationControls={false}
          showTempVarControls={false} // Hidden in Topology
          handleChooseAutoRefresh={this.handleChooseAutoRefresh}
          handleChooseTimeRange={this.handleChooseTimeRange}
          onToggleShowTempVarControls={undefined}
          onToggleShowAnnotationControls={undefined}
          handleClickPresentationButton={
            this.props.handleClickPresentationButton
          }
        />
        {/* No TemplateControlBar in Topology */}
        {/* No ImportOverlay needed in Topology */}

        <Page.Contents scrollable={true} fullWidth={true}>
          <InventoryTopology
            source={source}
            manualRefresh={manualRefresh}
            autoRefresh={cloudAutoRefresh?.topology || 0}
            timeRange={timeRange}
          />
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
    autoRefresh: cloudAutoRefresh?.topology || 0, // Use Topology-specific autoRefresh
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
})

export default connect(
  mstp,
  mdtp,
  null
)(ManualRefresh<Props>(TopologyPageContainer))
