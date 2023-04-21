// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'

// Components
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import ManualRefresh, {
  ManualRefreshProps,
} from 'src/shared/components/ManualRefresh'
import {Button, ButtonShape, IconFont, Page, Radio} from 'src/reusable_ui'
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
import {CloudAutoRefresh} from 'src/clouds/types/type'

import {
  loadCloudServiceProvidersAsync,
  getAWSInstancesAsync,
} from 'src/hosts/actions'

// Utils
import {RouterState, InjectedRouter} from 'react-router'
import {AutoRefreshOption} from 'src/shared/components/dropdown_auto_refresh/autoRefreshOptions'

// Constants
import {getTimeOptionByGroup} from 'src/clouds/constants/autoRefresh'

interface RouterProps extends InjectedRouter {
  params: RouterState['params']
}

interface Props extends ManualRefreshProps {
  source: Source
  links: Links
  cloudAutoRefresh: CloudAutoRefresh
  autoRefresh: number
  inPresentationMode: boolean
  notify: NotificationAction
  onChooseAutoRefresh: (milliseconds: RefreshRate) => void
  onChooseCloudAutoRefresh: (autoRefreshGroup: CloudAutoRefresh) => void
  handleClearTimeout: (key: string) => void
  handleClickPresentationButton: AppActions.DelayEnablePresentationModeDispatcher
  handleChooseAutoRefresh: AppActions.SetAutoRefreshActionCreator
  router: RouterProps
}

interface State {
  timeRange: TimeRange
  activeTab: string
  autoRefreshOptions: AutoRefreshOption[] | null
  headerRadioButtons: {
    id: string
    titleText: string
    value: string
    active: string
    label: string
  }[]
}

@ErrorHandling
class Infrastructure extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      timeRange: timeRanges.find(tr => tr.lower === 'now() - 1h'),
      autoRefreshOptions: getTimeOptionByGroup('topology'),
      activeTab: 'topology',
      headerRadioButtons: [],
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

  public static getDerivedStateFromProps(nextProps: Props) {
    const {router} = nextProps

    const infraTab = _.get(router.params, 'infraTab', 'topology')
    const defaultHeaderRadioButtons = [
      {
        id: 'hostspage-tab-InventoryTopology',
        titleText: 'InventoryTopology',
        value: 'topology',
        active: 'topology',
        label: 'Topology',
      },
      {
        id: 'hostspage-tab-Host',
        titleText: 'Host',
        value: 'host',
        active: 'host',
        label: 'Host',
      },
    ]

    const headerRadioButtons = [...defaultHeaderRadioButtons]

    return {
      autoRefreshOptions: getTimeOptionByGroup(infraTab),
      activeTab: infraTab,
      headerRadioButtons,
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
    } = this.props
    const {
      activeTab,
      timeRange,
      headerRadioButtons,
      autoRefreshOptions,
    } = this.state

    return (
      <Page className="hosts-list-page">
        <Page.Header inPresentationMode={inPresentationMode}>
          <Page.Header.Left>
            <Page.Title title={'Infrastructure'} />
          </Page.Header.Left>
          <Page.Header.Center widthPixels={headerRadioButtons.length * 90}>
            <div className="radio-buttons radio-buttons--default radio-buttons--sm radio-buttons--stretch">
              {headerRadioButtons.map(rBtn => {
                return (
                  <Radio.Button
                    key={rBtn.titleText}
                    id={rBtn.id}
                    titleText={rBtn.titleText}
                    value={rBtn.value}
                    active={activeTab === rBtn.active}
                    onClick={this.onChooseActiveTab}
                  >
                    {rBtn.label}
                  </Radio.Button>
                )
              })}
            </div>
          </Page.Header.Center>

          <Page.Header.Right showSourceIndicator={true}>
            {activeTab !== 'topology' && <GraphTips />}
            <AutoRefreshDropdown
              selected={autoRefresh}
              onChoose={this.handleChooseAutoRefresh}
              onManualRefresh={onManualRefresh}
              customAutoRefreshOptions={autoRefreshOptions}
              customAutoRefreshSelected={cloudAutoRefresh}
            />
            <TimeRangeDropdown
              //@ts-ignore
              onChooseTimeRange={this.handleChooseTimeRange}
              selected={timeRange}
            />
            <Button
              icon={IconFont.ExpandA}
              onClick={this.handleClickPresentationButton}
              shape={ButtonShape.Square}
              titleText="Enter Full-Screen Presentation Mode"
            />
          </Page.Header.Right>
        </Page.Header>
        <Page.Contents scrollable={true} fullWidth={activeTab !== 'host'}>
          <>
            {activeTab === 'host' && (
              //@ts-ignore
              <HostsPage {...this.props} timeRange={timeRange} />
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

  private handleChooseTimeRange = ({lower, upper}) => {
    if (upper) {
      this.setState({timeRange: {lower, upper}})
    } else {
      const timeRange = timeRanges.find(range => range.lower === lower)
      this.setState({timeRange})
    }
  }

  private handleClickPresentationButton = (): void => {
    this.props.handleClickPresentationButton()
  }

  private onChooseActiveTab = (activeTab: string): void => {
    const {router, source} = this.props
    router.push(`/sources/${source.id}/infrastructure/${activeTab}`)
  }
}

const mstp = state => {
  const {
    app: {
      persisted: {autoRefresh, cloudAutoRefresh},
      ephemeral: {inPresentationMode},
    },
    links,
  } = state
  return {
    links,
    autoRefresh,
    cloudAutoRefresh,
    inPresentationMode,
  }
}

const mdtp = dispatch => ({
  onChooseAutoRefresh: bindActionCreators(setAutoRefresh, dispatch),
  onChooseCloudAutoRefresh: bindActionCreators(setCloudAutoRefresh, dispatch),
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

export default connect(mstp, mdtp, null)(ManualRefresh<Props>(Infrastructure))
