// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'
import {getDeep} from 'src/utils/wrappers'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import Dropdown from 'src/shared/components/Dropdown'
import HostsTable from 'src/hosts/components/HostsTable'
import AWSHostsTable from 'src/hosts/components/AWSHostsTable'
import HostLayoutRenderer from 'src/hosts/components/HostLayoutRenderer'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import ManualRefresh, {
  ManualRefreshProps,
} from 'src/shared/components/ManualRefresh'
import {Button, ButtonShape, IconFont, Page, Radio} from 'src/reusable_ui'
import {ErrorHandling} from 'src/shared/decorators/errors'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import GraphTips from 'src/shared/components/GraphTips'
import VMHostPage from 'src/hosts/containers/VMHostsPage'
import InventoryTopology from 'src/hosts/containers/InventoryTopology'

// APIs
import {
  getCpuAndLoadForHosts,
  getLayouts,
  getAppsForHosts,
  getAppsForHost,
  getMeasurementsForHost,
  getCSP,
} from 'src/hosts/apis'
import {getEnv} from 'src/shared/apis/env'

// Actions
import {
  setAutoRefresh,
  delayEnablePresentationMode,
} from 'src/shared/actions/app'
import {notify as notifyAction} from 'src/shared/actions/notifications'

//Middleware
import {
  setLocalStorage,
  getLocalStorage,
} from 'src/shared/middleware/localStorage'

// Utils
import {generateForHosts} from 'src/utils/tempVars'
import {getCells} from 'src/hosts/utils/getCells'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

// Constants
import {
  notifyUnableToGetHosts,
  notifyUnableToGetApps,
} from 'src/shared/copy/notifications'

//const
import {HANDLE_HORIZONTAL} from 'src/shared/constants'

// Types
import {
  Source,
  Links,
  NotificationAction,
  RemoteDataState,
  Host,
  Layout,
  TimeRange,
  RefreshRate,
  CloudHosts,
} from 'src/types'
import {timeRanges} from 'src/shared/data/timeRanges'
import * as QueriesModels from 'src/types/queries'
import * as AppActions from 'src/types/actions/app'

import {saltDetailsDummy} from './detailsTest'
import yaml from 'js-yaml'

interface Props extends ManualRefreshProps {
  source: Source
  links: Links
  autoRefresh: number
  onChooseAutoRefresh: (milliseconds: RefreshRate) => void
  handleClearTimeout: (key: string) => void
  notify: NotificationAction
}

interface Props {
  handleChooseTimeRange: (timeRange: QueriesModels.TimeRange) => void
  handleChooseAutoRefresh: AppActions.SetAutoRefreshActionCreator
  handleClickPresentationButton: AppActions.DelayEnablePresentationModeDispatcher
  inPresentationMode: boolean
}

interface State {
  hostsObject: {[x: string]: Host}
  hostsPageStatus: RemoteDataState
  layouts: Layout[]
  filteredLayouts: Layout[]
  focusedHost: string
  HostsTableStateDump: {}
  timeRange: TimeRange
  proportions: number[]
  selected: QueriesModels.TimeRange
  isVsphere: boolean
  activeEditorTab: string
  selectedAgent: string
  selectedProvider: string
  cloudHostsObject: CloudHosts
}

@ErrorHandling
export class HostsPage extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    manualRefresh: 0,
  }
  public intervalID: number
  private isComponentMounted: boolean = true

  constructor(props: Props) {
    super(props)

    this.setState = (args, callback) => {
      if (!this.isComponentMounted) return

      PureComponent.prototype.setState.bind(this)(args, callback)
    }

    this.state = {
      hostsObject: {},
      hostsPageStatus: RemoteDataState.NotStarted,
      layouts: [],
      filteredLayouts: [],
      focusedHost: '',
      HostsTableStateDump: {},
      timeRange: timeRanges.find(tr => tr.lower === 'now() - 1h'),
      proportions: [0.43, 0.57],
      selected: {lower: '', upper: ''},
      isVsphere: false,
      // activeEditorTab: 'InventoryTopology',
      activeEditorTab: 'Host',
      selectedAgent: 'CloudWatch',
      selectedProvider: 'AWS',
      cloudHostsObject: {},
    }
    this.handleChooseAutoRefresh = this.handleChooseAutoRefresh.bind(this)
    this.onSetActiveEditorTab = this.onSetActiveEditorTab.bind(this)
  }

  public componentWillMount() {
    this.setState({selected: this.state.timeRange})
  }

  public async componentDidMount() {
    this.testCloudHosts()
    const hostsTableState = getLocalStorage('hostsTableState')
    const {focusedHost} =
      hostsTableState && hostsTableState.focusedHost
        ? hostsTableState.focusedHost
        : ''

    const getItem = getLocalStorage('hostsTableStateProportions')
    const {proportions} = getItem || this.state

    const convertProportions = Array.isArray(proportions)
      ? proportions
      : proportions.split(',').map(v => Number(v))

    const {notify, autoRefresh} = this.props

    const layoutResults = await getLayouts()
    const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

    if (!layouts) {
      notify(notifyUnableToGetApps())
      this.setState({
        hostsPageStatus: RemoteDataState.Error,
        layouts,
      })
      return
    }

    // For rendering whole hosts list
    await this.fetchHostsData(layouts)

    // For rendering the charts with the focused single host.
    const hostID = focusedHost || this.getFirstHost(this.state.hostsObject)

    if (autoRefresh) {
      this.intervalID = window.setInterval(
        () => this.fetchHostsData(layouts),
        autoRefresh
      )
    }
    GlobalAutoRefresher.poll(autoRefresh)

    this.setState({
      layouts,
      focusedHost: hostID,
      proportions: convertProportions,
      hostsPageStatus: RemoteDataState.Loading,
    })
  }

  public async componentDidUpdate(prevProps: Props, prevState: State) {
    const {autoRefresh} = this.props
    const {layouts, focusedHost} = this.state

    if (layouts) {
      if (prevState.focusedHost !== focusedHost) {
        this.fetchHostsData(layouts)
        const {filteredLayouts} = await this.getLayoutsforHost(
          layouts,
          focusedHost
        )
        this.setState({filteredLayouts})
      }

      if (prevProps.autoRefresh !== autoRefresh) {
        GlobalAutoRefresher.poll(autoRefresh)
      }
    }

    if (prevState.selectedProvider !== this.state.selectedProvider) {
      // this.setState
    }
  }

  public async UNSAFE_componentWillReceiveProps(nextProps: Props) {
    const {layouts, focusedHost} = this.state

    if (layouts) {
      if (this.props.manualRefresh !== nextProps.manualRefresh) {
        this.fetchHostsData(layouts)
        const {filteredLayouts} = await this.getLayoutsforHost(
          layouts,
          focusedHost
        )
        this.setState({filteredLayouts})
      }

      if (this.props.autoRefresh !== nextProps.autoRefresh) {
        clearInterval(this.intervalID)
        GlobalAutoRefresher.poll(nextProps.autoRefresh)

        if (nextProps.autoRefresh) {
          this.intervalID = window.setInterval(() => {
            this.fetchHostsData(layouts)
          }, nextProps.autoRefresh)
        }
      }
    }
  }

  public componentWillUnmount() {
    setLocalStorage('hostsTableStateProportions', {
      proportions: this.state.proportions,
    })

    clearInterval(this.intervalID)
    this.intervalID = null
    GlobalAutoRefresher.stopPolling()

    this.isComponentMounted = false
  }

  public handleChooseAutoRefresh(option) {
    const {onChooseAutoRefresh} = this.props
    const {milliseconds} = option
    onChooseAutoRefresh(milliseconds)
  }

  private onSetActiveEditorTab(activeEditorTab: string): void {
    this.setState({
      activeEditorTab,
    })
  }

  public render() {
    const {
      autoRefresh,
      onManualRefresh,
      inPresentationMode,
      source,
    } = this.props
    const {selected, isVsphere, activeEditorTab} = this.state

    return (
      <Page className="hosts-list-page">
        <Page.Header inPresentationMode={inPresentationMode}>
          <Page.Header.Left>
            <Page.Title title={this.getTitle} />
          </Page.Header.Left>
          <Page.Header.Center widthPixels={220}>
            <div className="radio-buttons radio-buttons--default radio-buttons--sm radio-buttons--stretch">
              <Radio.Button
                id="hostspage-tab-InventoryTopology"
                titleText="InventoryTopology"
                value="InventoryTopology"
                active={activeEditorTab === 'InventoryTopology'}
                onClick={this.onSetActiveEditorTab}
              >
                Topology
              </Radio.Button>
              <Radio.Button
                id="hostspage-tab-Host"
                titleText="Host"
                value="Host"
                active={activeEditorTab === 'Host'}
                onClick={this.onSetActiveEditorTab}
              >
                Host
              </Radio.Button>
              {isVsphere && (
                <Radio.Button
                  id="hostspage-tab-VMware"
                  titleText="VMware"
                  value="VMware"
                  active={activeEditorTab === 'VMware'}
                  onClick={this.onSetActiveEditorTab}
                >
                  VMware
                </Radio.Button>
              )}
            </div>
          </Page.Header.Center>

          <Page.Header.Right showSourceIndicator={true}>
            {activeEditorTab !== 'InventoryTopology' && <GraphTips />}
            <AutoRefreshDropdown
              selected={autoRefresh}
              onChoose={this.handleChooseAutoRefresh}
              onManualRefresh={onManualRefresh}
            />
            {activeEditorTab !== 'InventoryTopology' && (
              <TimeRangeDropdown
                //@ts-ignore
                onChooseTimeRange={this.handleChooseTimeRange.bind(
                  this.state.selected
                )}
                selected={selected}
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
        <Page.Contents scrollable={true} fullWidth={activeEditorTab !== 'Host'}>
          <>
            {activeEditorTab === 'Host' && (
              <Threesizer
                orientation={HANDLE_HORIZONTAL}
                divisions={this.horizontalDivisions}
                onResize={this.handleResize}
              />
            )}
            {activeEditorTab === 'VMware' && (
              //@ts-ignore
              <VMHostPage
                source={source}
                manualRefresh={this.props.manualRefresh}
                timeRange={this.state.timeRange}
                handleClearTimeout={this.props.handleClearTimeout}
              />
            )}
            {activeEditorTab === 'InventoryTopology' && (
              //@ts-ignore
              <InventoryTopology
                source={source}
                manualRefresh={this.props.manualRefresh}
                autoRefresh={autoRefresh}
              />
            )}
          </>
        </Page.Contents>
      </Page>
    )
  }

  private get getTitle(): string {
    const {activeEditorTab} = this.state

    switch (activeEditorTab) {
      case 'InventoryTopology':
        return 'InventoryTopology'
      default:
        return 'Infrastructure'
    }
  }

  private handleChooseTimeRange = ({lower, upper}) => {
    if (upper) {
      this.setState({timeRange: {lower, upper}, selected: {lower, upper}})
    } else {
      const timeRange = timeRanges.find(range => range.lower === lower)
      this.setState({timeRange, selected: timeRange})
    }
  }

  private handleClickPresentationButton = (): void => {
    this.props.handleClickPresentationButton()
  }

  private get horizontalDivisions() {
    const {proportions} = this.state
    const [topSize, bottomSize] = proportions

    return [
      {
        name: '',
        handleDisplay: 'none',
        headerButtons: [],
        menuOptions: [],
        render: this.renderHostTable,
        headerOrientation: HANDLE_HORIZONTAL,
        size: topSize,
      },
      {
        name: '',
        handlePixels: 8,
        headerButtons: [],
        menuOptions: [],
        render: this.renderGraph,
        headerOrientation: HANDLE_HORIZONTAL,
        size: bottomSize,
      },
    ]
  }

  private handleResize = (proportions: number[]) => {
    this.setState({proportions})
  }

  private renderHostTable = () => {
    const {source} = this.props
    let {
      hostsObject,
      cloudHostsObject,
      hostsPageStatus,
      focusedHost,
    } = this.state

    return (
      <>
        <Dropdown
          items={['Snet', 'AWS', 'GCP', 'Azure']}
          onChoose={this.getHandleOnChooseProvider}
          selected={this.state.selectedProvider}
          className="dropdown-sm"
          disabled={false}
          // onClick={() => {
          //   this.handleFocusedBtnName({selected: this.state.selected})
          // }}
        />
        {this.state.selectedProvider === 'Snet' ? (
          <HostsTable
            source={source}
            hosts={_.values(hostsObject)}
            hostsPageStatus={hostsPageStatus}
            focusedHost={focusedHost}
            onClickTableRow={this.handleClickTableRow}
          />
        ) : null}
        <AWSHostsTable
          source={source}
          cloudHosts={this.filterCloudHosts}
          hostsPageStatus={hostsPageStatus}
          focusedHost={focusedHost}
          onClickTableRow={this.handleClickTableRow}
        />
        {/* {this.state.selectedProvider === 'AWS' ? (
          
        ) : null} */}
      </>
    )
  }

  private get filterCloudHosts() {
    const {cloudHostsObject, selectedProvider} = this.state

    const cloudHosts = _.filter(
      _.values(cloudHostsObject),
      obj => obj.provider === selectedProvider.toLocaleLowerCase()
    )
    console.log('filterCloudHosts: ', cloudHosts)
    return cloudHosts
  }

  private getHandleOnChooseProvider = (selectItem: {text: string}) => {
    this.setState({selectedProvider: selectItem.text})
  }

  private getHandleOnChoose = (selectItem: {text: string}) => {
    this.setState({selectedAgent: selectItem.text})
  }

  private renderGraph = () => {
    const {source} = this.props
    const {filteredLayouts, focusedHost, timeRange} = this.state

    const layoutCells = getCells(filteredLayouts, source)
    const tempVars = generateForHosts(source)

    return (
      <>
        {this.state.selectedProvider === 'AWS' ? (
          <Page.Header>
            <Page.Header.Left>
              <>
                <>Get from: </>
                <Dropdown
                  items={['CloudWatch', '2', '3']}
                  onChoose={this.getHandleOnChoose}
                  selected={this.state.selectedAgent}
                  className="dropdown-sm"
                  disabled={false}
                  // onClick={() => {
                  //   this.handleFocusedBtnName({selected: this.state.selected})
                  // }}
                />
              </>
            </Page.Header.Left>
            <Page.Header.Right></Page.Header.Right>
          </Page.Header>
        ) : null}
        <Page.Contents>
          <HostLayoutRenderer
            source={source}
            sources={[source]}
            isStatusPage={false}
            isStaticPage={true}
            isEditable={false}
            cells={layoutCells}
            templates={tempVars}
            timeRange={timeRange}
            manualRefresh={this.props.manualRefresh}
            host={focusedHost}
            provider={this.state.selectedProvider}
          />
        </Page.Contents>
      </>
    )
  }
  private async getLayoutsforHost(layouts: Layout[], hostID: string) {
    const {host, measurements} = await this.fetchHostsAndMeasurements(
      layouts,
      hostID
    )
    const layoutsWithinHost = layouts.filter(layout => {
      return (
        host.apps &&
        host.apps.includes(layout.app) &&
        measurements.includes(layout.measurement)
      )
    })
    const filteredLayouts = layoutsWithinHost
      .filter(layout => {
        return layout.app === 'system' || layout.app === 'win_system'
      })
      .sort((x, y) => {
        return x.measurement < y.measurement
          ? -1
          : x.measurement > y.measurement
          ? 1
          : 0
      })

    return {filteredLayouts}
  }

  private async fetchHostsData(layouts: Layout[]): Promise<void> {
    const {source, links, notify} = this.props
    const {addons} = links

    const envVars = await getEnv(links.environment)
    const telegrafSystemInterval = getDeep<string>(
      envVars,
      'telegrafSystemInterval',
      ''
    )
    const hostsError = notifyUnableToGetHosts().message
    const tempVars = generateForHosts(source)

    try {
      const hostsObject = await getCpuAndLoadForHosts(
        source.links.proxy,
        source.telegraf,
        telegrafSystemInterval,
        tempVars
      )
      if (!hostsObject) {
        throw new Error(hostsError)
      }
      const newHosts = await getAppsForHosts(
        source.links.proxy,
        hostsObject,
        layouts,
        source.telegraf,
        tempVars
      )

      const isUsingVshpere = Boolean(
        _.find(addons, addon => {
          return addon.name === 'vsphere' && addon.url === 'on'
        }) &&
          _.find(hostsObject, v => {
            return _.includes(v.apps, 'vsphere')
          })
      )

      this.setState({
        isVsphere: isUsingVshpere,
        hostsObject: newHosts,
        hostsPageStatus: RemoteDataState.Done,
      })
    } catch (error) {
      console.error(error)
      notify(notifyUnableToGetHosts())
      this.setState({
        isVsphere: false,
        hostsPageStatus: RemoteDataState.Error,
      })
    }
  }

  private async fetchHostsAndMeasurements(layouts: Layout[], hostID: string) {
    const {source} = this.props

    const fetchMeasurements = getMeasurementsForHost(source, hostID)
    const fetchHosts = getAppsForHost(
      source.links.proxy,
      hostID,
      layouts,
      source.telegraf
    )

    const [host, measurements] = await Promise.all([
      fetchHosts,
      fetchMeasurements,
    ])

    return {host, measurements}
  }

  private getFirstHost = (hostsObject: {[x: string]: Host}): string => {
    const hostsArray = _.values(hostsObject)
    return hostsArray.length > 0 ? hostsArray[0].name : null
  }

  private handleClickTableRow = (hostName: string) => () => {
    const hostsTableState = getLocalStorage('hostsTableState')
    hostsTableState.focusedHost = hostName
    setLocalStorage('hostsTableState', hostsTableState)
    this.setState({focusedHost: hostName})
  }

  private testGetETCD = () => {
    return new Promise((resolve: any) => {
      return resolve([
        {
          provider: 'aws',
          region: 'seoul',
          accesskey: 'accesskey',
          secretkey: 'secretkey',
          data: {},
        },
        {
          provider: 'aws',
          region: 'pusan',
          accesskey: 'accesskey',
          secretkey: 'secretkey',
          data: {},
        },
        {
          provider: 'gcp',
          region: 'seoul',
          accesskey: 'accesskey',
          secretkey: 'secretkey',
          data: {},
        },
        {
          provider: 'gcp',
          region: 'seoul-2',
          accesskey: 'accesskey',
          secretkey: 'secretkey',
          data: {},
        },
        {
          provider: 'azure',
          region: 'tokyo',
          accesskey: 'accesskey',
          secretkey: 'secretkey',
          data: {},
        },
      ])
    })
  }

  private testGetSalt = () => {
    const detailsDummy = yaml.safeLoad(saltDetailsDummy)

    return new Promise((resolve: any) => {
      return resolve(detailsDummy)
    })
  }

  private testCloudHosts = () => {
    this.testGetETCD().then(data => {
      console.log('data: ', data)
      this.testGetSalt().then(saltData => {
        console.log('saltData', saltData)

        let cloudHostsObject = {}
        saltData['local'].reduce((_, current, i) => {
          const instanceName = current.Tags.find(tag => tag.Key === 'Name')
            .Value

          cloudHostsObject[instanceName] = {
            name: instanceName,
            cpu: 0,
            disk: 0,
            load: 0,
            memory: 0,
            deltaUptime: current.LaunchTime.toString(),
            apps: [],
            instanceId: current.InstanceId,
            instanceType: current.InstanceType,
            instanceState: current.State.Name,
            instanceStatusCheck: 'test',
            alarmStatus: 'no alarm',
            provider: data[i].provider,
            region: data[i].region,
          }
          return false
        }, [])
        console.log({cloudHostsObject})
        this.setState({cloudHostsObject})
      })
    })
    // salt
    // cloudsObject
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
})

export default connect(mstp, mdtp)(ManualRefresh<Props>(HostsPage))
