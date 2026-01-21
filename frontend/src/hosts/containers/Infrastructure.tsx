// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'

// Actions
import {
  setAutoRefresh,
  delayEnablePresentationMode,
  setTimeZone,
  toggleTemplateVariableControlBar,
} from 'src/shared/actions/app'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {setCloudAutoRefresh} from 'src/clouds/actions'
import {setCloudTimeRange} from 'src/clouds/actions/clouds'
import {
  loadCloudServiceProvidersAsync,
  getAWSInstancesAsync,
} from 'src/hosts/actions'

// Types
import {
  RefreshRate,
  Links,
  Source,
  Me,
  NotificationAction,
  TimeZones,
} from 'src/types'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'
import * as AppActions from 'src/types/actions/app'

// Components
import HostsPageContainer from 'src/hosts/containers/HostsPageContainer'
import TopologyPageContainer from 'src/hosts/containers/TopologyPageContainer'

// Utils
import {RouterState, InjectedRouter} from 'react-router'

interface RouterProps extends InjectedRouter {
  params: RouterState['params']
}

interface Props {
  // Parent injected props (CheckSources)
  router: RouterProps
  source: Source
  links: Links
  me: Me
  isUsingAuth: boolean

  // Connect injected props (from mapStateToProps - though we return empty, we might rely on parent/others?
  // No, we need to correct mstp if we want these here?
  // Wait, if mstp is empty but Infrastructure expects properites, where do they come from?
  // They must be passed from parent OR we must update mstp.
  // Original Infrastructure had these in mstp.
  // I will add them to mstp to be safe and logical.)
  autoRefresh: number
  cloudAutoRefresh: CloudAutoRefresh
  cloudTimeRange: CloudTimeRange
  inPresentationMode: boolean
  showTemplateVariableControlBar: boolean
  timeZone: TimeZones

  // Dispatch Props
  onChooseAutoRefresh: (milliseconds: RefreshRate) => void
  onChooseCloudAutoRefresh: (autoRefreshGroup: CloudAutoRefresh) => void
  onChooseCloudTimeRange: (autoRefreshGroup: CloudTimeRange) => void
  handleClearTimeout: (key: string) => void
  handleClickPresentationButton: AppActions.DelayEnablePresentationModeDispatcher
  handleChooseAutoRefresh: AppActions.SetAutoRefreshActionCreator
  onSetTimeZone: typeof setTimeZone
  toggleTemplateVariableControlBar: typeof toggleTemplateVariableControlBar
  notify: NotificationAction
  handleLoadCspsAsync: typeof loadCloudServiceProvidersAsync
  handleGetAWSInstancesAsync: typeof getAWSInstancesAsync

  [key: string]: any // Allow overly permissive props to simple router wrapper
}

class Infrastructure extends PureComponent<Props> {
  public render() {
    const {router} = this.props
    const infraTab = _.get(router.params, 'infraTab', 'topology')

    if (infraTab === 'host') {
      return (
        // @ts-ignore
        <HostsPageContainer {...this.props} />
      )
    }

    // @ts-ignore
    return <TopologyPageContainer {...this.props} />
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
  } = state
  return {
    autoRefresh,
    cloudAutoRefresh,
    cloudTimeRange,
    inPresentationMode,
    showTemplateVariableControlBar,
    timeZone,
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

export default connect(mstp, mdtp, null)(Infrastructure)
