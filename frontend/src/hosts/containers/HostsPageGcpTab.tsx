// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'
import {getDeep} from 'src/utils/wrappers'
import CryptoJS from 'crypto-js'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import Dropdown from 'src/shared/components/Dropdown'
import HostsPageGcpTabTable from 'src/hosts/components/HostsPageGcpTabTable'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import {ManualRefreshProps} from 'src/shared/components/ManualRefresh'
import {Page} from 'src/reusable_ui'
import {ErrorHandling} from 'src/shared/decorators/errors'

// APIs
import {
  getLayouts,
  getCpuAndLoadForInstances,
  getAppsForInstances,
  getAppsForInstance,
  getMeasurementsForInstance,
} from 'src/hosts/apis'

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
import {AddonType} from 'src/shared/constants'
import {agentFilter} from 'src/hosts/constants/topology'

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
import * as QueriesModels from 'src/types/queries'
import * as AppActions from 'src/types/actions/app'
import {
  loadCloudServiceProvidersAsync,
  getGCPInstancesAsync,
} from 'src/hosts/actions'
import {Instance} from '../types'
import {getGCPInstanceTypesAsync} from '../actions/inventoryTopology'

interface Props extends ManualRefreshProps {
  source: Source
  links: Links
  autoRefresh: number
  timeRange: TimeRange
  inPresentationMode: boolean
  onChooseAutoRefresh: (milliseconds: RefreshRate) => void
  handleClearTimeout: (key: string) => void
  notify: NotificationAction
  handleChooseTimeRange: (timeRange: QueriesModels.TimeRange) => void
  handleChooseAutoRefresh: AppActions.SetAutoRefreshActionCreator
  handleClickPresentationButton: AppActions.DelayEnablePresentationModeDispatcher
  handleLoadCspsAsync: () => Promise<any>
  handleGetGCPInstancesAsync: (
    saltMasterUrl: string,
    saltMasterToken: string,
    pCsp: any[]
  ) => Promise<any>
  handleGetGCPInstanceTypesAsync: (
    saltMasterUrl: string,
    saltMasterToken: string,
    pCsp: any,
    pTypes: string[]
  ) => Promise<any>
  handleClickCspTableRow: () => void
  tableTitle: () => JSX.Element
}

interface State {
  focusedInstance: Instance
  namespaceFilterItems: string[]
  agentFilterItems: string[]
  selectedAgent: string
  selectedNamespace: string
  activeCspTab: string
  hostsObject: {[x: string]: Host}
  cspPageStatus: RemoteDataState
  layouts: Layout[]
  filteredLayouts: Layout[]
  proportions: number[]
  cloudHostsObject: CloudHosts
  cloudAccessInfos: any[]
}

@ErrorHandling
export class HostsPageGcpTab extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    manualRefresh: 0,
  }
  public intervalID: number
  private isComponentMounted: boolean = true
  private secretKey = _.find(
    this.props.links.addons,
    addon => addon.name === AddonType.ipmiSecretKey
  )
  private salt = _.find(
    this.props.links.addons,
    addon => addon.name === AddonType.salt
  )

  constructor(props: Props) {
    super(props)

    this.setState = (args, callback) => {
      if (!this.isComponentMounted) return

      PureComponent.prototype.setState.bind(this)(args, callback)
    }

    this.state = {
      focusedInstance: null,
      namespaceFilterItems: [],
      agentFilterItems: [],
      selectedAgent: 'ALL',
      selectedNamespace: 'ALL',
      activeCspTab: 'gcp',
      hostsObject: {},
      cspPageStatus: RemoteDataState.NotStarted,
      layouts: [],
      filteredLayouts: [],
      proportions: [0.43, 0.57],
      cloudAccessInfos: [],
      cloudHostsObject: {},
    }
  }

  public async componentDidMount() {
    const getItem = getLocalStorage('hostsTableStateProportions')
    const {proportions} = getItem || this.state

    const convertProportions = Array.isArray(proportions)
      ? proportions
      : proportions.split(',').map(v => Number(v))

    const {notify, autoRefresh, handleLoadCspsAsync} = this.props

    const layoutResults = await getLayouts()

    const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

    if (!layouts) {
      notify(notifyUnableToGetApps())
      this.setState({
        cspPageStatus: RemoteDataState.Error,
        layouts,
      })
      return
    }

    const getLocalStorageInfrastructure = getLocalStorage('infrastructure')

    const defaultState = {
      focusedHost: '',
      focusedInstance: null,
      selectedAgent: 'ALL',
      selectedNamespace: 'ALL',
      activeCspTab: 'gcp',
    }

    let hostsPage = _.get(
      getLocalStorageInfrastructure,
      'hostsPage',
      defaultState
    )

    const getStoragedInstance = hostsPage.focusedInstance
    if (getStoragedInstance) {
      const dbResp: any[] = await handleLoadCspsAsync()

      if (dbResp.length > 0) {
        _.map(dbResp, csp => {
          const isDeletedNamespace =
            dbResp.length == 1
              ? csp.namespace !== getStoragedInstance.namespace
              : csp.provider === getStoragedInstance.provider &&
                csp.namespace !== getStoragedInstance.namespace
          if (isDeletedNamespace) {
            hostsPage = defaultState
          }
          return
        })
      } else {
        hostsPage = defaultState
      }
    }

    const isEqualFocusedInstance =
      !_.isEmpty(hostsPage.focusedInstance) &&
      hostsPage.focusedInstance.provider === this.state.activeCspTab

    if (!isEqualFocusedInstance) {
      hostsPage = defaultState
    }

    if (autoRefresh) {
      clearInterval(this.intervalID)
      this.intervalID = window.setInterval(
        () => this.fetchCspHostsData(layouts),
        autoRefresh
      )
    }

    GlobalAutoRefresher.poll(autoRefresh)

    const getFocusedInstance = hostsPage.focusedInstance
    if (getFocusedInstance) {
      this.setState({
        focusedInstance: getFocusedInstance,
      })
    }

    await this.fetchCspHostsData(layouts)
    const {filteredLayouts} = await this.getLayoutsforInstance(
      layouts,
      this.state.focusedInstance
    )

    this.setState(state => {
      return {
        ...state,
        layouts,
        proportions: convertProportions,
        selectedNamespace: _.isEmpty(hostsPage['selectedNamespace'])
          ? 'ALL'
          : hostsPage['selectedNamespace'],
        selectedAgent: _.isEmpty(hostsPage['selectedAgent'])
          ? 'ALL'
          : hostsPage['selectedAgent'],
        filteredLayouts,
      }
    })
  }

  public async componentDidUpdate(prevProps: Props, prevState: State) {
    const {autoRefresh} = this.props
    const {
      layouts,
      focusedInstance,
      selectedAgent,
      selectedNamespace,
    } = this.state

    if (layouts) {
      if (prevState.focusedInstance !== focusedInstance) {
        const {filteredLayouts} = await this.getLayoutsforInstance(
          layouts,
          focusedInstance
        )
        this.setState({filteredLayouts})
      }
      if (
        focusedInstance &&
        (prevState.selectedAgent !== selectedAgent ||
          prevState.selectedNamespace !== selectedNamespace)
      ) {
        const {filteredLayouts} = await this.getLayoutsforInstance(
          layouts,
          focusedInstance
        )

        this.setState({filteredLayouts})
      }

      if (prevProps.autoRefresh !== autoRefresh) {
        GlobalAutoRefresher.poll(autoRefresh)
      }
    }
  }

  public async UNSAFE_componentWillReceiveProps(nextProps: Props) {
    const {layouts, focusedInstance} = this.state

    if (layouts) {
      if (this.props.manualRefresh !== nextProps.manualRefresh) {
        this.fetchCspHostsData(layouts)
        const {filteredLayouts} = await this.getLayoutsforInstance(
          layouts,
          focusedInstance
        )
        this.setState({filteredLayouts})
      }

      if (this.props.autoRefresh !== nextProps.autoRefresh) {
        clearInterval(this.intervalID)
        GlobalAutoRefresher.poll(nextProps.autoRefresh)

        if (nextProps.autoRefresh) {
          this.intervalID = window.setInterval(() => {
            this.fetchCspHostsData(layouts)
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

    const {
      selectedAgent,
      selectedNamespace,
      activeCspTab,
      focusedInstance,
    } = this.state

    const getHostsPage = {
      hostsPage: {
        selectedAgent: selectedAgent,
        selectedNamespace: selectedNamespace,
        activeCspTab: activeCspTab,
        focusedInstance: focusedInstance,
      },
    }
    setLocalStorage('infrastructure', getHostsPage)

    this.isComponentMounted = false
  }

  public render() {
    return (
      <Threesizer
        orientation={HANDLE_HORIZONTAL}
        divisions={this.horizontalDivisions}
        onResize={this.handleResize}
      />
    )
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
    return <>{this.renderCspHostsTable}</>
  }

  private get renderCspHostsTable() {
    const {source} = this.props
    const {
      cspPageStatus,
      cloudHostsObject,
      focusedInstance,
      selectedNamespace,
      namespaceFilterItems,
    } = this.state

    let cloudHosts = []
    if (focusedInstance) {
      _.reduce(
        _.values(cloudHostsObject),
        (__before, cCurrent) => {
          if (cCurrent.instanceId) {
            cloudHosts.push(cCurrent)
          }
          return false
        },
        {}
      )
    }

    return (
      <>
        <HostsPageGcpTabTable
          source={source}
          cloudHosts={cloudHosts}
          namespaceFilterItems={namespaceFilterItems}
          cspPageStatus={cspPageStatus}
          getHandleOnChoose={this.getHandleOnChooseNamespace}
          selectedNamespace={selectedNamespace}
          focusedInstance={focusedInstance}
          onClickTableRow={this.handleClickCspTableRow}
          tableTitle={this.props.tableTitle}
        />
      </>
    )
  }

  private getFirstCloudHost = (cloudHostsObject: CloudHosts): Instance => {
    let firstHost: Instance = {
      provider: null,
      namespace: null,
      instanceid: null,
      instancename: null,
    }

    const {focusedInstance} = this.state

    let firstInstance = focusedInstance
    try {
      if (!_.isEmpty(cloudHostsObject)) {
        const instancename = _.keys(cloudHostsObject)[0]
        const {
          instanceId,
          csp: {provider, namespace},
        } = cloudHostsObject[instancename]
        firstHost = {
          ...firstHost,
          provider: provider,
          instanceid: instanceId,
          namespace: namespace,
          instancename: instancename,
        }

        firstInstance = firstHost
        return firstInstance
      }
    } finally {
      return firstInstance
    }
  }

  private onSetFocusedInstance = (focusedInstance: Instance): void => {
    this.setState({
      focusedInstance: focusedInstance,
    })
  }

  private getHandleOnChoose = (selectItem: {text: string}) => {
    this.setState({selectedAgent: selectItem.text})
  }
  private getHandleOnChooseNamespace = (selectItem: {text: string}) => {
    this.setState({selectedNamespace: selectItem.text})
  }

  private renderGraph = () => {
    const {source, manualRefresh, timeRange} = this.props
    const {
      filteredLayouts,
      agentFilterItems,
      selectedAgent,
      focusedInstance,
    } = this.state
    const layoutCells = getCells(filteredLayouts, source)
    const tempVars = generateForHosts(source)

    const cspGraphComponent = (): JSX.Element => {
      return (
        <>
          <Page.Header>
            <Page.Header.Left>
              <></>
            </Page.Header.Left>
            <Page.Header.Right>
              <>
                <span>
                  Get from <span style={{margin: '0 3px'}}>:</span>
                </span>
                <Dropdown
                  items={agentFilterItems}
                  onChoose={this.getHandleOnChoose}
                  selected={selectedAgent}
                  className="dropdown-sm"
                  disabled={false}
                />
              </>
            </Page.Header.Right>
          </Page.Header>
          <Page.Contents>
            <LayoutRenderer
              source={source}
              sources={[source]}
              isStatusPage={false}
              isStaticPage={true}
              isEditable={false}
              cells={layoutCells}
              templates={tempVars}
              timeRange={timeRange}
              manualRefresh={manualRefresh}
              host={''}
              instance={focusedInstance}
            />
          </Page.Contents>
        </>
      )
    }

    return cspGraphComponent()
  }

  private async getLayoutsforInstance(layouts: Layout[], pInstance: Instance) {
    const {instance, measurements} = await this.fetchInstancesAndMeasurements(
      layouts,
      pInstance
    )
    const layoutsWithinInstance = layouts.filter(layout => {
      return (
        instance.apps &&
        instance.apps.includes(layout.app) &&
        measurements.includes(layout.measurement)
      )
    })
    const filteredLayouts = layoutsWithinInstance
      .filter(layout => {
        return (
          layout.app === 'system' ||
          layout.app === 'win_system' ||
          layout.app === 'cloudwatch' ||
          layout.app === 'stackdriver_compute'
        )
      })
      .sort((x, y) => {
        return x.measurement < y.measurement
          ? -1
          : x.measurement > y.measurement
          ? 1
          : 0
      })
    return {instance, filteredLayouts}
  }

  private async fetchInstancesAndMeasurements(
    layouts: Layout[],
    pInstance: Instance
  ) {
    const {source} = this.props
    const {selectedAgent} = this.state

    const tempVars = generateForHosts(source)

    const fetchMeasurements = getMeasurementsForInstance(
      source,
      pInstance,
      selectedAgent
    )
    const fetchInstances = getAppsForInstance(
      source.links.proxy,
      pInstance,
      layouts,
      source.telegraf,
      tempVars,
      selectedAgent
    )

    const [instance, measurements] = await Promise.all([
      fetchInstances,
      fetchMeasurements,
    ])

    return {instance, measurements}
  }

  private fetchCspHostsData = async (
    layouts: Layout[]
  ): Promise<CloudHosts> => {
    const {
      handleLoadCspsAsync,
      source,
      handleGetGCPInstancesAsync,
      notify,
    } = this.props
    const {focusedInstance, activeCspTab} = this.state
    const dbResp: any[] = await handleLoadCspsAsync()
    const agentFilterItems = agentFilter[activeCspTab]
    let newDbResp: any[] = _.filter(
      _.map(dbResp, resp => {
        const {secretkey} = resp
        const decryptedBytes = CryptoJS.AES.decrypt(
          secretkey,
          this.secretKey.url
        )
        const originalSecretkey = decryptedBytes.toString(CryptoJS.enc.Utf8)

        resp = {
          ...resp,
          secretkey: originalSecretkey,
        }

        return resp
      }),
      filterData => {
        if (filterData.provider === activeCspTab) return filterData
      }
    )

    if (_.isEmpty(newDbResp)) {
      this.setState({
        cloudAccessInfos: [],
        cloudHostsObject: {},
        filteredLayouts: [],
        cspPageStatus: RemoteDataState.Done,
      })
      return
    }

    const namespaceFilterItems = _.map(newDbResp, resp => {
      if (resp.provider == activeCspTab) {
        return resp.namespace
      }
    })

    let getSaltCSPs = await handleGetGCPInstancesAsync(
      this.salt.url,
      this.salt.token,
      newDbResp
    )

    let newCSPs = []

    getSaltCSPs = _.map(getSaltCSPs.return, getSaltCSP => _.values(getSaltCSP))

    _.forEach(newDbResp, (accessCsp, index) => {
      const {id, organization, namespace} = accessCsp
      const provider = activeCspTab
      let csp = []

      if (_.isEmpty(getSaltCSPs[index])) {
        return
      }

      if (
        Object.keys(getSaltCSPs[index]).includes('error') ||
        typeof getSaltCSPs[index] === 'string'
      )
        return

      let cspNaemspace = []
      _.forEach(getSaltCSPs[index], cspHost => {
        if (!cspHost) return
        const host = {
          ...cspHost,
          Csp: {id, organization, provider, namespace},
        }
        cspNaemspace.push(host)
      })

      csp.push(cspNaemspace)

      newCSPs.push(csp)
    })

    if (_.isEmpty(newCSPs)) {
      this.setState({
        cloudAccessInfos: [],
        cloudHostsObject: {},
        cspPageStatus: RemoteDataState.Done,
      })
      return
    }

    const hostsError = notifyUnableToGetHosts().message
    const tempVars = generateForHosts(source)
    try {
      const instancesObject = await getCpuAndLoadForInstances(
        source.links.proxy,
        source.telegraf,
        tempVars,
        activeCspTab,
        newCSPs
      )

      if (!instancesObject) {
        throw new Error(hostsError)
      }

      const newCloudHostsObject: CloudHosts = await getAppsForInstances(
        source.links.proxy,
        instancesObject,
        layouts,
        source.telegraf,
        tempVars,
        activeCspTab
      )

      if (_.isEmpty(focusedInstance)) {
        this.setState({
          focusedInstance: this.getFirstCloudHost(newCloudHostsObject),
          cloudAccessInfos: dbResp,
          cloudHostsObject: newCloudHostsObject,
          cspPageStatus: RemoteDataState.Done,
          namespaceFilterItems: namespaceFilterItems,
          agentFilterItems: agentFilterItems,
        })
      } else {
        this.setState({
          cloudAccessInfos: dbResp,
          cloudHostsObject: newCloudHostsObject,
          cspPageStatus: RemoteDataState.Done,
          namespaceFilterItems: namespaceFilterItems,
          agentFilterItems: agentFilterItems,
        })
      }
      return newCloudHostsObject
    } catch (error) {
      console.error(error)
      notify(notifyUnableToGetHosts())
      this.setState({
        cspPageStatus: RemoteDataState.Error,
      })
    }
  }

  private handleClickCspTableRow = (instance: Instance) => () => {
    this.onSetFocusedInstance(instance)
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
  handleGetGCPInstancesAsync: bindActionCreators(
    getGCPInstancesAsync,
    dispatch
  ),

  handleGetGCPInstanceTypesAsync: bindActionCreators(
    getGCPInstanceTypesAsync,
    dispatch
  ),
})

export default connect(mstp, mdtp, null)(HostsPageGcpTab)
