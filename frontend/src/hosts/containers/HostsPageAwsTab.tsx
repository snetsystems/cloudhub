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
import HostsPageAwsHostsTable from 'src/hosts/components/HostsPageAwsTabTable'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import {ManualRefreshProps} from 'src/shared/components/ManualRefresh'
import {Page} from 'src/reusable_ui'
import {ErrorHandling} from 'src/shared/decorators/errors'
import InstanceTypeModal from 'src/hosts/components/InstanceTypeModal'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import TopologyDetails from 'src/hosts/components/TopologyDetails'

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
import {notIncludeAppsAWS} from 'src/hosts/constants/apps'

//const
import {HANDLE_HORIZONTAL} from 'src/shared/constants'

// Types
import {
  Source,
  Links,
  NotificationAction,
  RemoteDataState,
  Layout,
  TimeRange,
  RefreshRate,
  CloudHosts,
} from 'src/types'
import * as QueriesModels from 'src/types/queries'
import * as AppActions from 'src/types/actions/app'
import {
  loadCloudServiceProvidersAsync,
  getAWSInstancesAsync,
  getAWSInstanceTypesAsync,
} from 'src/hosts/actions'
import {Instance} from 'src/hosts/types/index'

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
  handleGetAWSInstancesAsync: (
    saltMasterUrl: string,
    saltMasterToken: string,
    pCsp: any[]
  ) => Promise<any>
  handleGetAWSInstanceTypesAsync: (
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
  layouts: Layout[]
  filteredLayouts: Layout[]
  proportions: number[]
  cloudAccessInfos: any[]
  cloudHostsObject: CloudHosts
  isInstanceTypeModalVisible: boolean
  awsInstanceTypes: Promise<any>
  instanceTypeLoading: RemoteDataState
  cspPageStatus: RemoteDataState
}

@ErrorHandling
export class HostsPageAwsTab extends PureComponent<Props, State> {
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
      activeCspTab: 'aws',
      layouts: [],
      filteredLayouts: [],
      proportions: [0.43, 0.57],
      cloudAccessInfos: [],
      cloudHostsObject: {},
      isInstanceTypeModalVisible: false,
      awsInstanceTypes: null,
      instanceTypeLoading: RemoteDataState.NotStarted,
      cspPageStatus: RemoteDataState.NotStarted,
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
      activeCspTab: 'aws',
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

    let focusedLayout = []
    if (this.state.focusedInstance) {
      const {filteredLayouts} = await this.getLayoutsforInstance(
        layouts,
        this.state.focusedInstance
      )
      focusedLayout = filteredLayouts
    }

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
        filteredLayouts: focusedLayout,
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

    if (layouts.length && prevState.focusedInstance) {
      if (prevState.focusedInstance !== focusedInstance) {
        const {filteredLayouts} = await this.getLayoutsforInstance(
          layouts,
          focusedInstance
        )
        this.setState({filteredLayouts})
      }

      if (
        prevState.selectedAgent !== selectedAgent ||
        prevState.selectedNamespace !== selectedNamespace
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
      isInstanceTypeModalVisible,
      instanceTypeLoading,
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
        <InstanceTypeModal
          visible={isInstanceTypeModalVisible}
          status={instanceTypeLoading}
          message={this.renderInstanceTypeModal}
          onCancel={() => {
            this.setState({
              isInstanceTypeModalVisible: false,
            })
          }}
        />

        <HostsPageAwsHostsTable
          source={source}
          cloudHosts={cloudHosts}
          namespaceFilterItems={namespaceFilterItems}
          cspPageStatus={cspPageStatus}
          getHandleOnChoose={this.getHandleOnChooseNamespace}
          selectedNamespace={selectedNamespace}
          focusedInstance={focusedInstance}
          onClickTableRow={this.handleClickCspTableRow}
          tableTitle={this.props.tableTitle}
          handleInstanceTypeModal={this.handleInstanceTypeModal}
        />
      </>
    )
  }

  private get renderInstanceTypeModal() {
    return (
      <FancyScrollbar style={{height: '450px'}} autoHide={false}>
        <TopologyDetails selectInstanceData={this.getInstanceType()} />
      </FancyScrollbar>
    )
  }

  private getAWSInstanceTypes = async (accessInfo: any, types: string[]) => {
    try {
      const awsInstanceTypes = await this.props.handleGetAWSInstanceTypesAsync(
        this.salt.url,
        this.salt.token,
        accessInfo,
        types
      )

      this.setState({awsInstanceTypes})
    } catch (error) {
      this.setState({awsInstanceTypes: null})
    } finally {
      this.setState({instanceTypeLoading: RemoteDataState.Done})
    }
  }

  private handleInstanceTypeModal = async (
    provider: string,
    namespace: string,
    type: string
  ) => {
    let accessInfo = _.find(this.state.cloudAccessInfos, cloudAccessInfo => {
      return (
        cloudAccessInfo.provider === provider &&
        cloudAccessInfo.namespace === namespace
      )
    })
    const {secretkey} = accessInfo
    const decryptedBytes = CryptoJS.AES.decrypt(secretkey, this.secretKey.url)
    const originalSecretkey = decryptedBytes.toString(CryptoJS.enc.Utf8)

    accessInfo = {
      ...accessInfo,
      secretkey: originalSecretkey,
    }

    this.setState({
      instanceTypeLoading: RemoteDataState.Loading,
      isInstanceTypeModalVisible: true,
    })

    await this.getAWSInstanceTypes(accessInfo, [type])
  }

  private getInstanceType = () => {
    const {awsInstanceTypes} = this.state

    try {
      if (_.isNull(awsInstanceTypes)) return
      let instanceTypes = {}

      const getAWSInstanceTypes = _.values(
        _.values(_.values(awsInstanceTypes)[0])[0]
      )

      _.reduce(
        getAWSInstanceTypes,
        (_before, current) => {
          if (_.isNull(current)) return false

          const [family, size] = current.InstanceType.split('.')
          const ValidThreadsPerCore = _.get(
            current.VCpuInfo,
            'ValidThreadsPerCore',
            '-'
          )

          let instanceType = {
            Details: {
              Instance_type: current.InstanceType,
              Instance_family: family,
              Instance_size: size,
              Hypervisor: current.Hypervisor,
              Auto_Recovery_support: current.AutoRecoverySupported.toString(),
              Supported_root_device_types: current.SupportedRootDeviceTypes,
              Dedicated_Host_support: current.DedicatedHostsSupported.toString(),
              'On-Demand_Hibernation_support': current.HibernationSupported.toString(),
              Burstable_Performance_support: current.BurstablePerformanceSupported.toString(),
            },
            Compute: {
              'Free-Tier_eligible': current.FreeTierEligible.toString(),
              Bare_metal: current.BareMetal.toString(),
              vCPUs: current.VCpuInfo.DefaultVCpus,
              Architecture: current.ProcessorInfo.SupportedArchitectures,
              Cores: current.VCpuInfo.DefaultCores,
              Valid_cores: current.VCpuInfo.ValidCores,
              Threads_per_core: current.VCpuInfo.DefaultThreadsPerCore,
              Valid_threads_per_core: _.isArray(ValidThreadsPerCore)
                ? ValidThreadsPerCore.join(',')
                : ValidThreadsPerCore,
              'Sustained_clock_speed_(GHz)':
                current.ProcessorInfo.SustainedClockSpeedInGhz,
              'Memory_(GiB)': current.MemoryInfo.SizeInMiB / 1024,
              Current_generation: current.CurrentGeneration.toString(),
            },
            Networking: {
              EBS_optimization_support: current.EbsInfo.EbsOptimizedSupport,
              Network_performance: current.NetworkInfo.NetworkPerformance,
              ENA_support: current.NetworkInfo.EnaSupport,
              Maximum_number_of_network_interfaces:
                current.NetworkInfo.MaximumNetworkInterfaces,
              IPv4_addresses_per_interface:
                current.NetworkInfo.Ipv4AddressesPerInterface,
              IPv6_addresses_per_interface:
                current.NetworkInfo.Ipv6AddressesPerInterface,
              IPv6_support: current.NetworkInfo.Ipv6Supported.toString(),
              Supported_placement_group_strategies: current.PlacementGroupInfo.SupportedStrategies.join(
                ', '
              ),
            },
          }

          if (current.InstanceStorageSupported) {
            const storage = {
              Storage: {
                'Storage_(GB)': current.InstanceStorageInfo.Disks.TotalSizeInGB,
                Local_instance_storage: '-',
                Storage_type: current.InstanceStorageInfo.Disks.Type,
                Storage_disk_count: current.InstanceStorageInfo.Disks.Count,
                EBS_encryption_support: current.EbsInfo.EncryptionSupport,
              },
            }

            instanceType = {
              ...instanceType,
              ...storage,
            }
          }

          if (current.hasOwnProperty('GpuInfo')) {
            const {GpuInfo} = current
            const accelators = {
              Accelerators: {
                GPUs: GpuInfo.Gpus.Count,
                'GPU_memory_(GiB)': GpuInfo.Gpus.MemoryInfo.SizeInMiB,
                GPU_manufacturer: GpuInfo.Gpus.Manufacturer,
                GPU_name: GpuInfo.Gpus.Name,
              },
            }

            instanceType = {
              ...instanceType,
              ...accelators,
            }
          }

          instanceTypes = {
            ...instanceType,
          }

          return false
        },
        {}
      )

      return instanceTypes
    } catch (error) {
      console.error('error instanceTypes: ', error)
      return {}
    }
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
          layout.app === 'cloudwatch'
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
    const filterLayouts = _.filter(
      layouts,
      m => !_.includes(notIncludeAppsAWS, m.app)
    )
    const fetchInstances = getAppsForInstance(
      source.links.proxy,
      pInstance,
      filterLayouts,
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
      handleGetAWSInstancesAsync,
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

    let getSaltCSPs = await handleGetAWSInstancesAsync(
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

      const filterLayouts = _.filter(
        layouts,
        m => !_.includes(notIncludeAppsAWS, m.app)
      )
      const newCloudHostsObject: CloudHosts = await getAppsForInstances(
        source.links.proxy,
        instancesObject,
        filterLayouts,
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
  handleGetAWSInstancesAsync: bindActionCreators(
    getAWSInstancesAsync,
    dispatch
  ),
  handleGetAWSInstanceTypesAsync: bindActionCreators(
    getAWSInstanceTypesAsync,
    dispatch
  ),
})

export default connect(mstp, mdtp, null)(HostsPageAwsTab)
