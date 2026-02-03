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
import KubernetesTip from 'src/shared/components/KubernetesTip'

import VMHostPage from 'src/clouds/containers/VMHostsPage'
// Actions
import {
  delayEnablePresentationMode,
  setAutoRefresh,
} from 'src/shared/actions/app'
import {setCloudAutoRefresh} from 'src/clouds/actions'

// Types
import {Source, RefreshRate, NotificationAction} from 'src/types'
import {DEFAULT_TIME_RANGE, timeRanges} from 'src/shared/data/timeRanges'
import * as AppActions from 'src/types/actions/app'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'

// Constants
import {getTimeOptionByGroup} from 'src/clouds/constants/autoRefresh'
import {setCloudTimeRange} from 'src/clouds/actions/clouds'

interface Props extends ManualRefreshProps {
  source: Source
  autoRefresh: number
  cloudAutoRefresh: CloudAutoRefresh
  cloudTimeRange: CloudTimeRange
  onChooseCloudTimeRange: (timeRange: CloudTimeRange) => void
  inPresentationMode: boolean
  notify: NotificationAction
  onChooseAutoRefresh: (milliseconds: RefreshRate) => void
  onChooseCloudAutoRefresh: (autoRefreshGroup: CloudAutoRefresh) => void
  handleClearTimeout: (key: string) => void
  handleClickPresentationButton: AppActions.DelayEnablePresentationModeDispatcher
}

function VMHostRouter({
  source,
  autoRefresh,
  cloudAutoRefresh,
  cloudTimeRange,
  onChooseCloudTimeRange,
  inPresentationMode,
  onChooseAutoRefresh,
  onChooseCloudAutoRefresh,
  handleClickPresentationButton,
  manualRefresh,
  onManualRefresh,
  handleClearTimeout,
}: Props) {
  const handleChooseAutoRefresh = (option: {
    milliseconds: RefreshRate
    group?: string
  }) => {
    const {milliseconds, group} = option
    group
      ? onChooseCloudAutoRefresh({[group]: milliseconds})
      : onChooseAutoRefresh(milliseconds)
  }

  const handleChooseTimeRange = ({lower, upper}) => {
    if (upper) {
      onChooseCloudTimeRange({vmware: {lower, upper}})
    } else {
      const timeRange = timeRanges.find(range => range.lower === lower)
      onChooseCloudTimeRange({vmware: timeRange})
    }
  }

  return (
    <Page className="hosts-list-page">
      <Page.Header inPresentationMode={inPresentationMode}>
        <Page.Header.Left>
          <Page.Title title={'VMware'} />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true}>
          <KubernetesTip />
          <AutoRefreshDropdown
            selected={autoRefresh}
            onChoose={handleChooseAutoRefresh}
            onManualRefresh={onManualRefresh}
            customAutoRefreshOptions={getTimeOptionByGroup('vmware')}
            customAutoRefreshSelected={cloudAutoRefresh}
          />
          <TimeRangeDropdown
            onChooseTimeRange={handleChooseTimeRange}
            selected={cloudTimeRange?.vmware ?? DEFAULT_TIME_RANGE}
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
          <VMHostPage
            source={source}
            manualRefresh={manualRefresh}
            timeRange={cloudTimeRange?.vmware ?? DEFAULT_TIME_RANGE}
            autoRefresh={cloudAutoRefresh?.vmware || 0}
            handleClearTimeout={handleClearTimeout}
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
  } = state

  return {
    autoRefresh,
    cloudAutoRefresh,
    inPresentationMode,
    cloudTimeRange,
  }
}

const mdtp = dispatch => ({
  onChooseCloudAutoRefresh: bindActionCreators(setCloudAutoRefresh, dispatch),
  onChooseCloudTimeRange: bindActionCreators(setCloudTimeRange, dispatch),
  handleClickPresentationButton: bindActionCreators(
    delayEnablePresentationMode,
    dispatch
  ),
  onChooseAutoRefresh: bindActionCreators(setAutoRefresh, dispatch),
})

export default connect(mstp, mdtp, null)(ManualRefresh<Props>(VMHostRouter))
