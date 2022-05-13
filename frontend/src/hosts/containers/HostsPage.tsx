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
import HostsTable from 'src/hosts/components/HostsTable'
import CspHostsTable from 'src/hosts/components/CspHostsTable'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import {ManualRefreshProps} from 'src/shared/components/ManualRefresh'
import {ButtonShape, Page, Radio} from 'src/reusable_ui'
import {ErrorHandling} from 'src/shared/decorators/errors'

// APIs
import {
  getCpuAndLoadForHosts,
  getLayouts,
  getAppsForHosts,
  getAppsForHost,
  getMeasurementsForHost,
  getCpuAndLoadForInstances,
  getAppsForInstances,
  getAppsForInstance,
  getMeasurementsForInstance,
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
  getAWSInstancesAsync,
  getGCPInstancesAsync,
  getAWSInstanceTypesAsync,
} from 'src/hosts/actions'
import InstanceTypeModal from '../components/InstanceTypeModal'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import TopologyDetails from '../components/TopologyDetails'
import {getGCPInstanceTypesAsync} from '../actions/inventoryTopology'
import {CloudServiceProvider} from '../types/cloud'

interface Instance {
  provider: CloudServiceProvider
  namespace: string
  instanceid: string
  instancename: string
}
interface Props extends ManualRefreshProps {
  source: Source
  links: Links
  autoRefresh: number
  onChooseAutoRefresh: (milliseconds: RefreshRate) => void
  handleClearTimeout: (key: string) => void
  notify: NotificationAction
  handleChooseTimeRange: (timeRange: QueriesModels.TimeRange) => void
  handleChooseAutoRefresh: AppActions.SetAutoRefreshActionCreator
  handleClickPresentationButton: AppActions.DelayEnablePresentationModeDispatcher
  inPresentationMode: boolean
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
  timeRange: TimeRange
}

interface State {
  hostsObject: {[x: string]: Host}
  hostsPageStatus: RemoteDataState
  cspPageStatus: RemoteDataState
  layouts: Layout[]
  filteredLayouts: Layout[]
  focusedHost: string
  focusedInstance: Instance
  proportions: number[]
  namespaceFilterItems: string[]
  agentFilterItems: string[]
  selectedAgent: string
  selectedNamespace: string
  activeCspTab: string
  itemCSPs: string[]
  cloudHostsObject: CloudHosts
  cloudAccessInfos: any[]
  isInstanceTypeModalVisible: boolean
  awsInstanceTypes: Promise<any>
  gcpInstanceTypes: Promise<any>
  instanceTypeLoading: RemoteDataState
}

@ErrorHandling
export class HostsPage extends PureComponent<Props, State> {
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

  private isUsingAWS =
    _.get(
      _.find(this.props.links.addons, addon => addon.name === AddonType.aws),
      'url',
      'off'
    ) === 'on'

  private isUsingGCP =
    _.get(
      _.find(this.props.links.addons, addon => addon.name === AddonType.gcp),
      'url',
      'off'
    ) === 'on'

  constructor(props: Props) {
    super(props)

    this.setState = (args, callback) => {
      if (!this.isComponentMounted) return

      PureComponent.prototype.setState.bind(this)(args, callback)
    }

    const itemCSPs = ['Host']

    if (this.isUsingAWS) {
      itemCSPs.push('aws')
    }

    if (this.isUsingGCP) {
      itemCSPs.push('gcp')
    }

    this.state = {
      focusedHost: '',
      focusedInstance: null,
      namespaceFilterItems: [],
      agentFilterItems: [],
      selectedAgent: 'ALL',
      selectedNamespace: 'ALL',
      activeCspTab: 'Host',
      hostsObject: {},
      hostsPageStatus: RemoteDataState.NotStarted,
      cspPageStatus: RemoteDataState.NotStarted,
      layouts: [],
      filteredLayouts: [],
      proportions: [0.43, 0.57],
      itemCSPs,
      cloudAccessInfos: [],
      cloudHostsObject: {},
      isInstanceTypeModalVisible: false,
      awsInstanceTypes: null,
      gcpInstanceTypes: null,
      instanceTypeLoading: RemoteDataState.NotStarted,
    }

    this.onSetActiveCspTab = this.onSetActiveCspTab.bind(this)
  }

  public async componentDidMount() {
    const getItem = getLocalStorage('hostsTableStateProportions')
    const {proportions} = getItem || this.state

    const convertProportions = Array.isArray(proportions)
      ? proportions
      : proportions.split(',').map(v => Number(v))

    const {notify, autoRefresh, handleLoadCspsAsync} = this.props

    this.setState({
      hostsPageStatus: RemoteDataState.Loading,
      cspPageStatus: RemoteDataState.Loading,
    })

    const layoutResults = await getLayouts()

    const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

    if (!layouts) {
      notify(notifyUnableToGetApps())
      this.setState({
        hostsPageStatus: RemoteDataState.Error,
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
      activeCspTab: 'Host',
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
            hostsPage = {
              ...defaultState,
              activeCspTab: hostsPage['activeCspTab'],
            }
          }

          return
        })
      } else {
        setLocalStorage(
          'infrastructure',
          (hostsPage = {
            ...defaultState,
            activeCspTab: hostsPage['activeCspTab'],
          })
        )
      }
    }
    const getFocusedInstance = hostsPage.focusedInstance

    const initActivateTab =
      !this.isUsingAWS && !this.isUsingGCP
        ? 'Host'
        : _.isEmpty(hostsPage['activeCspTab'])
        ? 'Host'
        : hostsPage['activeCspTab']

    this.setState({
      activeCspTab: initActivateTab,
    })

    const hostID = hostsPage.focusedHost

    const activeTab =
      !this.isUsingAWS && !this.isUsingGCP
        ? 'Host'
        : _.isEmpty(hostsPage['activeCspTab'])
        ? 'Host'
        : hostsPage['activeCspTab']

    if (hostID === '' && activeTab === 'Host') {
      this.fetchHostsData(layouts)
      if (activeTab === 'Host') {
        const {filteredLayouts} = await this.getLayoutsforHost(
          layouts,
          activeTab
        )
        this.setState({filteredLayouts})
      }
    }

    if (activeTab !== 'Host' && !getFocusedInstance) {
      this.fetchCspHostsData(layouts)
    }
    if (autoRefresh && activeTab === 'Host') {
      clearInterval(this.intervalID)
      this.intervalID = window.setInterval(
        () => this.fetchHostsData(layouts),
        autoRefresh
      )
    } else if (autoRefresh && (activeTab === 'aws' || activeTab === 'gcp')) {
      clearInterval(this.intervalID)
      this.intervalID = window.setInterval(
        () => this.fetchCspHostsData(layouts),
        autoRefresh
      )
    } else if (autoRefresh && activeTab === 'gcp') {
      clearInterval(this.intervalID)
      this.intervalID = window.setInterval(
        () => this.fetchCspHostsData(layouts),
        autoRefresh
      )
    }

    GlobalAutoRefresher.poll(autoRefresh)
    if (!this.isUsingAWS && !this.isUsingGCP) {
      this.setState({
        layouts,
        proportions: convertProportions,
        selectedAgent: 'ALL',
        focusedHost: hostID,
      })
    } else {
      if (initActivateTab === 'Host') {
        this.setState({
          layouts,
          proportions: convertProportions,
          focusedHost: hostID,
        })
      } else {
        this.setState({
          layouts,
          proportions: convertProportions,
          focusedInstance: getFocusedInstance,
          selectedNamespace: _.isEmpty(hostsPage['selectedNamespace'])
            ? 'ALL'
            : hostsPage['selectedNamespace'],
          selectedAgent: _.isEmpty(hostsPage['selectedAgent'])
            ? 'ALL'
            : hostsPage['selectedAgent'],
        })
      }
    }
  }

  public async componentDidUpdate(prevProps: Props, prevState: State) {
    const {autoRefresh} = this.props
    const {
      layouts,
      focusedHost,
      focusedInstance,
      selectedAgent,
      selectedNamespace,
      activeCspTab,
    } = this.state

    if (layouts.length > 0) {
      if (
        activeCspTab === 'Host' &&
        (prevState.focusedHost !== focusedHost ||
          prevState.activeCspTab !== activeCspTab)
      ) {
        this.fetchHostsData(layouts)
        if (activeCspTab === 'Host') {
          if (focusedHost !== '') {
            const {filteredLayouts} = await this.getLayoutsforHost(
              layouts,
              focusedHost
            )
            this.setState({filteredLayouts})
          }
          this.setInfrastructureLocalStorage()
        }
      } else {
        if (
          prevState.activeCspTab !== activeCspTab ||
          prevState.focusedInstance !== focusedInstance
        ) {
          this.fetchCspHostsData(layouts)
          if (focusedInstance) {
            const {filteredLayouts} = await this.getLayoutsforInstance(
              layouts,
              focusedInstance
            )
            this.setState({filteredLayouts})
          }
          this.setInfrastructureLocalStorage()
        }
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
        this.setInfrastructureLocalStorage()
      }

      if (autoRefresh && prevState.activeCspTab !== activeCspTab) {
        clearInterval(this.intervalID)

        if (activeCspTab === 'Host') {
          this.intervalID = window.setInterval(() => {
            this.fetchHostsData(layouts)
          }, autoRefresh)
        }

        if (activeCspTab === 'aws' || activeCspTab === 'gcp') {
          this.intervalID = window.setInterval(() => {
            this.fetchCspHostsData(layouts)
          }, autoRefresh)
        }
        this.setInfrastructureLocalStorage()
      }

      if (prevProps.autoRefresh !== autoRefresh) {
        GlobalAutoRefresher.poll(autoRefresh)
        this.setInfrastructureLocalStorage()
      }
    }
  }

  public async UNSAFE_componentWillReceiveProps(nextProps: Props) {
    const {layouts, focusedHost, focusedInstance, activeCspTab} = this.state

    if (layouts) {
      if (this.props.manualRefresh !== nextProps.manualRefresh) {
        if (activeCspTab === 'Host') {
          this.fetchHostsData(layouts)
          const {filteredLayouts} = await this.getLayoutsforHost(
            layouts,
            focusedHost
          )
          this.setState({filteredLayouts})
        }

        if (activeCspTab === 'aws' || activeCspTab === 'gcp') {
          this.fetchCspHostsData(layouts)
          const {filteredLayouts} = await this.getLayoutsforInstance(
            layouts,
            focusedInstance
          )

          this.setState({filteredLayouts})
        }
      }

      if (this.props.autoRefresh !== nextProps.autoRefresh) {
        clearInterval(this.intervalID)
        GlobalAutoRefresher.poll(nextProps.autoRefresh)

        if (nextProps.autoRefresh) {
          if (activeCspTab === 'Host') {
            this.intervalID = window.setInterval(() => {
              this.fetchHostsData(layouts)
            }, nextProps.autoRefresh)
          }

          if (activeCspTab === 'aws' || activeCspTab === 'gcp') {
            this.intervalID = window.setInterval(() => {
              this.fetchCspHostsData(layouts)
            }, nextProps.autoRefresh)
          }
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

    this.setInfrastructureLocalStorage()

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
    const {source} = this.props
    const {hostsObject, hostsPageStatus, focusedHost, activeCspTab} = this.state

    return (
      <>
        {activeCspTab === 'Host' ? (
          <HostsTable
            source={source}
            hosts={_.values(hostsObject)}
            hostsPageStatus={hostsPageStatus}
            focusedHost={focusedHost}
            onClickTableRow={this.handleClickTableRow}
            tableTitle={this.tableTitle}
          />
        ) : (
          this.renderCspHostsTable
        )}
      </>
    )
  }

  private get renderCspHostsTable() {
    const {source} = this.props
    const {
      cloudHostsObject,
      activeCspTab,
      cspPageStatus,
      isInstanceTypeModalVisible,
      instanceTypeLoading,
      focusedInstance,
      selectedNamespace,
      namespaceFilterItems,
    } = this.state
    const cloudHostObject = cloudHostsObject
    let cloudHosts = []

    _.reduce(
      _.values(cloudHostObject),
      (__before, cCurrent) => {
        if (cCurrent.instanceId) {
          cloudHosts.push(cCurrent)
        }
        return false
      },
      {}
    )
    return (
      <>
        {activeCspTab === 'aws' && (
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
        )}
        <CspHostsTable
          source={source}
          cloudHosts={cloudHosts}
          namespaceFilterItems={namespaceFilterItems}
          cspPageStatus={cspPageStatus}
          getHandleOnChoose={this.getHandleOnChooseNamespace}
          selectedNamespace={selectedNamespace}
          focusedInstance={focusedInstance}
          onClickTableRow={this.handleClickCspTableRow}
          tableTitle={this.tableTitle}
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

  private tableTitle = (): JSX.Element => {
    const {activeCspTab, itemCSPs} = this.state

    return itemCSPs.length > 1 ? (
      <Radio shape={ButtonShape.Default}>
        {_.map(itemCSPs, csp => {
          return (
            <Radio.Button
              key={csp}
              id="addon-tab-data"
              titleText={csp}
              value={csp}
              active={activeCspTab === csp}
              onClick={this.onSetActiveCspTab}
            >
              {csp.toUpperCase()}
            </Radio.Button>
          )
        })}
      </Radio>
    ) : (
      <div
        className={`radio-buttons radio-buttons--default radio-buttons--sm radio-buttons--stretch`}
      >
        <button type="button" className={'radio-button active'}>
          Private
        </button>
      </div>
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
      cspPageStatus: RemoteDataState.Loading,
      focusedInstance: focusedInstance,
    })
  }

  private onSetActiveCspTab(activeCspTab: string): void {
    if (activeCspTab !== 'Host') {
      this.setState({
        focusedInstance: null,
        selectedNamespace: 'ALL',
        selectedAgent: 'ALL',
        activeCspTab,
        cspPageStatus: RemoteDataState.Loading,
        filteredLayouts: [],
      })
    } else {
      this.setState({
        activeCspTab,
        hostsPageStatus: RemoteDataState.Loading,
      })
    }
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
      focusedHost,
      focusedInstance,
      activeCspTab,
      selectedAgent,
      agentFilterItems,
    } = this.state
    const layoutCells = getCells(filteredLayouts, source)
    const tempVars = generateForHosts(source)

    return (
      <>
        {activeCspTab !== 'Host' ? (
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
        ) : null}
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
            host={activeCspTab === 'Host' ? focusedHost : ''}
            instance={activeCspTab !== 'Host' ? focusedInstance : null}
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
          layout.app === 'stackDriver'
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

  private async fetchHostsData(
    layouts: Layout[]
  ): Promise<{[host: string]: Host}> {
    const {source, links, notify} = this.props
    const {focusedHost} = this.state
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

      if (_.isEmpty(focusedHost)) {
        this.setState({
          focusedHost: this.getFirstHost(newHosts),
          hostsObject: newHosts,
          hostsPageStatus: RemoteDataState.Done,
        })
      } else {
        if (!_.includes(_.keys(newHosts), focusedHost)) {
          this.setState({
            focusedHost: this.getFirstHost(newHosts),
            hostsObject: newHosts,
            hostsPageStatus: RemoteDataState.Done,
          })
        } else {
          this.setState({
            hostsObject: newHosts,
            hostsPageStatus: RemoteDataState.Done,
          })
        }
      }

      return newHosts
    } catch (error) {
      console.error(error)
      notify(notifyUnableToGetHosts())
      this.setState({
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

  private async fetchInstancesAndMeasurements(
    layouts: Layout[],
    pInstance: Instance
  ) {
    const {source} = this.props
    const {selectedAgent} = this.state

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
      handleGetGCPInstancesAsync,
      notify,
    } = this.props

    const {focusedInstance, activeCspTab} = this.state
    const dbResp: any[] = await handleLoadCspsAsync()
    const agentFilterItems = agentFilter[activeCspTab]

    let newDbResp: any[] = _.filter(
      _.map(dbResp, resp => {
        if (resp.provider === 'aws') {
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
        } else if (resp.provider === 'gcp') {
          resp = {
            ...resp,
          }
        }
        return resp
      }),
      filterData => {
        if (filterData.provider === activeCspTab) return filterData
      }
    )

    const namespaceFilterItems = _.map(newDbResp, resp => {
      if (resp.provider == activeCspTab) {
        return resp.namespace
      }
    })

    if (_.isEmpty(newDbResp)) {
      this.setState({
        cloudAccessInfos: [],
        cloudHostsObject: {},
        filteredLayouts: [],
        cspPageStatus: RemoteDataState.Done,
      })
      return
    }
    let getSaltCSPs =
      activeCspTab === 'aws'
        ? await handleGetAWSInstancesAsync(
            this.salt.url,
            this.salt.token,
            newDbResp
          )
        : await handleGetGCPInstancesAsync(
            this.salt.url,
            this.salt.token,
            newDbResp
          )

    let newCSPs = []

    getSaltCSPs = _.map(getSaltCSPs.return, getSaltCSP =>
      activeCspTab === 'aws' ? _.values(getSaltCSP) : _.values(getSaltCSP)[0]
    )

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

  private handleClickCspTableRow = (instance: Instance) => () => {
    this.onSetFocusedInstance(instance)
  }

  private setInfrastructureLocalStorage = () => {
    const getLocalStorageInfrastructure = getLocalStorage('infrastructure')
    let getHostsPage = _.get(getLocalStorageInfrastructure, 'hostsPage', {
      hostsPage: {},
    })
    const {
      selectedAgent,
      selectedNamespace,
      activeCspTab,
      focusedInstance,
      focusedHost,
    } = this.state
    getHostsPage = {
      ...getLocalStorageInfrastructure,
      hostsPage: {
        selectedAgent: selectedAgent,
        selectedNamespace: selectedNamespace,
        activeCspTab: activeCspTab,
        focusedInstance: focusedInstance,
        focusedHost: focusedHost,
      },
    }
    setLocalStorage('infrastructure', getHostsPage)
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
  handleGetGCPInstancesAsync: bindActionCreators(
    getGCPInstancesAsync,
    dispatch
  ),
  handleGetAWSInstanceTypesAsync: bindActionCreators(
    getAWSInstanceTypesAsync,
    dispatch
  ),
  handleGetGCPInstanceTypesAsync: bindActionCreators(
    getGCPInstanceTypesAsync,
    dispatch
  ),
})

export default connect(mstp, mdtp, null)(HostsPage)
