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
import VMHostPage from 'src/hosts/containers/VMHostsPage'
import InventoryTopology from 'src/hosts/containers/InventoryTopology'
import KubernetesPage from 'src/hosts/containers/KubernetesPage'

// Actions
import {
  setAutoRefresh,
  delayEnablePresentationMode,
} from 'src/shared/actions/app'
import {notify as notifyAction} from 'src/shared/actions/notifications'

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

import {
  loadCloudServiceProvidersAsync,
  getAWSInstancesAsync,
} from 'src/hosts/actions'

// Utils
import {RouterState, InjectedRouter} from 'react-router'

interface RouterProps extends InjectedRouter {
  params: RouterState['params']
}

interface Props extends ManualRefreshProps {
  source: Source
  links: Links
  autoRefresh: number
  inPresentationMode: boolean
  notify: NotificationAction
  onChooseAutoRefresh: (milliseconds: RefreshRate) => void
  handleClearTimeout: (key: string) => void
  handleClickPresentationButton: AppActions.DelayEnablePresentationModeDispatcher
  handleChooseAutoRefresh: AppActions.SetAutoRefreshActionCreator
  router: RouterProps
}

interface State {
  timeRange: TimeRange
  activeTab: string
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
      activeTab: 'topology',
      headerRadioButtons: [],
    }
  }

  public handleChooseAutoRefresh = (option: {milliseconds: RefreshRate}) => {
    const {onChooseAutoRefresh} = this.props
    const {milliseconds} = option

    onChooseAutoRefresh(milliseconds)
  }

  public static getDerivedStateFromProps(nextProps: Props) {
    const {source, router, links} = nextProps
    const {addons} = links

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

    const isUsingVsphere = !_.isEmpty(
      _.find(addons, addon => {
        const {name, url} = addon
        return name === 'vsphere' && url === 'on'
      })
    )

    const isUsingKubernetes = !_.isEmpty(
      _.find(addons, addon => {
        const {name, url} = addon
        return name === 'kubernetes' && url === 'on'
      })
    )

    if (isUsingVsphere) {
      headerRadioButtons.push({
        id: 'hostspage-tab-VMware',
        titleText: 'VMware',
        value: 'vmware',
        active: 'vmware',
        label: 'VMware',
      })
    }

    if (isUsingKubernetes) {
      headerRadioButtons.push({
        id: 'hostspage-tab-Kubernetes',
        titleText: 'Kubernetes',
        value: 'kubernetes',
        active: 'kubernetes',
        label: 'Kubernetes',
      })
    }

    let isRedirect = false

    if (
      (!isUsingVsphere && infraTab === 'vmware') ||
      (!isUsingKubernetes && infraTab === 'kubernetes')
    ) {
      isRedirect = true
    }

    if (isRedirect) {
      router.replace(`/sources/${source.id}/infrastructure/topology`)
    }

    return {
      activeTab: infraTab,
      headerRadioButtons,
    }
  }

  public render() {
    const {
      autoRefresh,
      manualRefresh,
      onManualRefresh,
      inPresentationMode,
      source,
      handleClearTimeout,
    } = this.props
    const {activeTab, timeRange, headerRadioButtons} = this.state

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
              <HostsPage {...this.props} />
            )}
            {activeTab === 'vmware' && (
              //@ts-ignore
              <VMHostPage
                source={source}
                manualRefresh={manualRefresh}
                timeRange={timeRange}
                handleClearTimeout={handleClearTimeout}
              />
            )}
            {activeTab === 'topology' && (
              //@ts-ignore
              <InventoryTopology
                source={source}
                manualRefresh={manualRefresh}
                autoRefresh={autoRefresh}
              />
            )}
            {activeTab === 'kubernetes' && (
              //@ts-ignore
              <KubernetesPage
                source={source}
                manualRefresh={manualRefresh}
                timeRange={timeRange}
                autoRefresh={autoRefresh}
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
      persisted: {autoRefresh},
      ephemeral: {inPresentationMode},
    },
    links,
  } = state
  return {
    links,
    autoRefresh,
    inPresentationMode,
  }
}

const mdtp = dispatch => ({
  onChooseAutoRefresh: bindActionCreators(setAutoRefresh, dispatch),
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
