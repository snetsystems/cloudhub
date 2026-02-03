// Libraries
import React, {useState} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'

// Components
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import ManualRefresh from 'src/shared/components/ManualRefresh'
import {Button, ButtonShape, IconFont, Page} from 'src/reusable_ui'
import {ErrorHandling} from 'src/shared/decorators/errors'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import GraphTips from 'src/shared/components/GraphTips'
import HostsPage from 'src/hosts/containers/HostsPage'
import InventoryTopology from 'src/hosts/containers/InventoryTopology'

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
} from 'src/types'
import {timeRanges} from 'src/shared/data/timeRanges'
import * as AppActions from 'src/types/actions/app'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'

import {
  loadCloudServiceProvidersAsync,
  getAWSInstancesAsync,
} from 'src/hosts/actions'

// Utils
import {RouterProps} from 'react-router'

// Constants
import {getTimeOptionByGroup} from 'src/clouds/constants/autoRefresh'
import {setCloudTimeRange} from 'src/clouds/actions/clouds'

export interface ManualRefreshProps {
  manualRefresh: number
  onManualRefresh: () => void
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
  router: RouterProps
}

function TopologyRouter({
  source,
  cloudAutoRefresh,
  cloudTimeRange,
  autoRefresh,
  inPresentationMode,
  onChooseAutoRefresh,
  onChooseCloudAutoRefresh,
  onChooseCloudTimeRange,
  handleClickPresentationButton,
  manualRefresh,
  onManualRefresh,
}: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>(
    cloudTimeRange?.topology ?? timeRanges.find(tr => tr.lower === 'now() - 1h')
  )

  const handleChooseTimeRange = ({lower, upper}) => {
    if (upper) {
      setTimeRange({lower, upper})
      onChooseCloudTimeRange({topology: {lower, upper}})
    } else {
      setTimeRange(timeRanges.find(tr => tr.lower === lower))
      onChooseCloudTimeRange({
        topology: timeRanges.find(tr => tr.lower === lower),
      })
    }
  }

  const handleChooseAutoRefresh = (option: {
    milliseconds: RefreshRate
    group?: string
  }) => {
    const {milliseconds, group} = option
    group
      ? onChooseCloudAutoRefresh({[group]: milliseconds})
      : onChooseAutoRefresh(milliseconds)
  }

  return (
    <Page className="hosts-list-page">
      <Page.Header inPresentationMode={inPresentationMode}>
        <Page.Header.Left>
          <Page.Title title={'Infrastructure'} />
        </Page.Header.Left>

        <Page.Header.Right showSourceIndicator={true}>
          <AutoRefreshDropdown
            selected={autoRefresh}
            onChoose={handleChooseAutoRefresh}
            onManualRefresh={onManualRefresh}
            customAutoRefreshOptions={getTimeOptionByGroup('topology')}
            customAutoRefreshSelected={cloudAutoRefresh}
          />
          <TimeRangeDropdown
            //@ts-ignore
            onChooseTimeRange={handleChooseTimeRange}
            selected={timeRange}
          />
          <Button
            icon={IconFont.ExpandA}
            onClick={handleClickPresentationButton}
            shape={ButtonShape.Square}
            titleText="Enter Full-Screen Presentation Mode"
          />
        </Page.Header.Right>
      </Page.Header>

      <Page.Contents scrollable={true} fullWidth={true}>
        <>
          {/* @ts-ignore */}
          <InventoryTopology
            source={source}
            manualRefresh={manualRefresh}
            autoRefresh={cloudAutoRefresh?.topology || 0}
            timeRange={cloudTimeRange?.topology}
          />
        </>
      </Page.Contents>
    </Page>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {autoRefresh, cloudAutoRefresh, cloudTimeRange},
      ephemeral: {inPresentationMode},
    },
    links,
  } = state
  return {
    links,
    autoRefresh,
    cloudTimeRange,
    cloudAutoRefresh,
    inPresentationMode,
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
})

export default connect(mstp, mdtp, null)(ManualRefresh<Props>(TopologyRouter))
