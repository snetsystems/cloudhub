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
import {Button, ButtonShape, IconFont, Page} from 'src/reusable_ui'
import {ErrorHandling} from 'src/shared/decorators/errors'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import GraphTips from 'src/shared/components/GraphTips'

import VMHostPage from 'src/clouds/containers/VMHostsPage'
import KubernetesPage from 'src/clouds/containers/KubernetesPage'
import OpenStackPage from 'src/clouds/containers/OpenStackPage'

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

// Utils
import {RouterState, InjectedRouter} from 'react-router'

// Constants
import {AutoRefreshOption} from 'src/shared/components/dropdown_auto_refresh/autoRefreshOptions'
import {getTimeOptionByGroup} from 'src/clouds/constants/autoRefresh'

interface RouterProps extends InjectedRouter {
  params: RouterState['params']
}

interface Props extends ManualRefreshProps {
  source: Source
  links: Links
  autoRefresh: number
  cloudAutoRefresh: CloudAutoRefresh
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
  autoRefreshOptions: AutoRefreshOption[] | null
  currentRoute: string | null
}

@ErrorHandling
class Clouds extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    const currentRoute = this.props.router.params?.cloud

    this.state = {
      timeRange: timeRanges.find(tr => tr.lower === 'now() - 1h'),
      autoRefreshOptions: getTimeOptionByGroup(currentRoute),
      currentRoute,
    }
  }

  componentDidUpdate(): void {
    if (this.state.currentRoute !== this.props.router.params?.cloud) {
      const currentRoute = this.props.router.params?.cloud

      this.setState(prevState => ({
        ...prevState,
        autoRefreshOptions: getTimeOptionByGroup(currentRoute),
        currentRoute,
      }))
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

  public render() {
    const {
      autoRefresh,
      cloudAutoRefresh,
      manualRefresh,
      onManualRefresh,
      inPresentationMode,
      source,
      handleClearTimeout,
      router,
    } = this.props
    const {timeRange, autoRefreshOptions, currentRoute} = this.state

    return (
      <Page className="hosts-list-page">
        <Page.Header inPresentationMode={inPresentationMode}>
          <Page.Header.Left>
            <Page.Title
              title={
                _.get(router.params, 'cloud') === 'vmware'
                  ? 'VMware'
                  : _.get(router.params, 'cloud') === 'kubernetes'
                  ? 'Kubernetes'
                  : _.get(router.params, 'cloud') === 'openstack'
                  ? 'Openstack'
                  : 'Clouds'
              }
            />
          </Page.Header.Left>
          <Page.Header.Right showSourceIndicator={true}>
            <GraphTips />
            <AutoRefreshDropdown
              selected={autoRefresh}
              onChoose={this.handleChooseAutoRefresh}
              onManualRefresh={onManualRefresh}
              customAutoRefreshOptions={autoRefreshOptions}
              customAutoRefreshSelected={cloudAutoRefresh}
            />
            {currentRoute !== 'openstack' && (
              <TimeRangeDropdown
                //@ts-ignore
                onChooseTimeRange={this.handleChooseTimeRange}
                selected={timeRange}
              />
            )}
            <Button
              icon={IconFont.ExpandA}
              onClick={this.handleClickPresentationButton}
              shape={ButtonShape.Square}
              titleText="Enter Full-Screen Presentation Mode"
            />
          </Page.Header.Right>
        </Page.Header>
        <Page.Contents scrollable={true} fullWidth={true}>
          <>
            {_.get(router.params, 'cloud') === 'vmware' && (
              //@ts-ignore
              <VMHostPage
                source={source}
                manualRefresh={manualRefresh}
                timeRange={timeRange}
                autoRefresh={autoRefresh}
                handleClearTimeout={handleClearTimeout}
              />
            )}
            {_.get(router.params, 'cloud') === 'kubernetes' && (
              //@ts-ignore
              <KubernetesPage
                source={source}
                manualRefresh={manualRefresh}
                timeRange={timeRange}
                autoRefresh={autoRefresh}
              />
            )}
            {_.get(router.params, 'cloud') === 'openstack' && (
              //@ts-ignore
              <OpenStackPage
                source={source}
                manualRefresh={manualRefresh}
                timeRange={timeRange}
                autoRefresh={cloudAutoRefresh?.openstack || 0}
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
})

export default connect(mstp, mdtp, null)(ManualRefresh<Props>(Clouds))
