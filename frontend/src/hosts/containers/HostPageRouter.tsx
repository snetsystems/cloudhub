// Libraries
import React from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'

// Components
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import ManualRefresh, {
  ManualRefreshProps,
} from 'src/shared/components/ManualRefresh'
import {Button, ButtonShape, IconFont, Page} from 'src/reusable_ui'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import GraphTips from 'src/shared/components/GraphTips'
import HostsPage from 'src/hosts/containers/HostsPage'

// Actions
import {delayEnablePresentationMode} from 'src/shared/actions/app'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {setCloudAutoRefresh} from 'src/clouds/actions'

// Types
import {Source, Links, RefreshRate, NotificationAction} from 'src/types'
import {timeRanges, DEFAULT_TIME_RANGE} from 'src/shared/data/timeRanges'
import * as AppActions from 'src/types/actions/app'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'

import {
  loadCloudServiceProvidersAsync,
  getAWSInstancesAsync,
} from 'src/hosts/actions'

// Utils
import {RouterState, InjectedRouter} from 'react-router'

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
  inPresentationMode: boolean
  notify: NotificationAction
  onChooseCloudAutoRefresh: (autoRefreshGroup: CloudAutoRefresh) => void
  onChooseCloudTimeRange: (autoRefreshGroup: CloudTimeRange) => void
  handleClearTimeout: (key: string) => void
  handleClickPresentationButton: AppActions.DelayEnablePresentationModeDispatcher
  router: RouterProps
}
// this page was originally used for the hosts page, but now it is used for the server list page
function HostPageRouter(props: Props) {
  const {
    cloudAutoRefresh,
    cloudTimeRange,
    inPresentationMode,
    onChooseCloudAutoRefresh,
    onChooseCloudTimeRange,
    handleClickPresentationButton,
    onManualRefresh,
  } = props

  const handleChooseAutoRefresh = (option: {
    milliseconds: RefreshRate
    group?: string
  }) => {
    const {milliseconds} = option

    onChooseCloudAutoRefresh({serverList: milliseconds})
  }

  const handleChooseTimeRange = ({lower, upper}) => {
    if (upper) {
      onChooseCloudTimeRange({
        serverList: {lower, upper},
      })
    } else {
      const timeRange = timeRanges.find(range => range.lower === lower)
      onChooseCloudTimeRange({
        serverList: timeRange,
      })
    }
  }

  return (
    <Page className="hosts-list-page">
      <Page.Header inPresentationMode={inPresentationMode}>
        <Page.Header.Left>
          <Page.Title title={'Server List'} />
        </Page.Header.Left>

        <Page.Header.Right showSourceIndicator={true}>
          <GraphTips />
          <AutoRefreshDropdown
            selected={cloudAutoRefresh.serverList}
            onChoose={handleChooseAutoRefresh}
            onManualRefresh={onManualRefresh}
            customAutoRefreshOptions={getTimeOptionByGroup('serverList')}
            customAutoRefreshSelected={cloudAutoRefresh}
          />
          <TimeRangeDropdown
            //@ts-ignore
            onChooseTimeRange={handleChooseTimeRange}
            selected={cloudTimeRange?.serverList ?? DEFAULT_TIME_RANGE}
          />
          <Button
            icon={IconFont.ExpandA}
            onClick={handleClickPresentationButton}
            shape={ButtonShape.Square}
            titleText="Enter Full-Screen Presentation Mode"
          />
        </Page.Header.Right>
      </Page.Header>
      <Page.Contents scrollable={true} fullWidth={false}>
        <>
          {/* @ts-ignore */}
          <HostsPage
            {...props}
            timeRange={cloudTimeRange?.serverList ?? DEFAULT_TIME_RANGE}
          />
        </>
      </Page.Contents>
    </Page>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {cloudAutoRefresh, cloudTimeRange},
      ephemeral: {inPresentationMode},
    },
    links,
  } = state
  return {
    links,
    cloudTimeRange,
    cloudAutoRefresh,
    inPresentationMode,
  }
}

const mdtp = dispatch => ({
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
})

export default connect(mstp, mdtp, null)(ManualRefresh<Props>(HostPageRouter))
