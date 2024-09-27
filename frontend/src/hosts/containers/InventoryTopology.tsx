// library
import React, {createRef, PureComponent, ChangeEvent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import {getDeep} from 'src/utils/wrappers'
import classnames from 'classnames'
import yaml from 'js-yaml'
import download from 'src/external/download'
import path from 'path'

// component
import {
  Form,
  Button,
  ComponentColor,
  ComponentSize,
  Page,
  Radio,
  OverlayTechnology,
} from 'src/reusable_ui'
import {
  Table,
  TableBody,
  TableBodyRowItem,
} from 'src/addon/128t/reusable/layout'
import {NoState} from 'src/agent_admin/reusable'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import Modal from 'src/hosts/components/Modal'
import PageSpinner from 'src/shared/components/PageSpinner'
import ResizableDock from 'src/shared/components/ResizableDock'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import Dropdown from 'src/shared/components/Dropdown'
import ConfirmButton from 'src/shared/components/ConfirmButton'
import InventoryTreemenu from 'src/hosts/components/InventoryTreemenu'
import TopologyDetails from 'src/hosts/components/TopologyDetails'
import InstanceTypeModal from 'src/hosts/components/InstanceTypeModal'
import TopologyCSPMngModal from 'src/hosts/components/TopologyCSPMngModal'
import ImportTopologyOverlay from 'src/hosts/components/ImportTopologyOverlay'
import TopologyPreferences from 'src/hosts/components/TopologyPreferences'
import LoadingSpinner from 'src/flux/components/LoadingSpinner'
import TopologyTooltip from 'src/hosts/components/TopologyTooltip'
// constants
import {
  HANDLE_NONE,
  HANDLE_HORIZONTAL,
  HANDLE_VERTICAL,
} from 'src/shared/constants/'
import {eachNodeTypeAttrs, tmpMenu} from 'src/hosts/constants/tools'
import {
  notifyUnableToGetHosts,
  notifygetCSPConfigFailed,
  notifygetCSPKeyFailed,
  notifyRequiredFailed,
  notifyTopologySaved,
  notifyTopologySaveFailed,
  notifyTopologySaveAuthFailed,
  notifyTopologyExported,
  notifyTopologyExportedFailed,
  notifyPreferencesTemperatureApplyFailed,
  notifyPreferencesTemperatureApplySucceeded,
  notifyFetchIntervalDataFailed,
  notifyGetDetectedHostStatusFailed,
  notifySetIpmiStatusFailed,
  notifyTopologyOptionChangeFailed,
  notifyMapReloadFailed,
} from 'src/shared/copy/notifications'
import {notIncludeApps} from 'src/hosts/constants/apps'
import {
  defaultPreferencesTemperature,
  temperatureMaxValue,
  temperatureMinValue,
} from 'src/hosts/constants/topology'

// Types
import {
  Source,
  Links,
  Host,
  Layout,
  RemoteDataState,
  Notification,
  NotificationFunc,
  Ipmi,
  IpmiCell,
  TimeRange,
  Me,
} from 'src/types'
import {AddonType} from 'src/shared/constants'
import {ButtonShape, ComponentStatus, IconFont} from 'src/reusable_ui/types'
import {
  CloudServiceProvider,
  CSPAccessObject,
  CSPFileWriteParam,
  Instance,
  PreferenceType,
  TopologyOption,
} from 'src/hosts/types'
import {
  default as mxgraph,
  mxEditor as mxEditorType,
  mxCell as mxCellType,
  mxGraph as mxGraphType,
  mxGraphModel as mxGraphModelType,
  mxGraphSelectionModel as mxGraphSelectionModeltype,
  mxEventObject as mxEventObjectType,
  mxGraphView,
} from 'mxgraph'
import {HostDetailTable} from 'src/hosts/types/agent'
import {TemperatureTooltip} from 'src/hosts/types/preferences'
import {IpmiSetPowerStatus} from 'src/shared/apis/saltStack'

// Actions
import {
  loadInventoryTopologyAsync,
  getIpmiStatusAsync,
  setIpmiStatusAsync,
  getIpmiSensorDataAsync,
  loadCloudServiceProvidersAsync,
  createCloudServiceProviderAsync,
  updateCloudServiceProviderAsync,
  deleteCloudServiceProviderAsync,
  getCSPListInstancesAsync,
  getAWSSecurityAsync,
  getAWSVolumeAsync,
  getAWSInstanceTypesAsync,
  writeCSPConfigAsync,
  writeCSPKeyAsync,
  getRunnerFileReadAsync,
} from 'src/hosts/actions'

import {notify, notify as notifyAction} from 'src/shared/actions/notifications'

// APIs
import {getEnv} from 'src/shared/apis/env'
import {
  getCpuAndLoadForHosts,
  getLayouts,
  getAppsForHost,
  getMeasurementsForHost,
  getAppsForEtc,
  getMeasurementsForEtc,
  getAppsForInstance,
  getMeasurementsForInstance,
  paramsCreateCSP,
  paramsUpdateCSP,
  createInventoryTopology,
  updateInventoryTopology,
  setRunnerFileRemoveApi,
  getMinionKeyAcceptedList,
  getHostsInfoWithIpmi,
} from 'src/hosts/apis'

// Utils
import {generateForHosts} from 'src/utils/tempVars'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {
  getContainerElement,
  getFocusedHost,
  getParseHTML,
} from 'src/hosts/utils/topology'
import {getCells} from 'src/hosts/utils/getCells'
import {
  getInstanceType,
  getInstanceDetails,
  getInstancStorage,
  getInstanceSecurity,
  cryptoJSAESencrypt,
  cryptoJSAESdecrypt,
  createCSPInstanceData,
  updateCSPInstanceData,
  getNamespaceID,
  isGCPRequiredCheck,
  getAgentDetails,
  generateSHA256Hash,
} from 'src/hosts/utils'

// error
import {ErrorHandling} from 'src/shared/decorators/errors'

// css
import 'mxgraph/javascript/src/css/common.css'

// Topology Configure
import {
  configureStylesheet,
  convertValueToString,
  isHtmlLabel,
  getLabel,
  dblClick,
  getAllCells,
  getConnectImage,
  isCellSelectable,
  createForm,
  createHTMLValue,
  openSensorData,
  addToolsButton,
  setToolbar,
  getFoldingImage,
  resizeCell,
  onClickMxGraph,
  createEdgeState,
  onConnectMxGraph,
  factoryMethod,
  ipmiPowerIndicator,
  filteredIpmiPowerStatus,
  dragCell,
  applyHandler,
  detectedHostsStatus,
  getFromOptions,
  getFocusedCell,
  onMouseMovexGraph,
  mouseOverTooltipStatus,
  refreshGraph,
  isCellMovable,
  createIPMIStatusIcon,
  applyMultiHandler,
} from 'src/hosts/configurations/topology'
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'

// Authorized
import {ADMIN_ROLE, SUPERADMIN_ROLE, EDITOR_ROLE} from 'src/auth/Authorized'
import {
  getLocalStorage,
  setLocalStorage,
} from 'src/shared/middleware/localStorage'
import TopologySettingOverlay from 'src/hosts/components/TopologySettingOverlay'

const mx = mxgraph()

export const {
  mxEditor,
  mxGuide,
  mxDivResizer,
  mxEdgeHandler,
  mxEvent,
  mxGraphHandler,
  mxConstants,
  mxUtils,
  mxClient,
  mxImage,
  mxCellState,
  mxRubberband,
  mxForm,
  mxGraph,
  mxCodec,
  mxPerimeter,
  mxEdgeStyle,
  mxOutline,
  mxPoint,
  mxWindow,
  mxEffects,
  mxGraphModel,
  mxGeometry,
  mxPopupMenu,
  mxEventObject,
  mxConnectionHandler,
} = mx

window['mxGraph'] = mxGraph
window['mxUtils'] = mxUtils
window['mxGraphModel'] = mxGraphModel
window['mxGeometry'] = mxGeometry
window['mxCodec'] = mxCodec
window['mxEvent'] = mxEvent
window['mxEditor'] = mxEditor
window['mxGuide'] = mxGuide
window['mxDivResizer'] = mxDivResizer
window['mxEdgeHandler'] = mxEdgeHandler
window['mxGraphHandler'] = mxGraphHandler
window['mxConstants'] = mxConstants
window['mxClient'] = mxClient
window['mxImage'] = mxImage
window['mxCellState'] = mxCellState
window['mxRubberband'] = mxRubberband
window['mxForm'] = mxForm
window['mxPerimeter'] = mxPerimeter
window['mxEdgeStyle'] = mxEdgeStyle
window['mxWindow'] = mxWindow
window['mxEffects'] = mxEffects
window['mxOutline'] = mxOutline
window['mxPoint'] = mxPoint
window['mxPopupMenu'] = mxPopupMenu
window['mxEventObject'] = mxEventObject
window['mxConnectionHandler'] = mxConnectionHandler

interface Auth {
  me: Me
}
interface Props {
  auth: Auth
  source: Source
  links: Links
  autoRefresh: number
  manualRefresh: number
  notify: (message: Notification | NotificationFunc) => void
  onManualRefresh: () => void
  handleGetInventoryTopology: (links: Links) => Promise<any>
  handleGetIpmiStatus: (
    saltMasterUrl: string,
    saltMasterToken: string,
    pIpmis: IpmiCell[]
  ) => Promise<any>
  handleSetIpmiStatusAsync: (
    saltMasterUrl: string,
    saltMasterToken: string,
    pIpmis: Ipmi,
    pStatus: IpmiSetPowerStatus
  ) => Promise<any>
  handleGetIpmiSensorDataAsync: (
    saltMasterUrl: string,
    saltMasterToken: string,
    pIpmis: Ipmi
  ) => Promise<any>
  handleLoadCspsAsync: () => Promise<any>
  handleCreateCspAsync: (data: paramsCreateCSP) => Promise<any>
  handleUpdateCspAsync: (data: paramsUpdateCSP) => Promise<any>
  handleDeleteCspAsync: (id: string) => Promise<any>
  handleGetCSPListInstancesAsync: (
    saltMasterUrl: string,
    saltMasterToken: string,
    pCsp: any[]
  ) => Promise<any>
  handleGetAWSSecurityAsync: (
    saltMasterUrl: string,
    saltMasterToken: string,
    pCsp: any,
    pGroupIds: string[]
  ) => Promise<any>
  handleGetAWSVolumeAsync: (
    saltMasterUrl: string,
    saltMasterToken: string,
    pCsp: any,
    pVolumeIds: string[]
  ) => Promise<any>
  handleGetAWSInstanceTypesAsync: (
    saltMasterUrl: string,
    saltMasterToken: string,
    pCsp: any,
    pTypes: string[]
  ) => Promise<any>
  timeRange: TimeRange
  handleWriteCspConfig: (
    saltMasterUrl: string,
    saltMasterToken: string,
    fileWrite: CSPFileWriteParam
  ) => Promise<any>
  handleWriteCspKey: (
    saltMasterUrl: string,
    saltMasterToken: string,
    fileWrite: CSPFileWriteParam
  ) => Promise<any>
  handleGetRunnerFileReadAsync: (
    saltMasterUrl: string,
    saltMasterToken: string,
    filePath: string[]
  ) => Promise<any>
}

interface State {
  screenProportions: number[]
  sidebarProportions: number[]
  bottomProportions: number[]
  hostsObject: {[x: string]: Host}
  minionList: string[]
  ipmis: Ipmi[]
  topology: string
  topologyId: string
  isModalVisible: boolean
  modalTitle: string
  modalMessage: JSX.Element
  topologyStatus: RemoteDataState
  isStatusVisible: boolean
  resizableDockHeight: number
  resizableDockWidth: number
  selectItem: string
  isPinned: boolean
  layouts: Layout[]
  filteredLayouts: Layout[]
  isDetectedServer: boolean
  focusedHost: string
  activeEditorTab: string
  activeDetailsTab: string
  selected: string
  appHostData: {}
  isCloudFormVisible: boolean
  isUpdateCloud: boolean
  provider: CloudServiceProvider
  cloudNamespace: string
  cloudAccessKey: string
  cloudSecretKey: string
  cloudSAEmail: string
  cloudSAKey: string
  treeMenu: any
  focusedInstance: Instance
  cloudAccessInfos: CSPAccessObject[]
  loadingState: RemoteDataState
  loadingStateDetails: RemoteDataState
  awsSecurity: Promise<any>
  awsVolume: Promise<any>
  awsInstanceTypes: Promise<any>
  isGetAwsSecurity: RemoteDataState
  isGetAwsVolume: RemoteDataState
  isGetAwsInstanceType: RemoteDataState
  isInstanceTypeModalVisible: boolean
  isImportTopologyOverlayVisible: boolean
  isTopologyChanged: boolean
  isOpenSensorData: RemoteDataState
  hostDetailInfoWithSalt: Partial<HostDetailTable> | {}
  isGetHostDetailInfo: RemoteDataState
  isPreferencesOverlayVisible: boolean
  isOptionOverlayVisible: boolean
  preferenceTemperatureValues: string[]
  originalTopology: string
  preferencesStatus: RemoteDataState
  unsavedPreferenceTemperatureValues: string[]
  fetchIntervalDataStatus: RemoteDataState
  isTooltipActiveHost: string | null
  targetPosition: {
    width: number
    top: number
    right: number
    left: number
    isOverContainerHeight: boolean
    cellId: string
  }
  tooltipNode: Partial<TemperatureTooltip>
  isMouseUp: boolean
  isSettingOverlayOpen: boolean
  topologyOption: TopologyOption
}

@ErrorHandling
export class InventoryTopology extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.setState = (args, callback) => {
      if (!this.isComponentMounted) return
      PureComponent.prototype.setState.bind(this)(args, callback)
    }

    const cloudTreeMenuTemplate = {
      aws: {
        buttons: [{provider: 'aws', isUpdate: false, text: 'Add Region'}],
        label: 'Amazon Web Service',
        index: 0,
        level: 0,
        provider: CloudServiceProvider.AWS,
        nodes: {},
      },
      gcp: {
        buttons: [{provider: 'gcp', isUpdate: false, text: 'Add Project'}],
        label: 'Google Cloud Platform',
        index: 1,
        level: 0,
        provider: CloudServiceProvider.GCP,
        nodes: {},
      },
      azure: {
        buttons: [{provider: 'azure', isUpdate: false, text: 'Add Namespace'}],
        label: 'Azure',
        index: 2,
        level: 0,
        provider: CloudServiceProvider.AZURE,
        nodes: {},
      },
    }

    let cloud = {}

    _.forEach(_.values(cloudTreeMenuTemplate), template => {
      const {
        links: {addons},
      } = this.props
      const findItem = _.find(
        addons,
        addon => addon.name === template.provider && addon.url === 'on'
      )
      const isFind = !_.isEmpty(findItem)

      if (isFind) {
        cloud[template.provider] = {...template}
      }
    })

    this.state = {
      isPinned: true,
      screenProportions: [0.17, 0.83],
      sidebarProportions: [0.333, 0.333, 0.333],
      bottomProportions: [0.54, 0.46],
      hostsObject: {},
      minionList: [],
      ipmis: [],
      topology: null,
      topologyId: null,
      isModalVisible: false,
      modalTitle: null,
      modalMessage: null,
      topologyStatus: RemoteDataState.Loading,
      isStatusVisible: true,
      resizableDockHeight: 165,
      resizableDockWidth: 200,
      selectItem: 'Host',
      layouts: [],
      filteredLayouts: [],
      isDetectedServer: false,
      focusedHost: '',
      activeEditorTab: 'monitoring',
      activeDetailsTab: 'details',
      selected: 'Agent',
      appHostData: {},
      isCloudFormVisible: false,
      isUpdateCloud: false,
      provider: null,
      cloudNamespace: '',
      cloudAccessKey: '',
      cloudSecretKey: '',
      cloudSAEmail: '',
      cloudSAKey: '',
      treeMenu: {...cloud},
      focusedInstance: null,
      cloudAccessInfos: [],
      loadingState: RemoteDataState.NotStarted,
      loadingStateDetails: RemoteDataState.Done,
      awsSecurity: null,
      awsVolume: null,
      awsInstanceTypes: null,
      isInstanceTypeModalVisible: false,
      isGetAwsSecurity: RemoteDataState.NotStarted,
      isGetAwsVolume: RemoteDataState.NotStarted,
      isGetAwsInstanceType: RemoteDataState.NotStarted,
      isImportTopologyOverlayVisible: false,
      isTopologyChanged: false,
      isOpenSensorData: RemoteDataState.NotStarted,
      hostDetailInfoWithSalt: {},
      isGetHostDetailInfo: RemoteDataState.NotStarted,
      isPreferencesOverlayVisible: false,
      isOptionOverlayVisible: false,
      preferenceTemperatureValues: [],
      unsavedPreferenceTemperatureValues: [],
      originalTopology: '',
      preferencesStatus: RemoteDataState.Done,
      fetchIntervalDataStatus: RemoteDataState.NotStarted,
      isTooltipActiveHost: null,
      targetPosition: {
        width: 0,
        top: 0,
        right: 0,
        left: 0,
        isOverContainerHeight: false,
        cellId: '',
      },
      tooltipNode: {},
      isMouseUp: true,
      isSettingOverlayOpen: false,
      topologyOption: {
        minimapVisible: true,
        ipmiVisible: true,
        linkVisible: true,
        hostStatusVisible: true,
      },
    }
  }

  public intervalID: number
  public timeout: NodeJS.Timer
  private isComponentMounted: boolean = true

  private containerRef = createRef<HTMLDivElement>()
  private outlineRef = createRef<HTMLDivElement>()
  private statusRef = createRef<HTMLDivElement>()
  private toolbarRef = createRef<HTMLDivElement>()
  private sidebarToolsRef = createRef<HTMLDivElement>()
  private sidebarPropertiesRef = createRef<HTMLDivElement>()

  private container: HTMLDivElement = null
  private outline: HTMLDivElement = null
  private toolbar: HTMLDivElement = null
  private tools: HTMLDivElement = null
  private properties: HTMLDivElement = null

  private editor: mxEditorType = null
  private graph: mxGraphType = null

  private secretKey = _.find(
    this.props.links.addons,
    addon => addon.name === AddonType.ipmiSecretKey
  )

  private salt = _.find(
    this.props.links.addons,
    addon => addon.name === AddonType.salt
  )

  private isUsingCSP =
    _.get(
      _.find(
        this.props.links.addons,
        addon => addon.name === AddonType.aws || addon.name === AddonType.gcp
      ),
      'url',
      'off'
    ) === 'on'

  private configureStylesheet = configureStylesheet
  private getAllCells = getAllCells
  private openSensorData = openSensorData
  private addToolsButton = addToolsButton
  private setToolbar = setToolbar

  private confPath = `${
    _.get(
      _.find(this.props.links.addons, addon => addon.name === 'salt-env-path'),
      'url'
    ) || '/etc/salt/'
  }cloud.providers.d/`
  private keyPath = `${
    _.get(
      _.find(this.props.links.addons, addon => addon.name === 'salt-env-path'),
      'url'
    ) || '/etc/salt/'
  }csp_key/`

  public async componentDidMount() {
    const {notify} = this.props
    this.createEditor()
    this.configureEditor()
    this.setActionInEditor()
    this.configureStylesheet(mx)
    this.addToolsButton(this.tools)
    this.setToolbar(this.editor, this.toolbar)

    const layoutResults = await getLayouts()
    const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])
    this.setState({
      layouts,
    })

    try {
      if (this.isUsingCSP) {
        await this.handleLoadCsps()
      }
      await this.getInventoryTopology()

      this.setTopologySetting()

      await this.fetchIntervalData()
      await this.getIpmiTargetList()
    } catch (error) {
      notify(notifyFetchIntervalDataFailed(error.message))
    }

    if (this.props.autoRefresh) {
      this.intervalID = window.setInterval(
        () => this.fetchIntervalData(),
        this.props.autoRefresh
      )
    }

    GlobalAutoRefresher.poll(this.props.autoRefresh)
  }

  public async componentDidUpdate(prevProps: Props, prevState: State) {
    const {autoRefresh, manualRefresh} = this.props
    const {
      layouts,
      focusedHost,
      isPinned,
      focusedInstance,
      selected,
      cloudAccessInfos,
      selectItem,
      hostsObject,
      isDetectedServer,
      activeEditorTab,
      topologyOption,
    } = this.state

    if (layouts) {
      if (
        (prevState.focusedHost !== focusedHost && focusedHost) ||
        (prevState.selected !== selected && focusedHost)
      ) {
        const {filteredLayouts} = isDetectedServer
          ? await this.getLayoutsforHost(layouts, focusedHost)
          : await this.getLayoutsforEtc(layouts, focusedHost)
        this.setState({filteredLayouts})
      }
      if (
        (prevState.focusedInstance !== focusedInstance && focusedInstance) ||
        (prevState.selected !== selected && focusedInstance)
      ) {
        const getfrom =
          _.get(prevState.focusedInstance, 'provider') !==
          focusedInstance.provider
            ? 'Agent'
            : selected
        const {filteredLayouts} = await this.getLayoutsforInstance(
          layouts,
          focusedInstance
        )
        this.setState({filteredLayouts, selected: getfrom})
      }

      if (prevState.cloudAccessInfos !== cloudAccessInfos) {
        this.makeTreemenu()
      }

      if (
        !_.isEqual(
          prevState.topologyOption.minimapVisible,
          topologyOption.minimapVisible
        )
      ) {
        this.mapReload()
      }

      if (
        !_.isEqual(
          prevState.topologyOption.ipmiVisible,
          topologyOption.ipmiVisible
        ) ||
        !_.isEqual(
          prevState.topologyOption.hostStatusVisible,
          topologyOption.hostStatusVisible
        ) ||
        !_.isEqual(
          prevState.topologyOption.linkVisible,
          topologyOption.linkVisible
        )
      ) {
        this.onChangeTopologyOption()
      }
    }

    if (prevState.selectItem !== selectItem && selectItem === 'Host') {
      this.changedDOM()
    }

    if (
      JSON.stringify(_.keys(prevState.hostsObject)) !==
        JSON.stringify(_.keys(hostsObject)) &&
      prevState.hostsObject !== null
    ) {
      this.changedDOM()
    }

    if (prevProps.autoRefresh !== autoRefresh) {
      clearInterval(this.intervalID)
      GlobalAutoRefresher.poll(autoRefresh)

      if (autoRefresh) {
        this.intervalID = window.setInterval(() => {
          this.fetchIntervalData()
        }, autoRefresh)
      }
    }

    if (prevProps.manualRefresh !== manualRefresh) {
      this.fetchIntervalData()
    }

    if (prevState.isPinned !== isPinned) {
      if (isPinned) {
        clearTimeout(this.timeout)
      } else {
        this.setState({isStatusVisible: false})
      }
    }
    if (
      (prevState.activeEditorTab !== activeEditorTab ||
        prevState.focusedHost !== focusedHost) &&
      activeEditorTab === 'details'
    ) {
      this.setState({
        isGetHostDetailInfo: RemoteDataState.Loading,
        hostDetailInfoWithSalt: {},
      })

      const hostInfo = await getAgentDetails(
        this.salt.url,
        this.salt.token,
        focusedHost
      )

      this.setState({
        hostDetailInfoWithSalt: hostInfo,
        isGetHostDetailInfo: RemoteDataState.Done,
      })
    }
  }

  public componentWillUnmount() {
    const {isTopologyChanged} = this.state
    const view = this.graph.getView()
    if (
      (isTopologyChanged || this.compareTopology()) &&
      window.confirm('Do you want to save changes?')
    ) {
      this.handleTopologySave()
    }

    if (this.graph !== null) {
      this.graph.destroy()
      this.graph = null
    }

    if (this.intervalID !== null) {
      clearInterval(this.intervalID)
      this.intervalID = null
    }
    this.setLocalStorageToplogySetting(view)
    this.isComponentMounted = false
  }

  private compareTopology = () => {
    const previousTopology = this.state.originalTopology
    const currentTopology = this.state.topology

    const previousTopologyHash = generateSHA256Hash(previousTopology)
    const currentTopologyHash = generateSHA256Hash(currentTopology)

    return previousTopologyHash !== currentTopologyHash
  }

  public render() {
    const {
      provider,
      cloudNamespace,
      cloudAccessKey,
      cloudSecretKey,
      cloudSAEmail,
      cloudSAKey,
      isUpdateCloud,
      loadingState,
      isCloudFormVisible,
      isModalVisible,
      modalMessage,
      modalTitle,
      preferenceTemperatureValues,
      isInstanceTypeModalVisible,
      isImportTopologyOverlayVisible,
      isPreferencesOverlayVisible,
      preferencesStatus,
      isOptionOverlayVisible,
      topologyOption,
    } = this.state
    const {notify} = this.props
    const isExportXML = modalTitle === 'Export XML'
    return (
      <div id="containerWrapper" style={{userSelect: 'none'}}>
        {!mxClient.isBrowserSupported() ? (
          <>this Browser Not Supported</>
        ) : (
          <>
            <TopologyCSPMngModal
              provider={provider}
              cloudNamespace={cloudNamespace}
              cloudAccessKey={cloudAccessKey}
              cloudSecretKey={cloudSecretKey}
              cloudSAEmail={cloudSAEmail}
              cloudSAKey={cloudSAKey}
              isUpdateCloud={isUpdateCloud}
              isVisible={isCloudFormVisible}
              loadingState={loadingState}
              onInputChange={this.handleChangeInput}
              onTextAreaChange={this.handleChangeTextArea}
              onAddNamespace={this.handleAddNamespace}
              onUpdateNamespace={this.handleUpdateNamespace}
              onKeyPressEnter={this.handleKeyPressEnter}
              onEncrypt={this.handleEncrypt}
              onFocus={() => {
                this.setState({cloudSecretKey: ''})
              }}
              onCancel={this.closeCloudForm}
            />
            <Threesizer
              orientation={HANDLE_VERTICAL}
              divisions={this.threesizerDivisions}
              onResize={this.handleResize('screenProportions')}
            />
            <Modal
              isVisible={isModalVisible}
              headingTitle={modalTitle}
              onCancel={this.handleClose}
              message={modalMessage}
              customStyle={isExportXML ? null : {height: '122px'}}
              containerMaxWidth={isExportXML ? null : 450}
            />
            <InstanceTypeModal
              visible={isInstanceTypeModalVisible}
              message={this.renderInstanceTypeModal}
              onCancel={this.handleCloseInstanceTypeModal}
            />
            <OverlayTechnology visible={isImportTopologyOverlayVisible}>
              <ImportTopologyOverlay
                onDismissOverlay={this.handleImportTopologyToggleOverlay}
                onImportTopology={this.handleImportTopologyAndFetchIntervalData}
                notify={notify}
              />
            </OverlayTechnology>
            {isPreferencesOverlayVisible && (
              <TopologyPreferences
                preferencesStatus={preferencesStatus}
                preferenceTemperatureValues={preferenceTemperatureValues}
                onChangeTemperatureInput={this.handleChangeTemperatureInput}
                onClickTemperatureResetButton={
                  this.handleClickTemperatureResetButton
                }
                onClickTemperatureApplyButton={
                  this.handleClickTemperatureApplyButton
                }
                onClickTemperatureOkButton={this.handleClickTemperatureOkButton}
                onChangeRadioButton={this.handleChangeRadioButton}
                onDismissOverlay={this.handlePreferencesToggleOverlay}
                notify={notify}
              />
            )}
            {isOptionOverlayVisible && (
              <TopologySettingOverlay
                isOptionOverlayVisible={isOptionOverlayVisible}
                setIsOptionOverlayVisible={(value: boolean) =>
                  this.setState({isOptionOverlayVisible: value})
                }
                state={RemoteDataState.Done}
                topologyOption={topologyOption}
                setTopologyOption={(value: TopologyOption) =>
                  this.setState(prevState => ({
                    ...prevState,
                    topologyOption: value,
                  }))
                }
              />
            )}
          </>
        )}
      </div>
    )
  }

  private handleImportTopologyAndFetchIntervalData = async (
    importedTopology: string
  ) => {
    await this.importTopology(importedTopology)
    this.fetchIntervalData()
  }

  private importTopology = async (importedTopology: string) => {
    const topology = importedTopology
    const graph = this.graph

    graph.getModel().beginUpdate()

    try {
      const doc = mxUtils.parseXml(topology)
      const codec = new mxCodec(doc)

      codec.decode(doc.documentElement, graph.getModel())

      _.forEach(graph.getModel().cells, (cell: mxCellType) => {
        const containerElement = getContainerElement(cell.value)

        if (containerElement && containerElement.hasAttribute('data-type')) {
          const dataType = containerElement.getAttribute('data-type')
          const attrsKeys = _.map(
            _.keys(eachNodeTypeAttrs[dataType].attrs),
            attr => `data-${attr}`
          )

          const filterdAttrs = _.difference(
            _.map(
              _.filter(
                containerElement.attributes,
                attr => attr.nodeName !== 'class'
              ),
              attr => attr.nodeName
            ),
            attrsKeys
          )

          const removeAttrs = _.filter(
            containerElement.attributes,
            attr => _.indexOf(filterdAttrs, attr.nodeName) > -1
          )

          _.forEach(removeAttrs, attr => {
            applyHandler.bind(this)(this.graph, cell, attr)
            containerElement.removeAttribute(attr.nodeName)
            cell.setValue(containerElement.outerHTML)
          })

          createIPMIStatusIcon.bind(this)(graph, cell)
        }
      })
    } finally {
      graph.getModel().endUpdate()
    }
  }

  private handleImportTopologyToggleOverlay = (): void => {
    this.setState({
      isImportTopologyOverlayVisible: !this.state
        .isImportTopologyOverlayVisible,
    })
  }

  private selectedTemperatureType(
    preferenceTemperatureValues: string[]
  ): PreferenceType['temperatureType'] {
    const temperatureType = _.filter(
      preferenceTemperatureValues,
      temperatureValue => temperatureValue.includes('active:1')
    ).map(item => {
      const selectedTemperatureTypeMatch = item.match(/type:(\w+),/)

      return selectedTemperatureTypeMatch
        ? (selectedTemperatureTypeMatch[1] as PreferenceType['temperatureType'])
        : 'inlet'
    })

    return temperatureType[0]
  }

  private handleChangeTemperatureInput = (
    temperatureType: PreferenceType['temperatureType'],
    temperatureValueType: PreferenceType['temperatureValueType'],
    temperatureValue: string
  ): void => {
    const {preferenceTemperatureValues} = this.state

    if (
      temperatureValue === '' ||
      !/^-?\d+(\.\d+)?$/.test(temperatureValue) ||
      /[+-]/.test(temperatureValue) ||
      /^0[0-9]+$/.test(temperatureValue)
    ) {
      temperatureValue = '0'
    }

    const updatedTemperatureValues = _.map(
      preferenceTemperatureValues,
      preferenceTemperatureValue => {
        if (preferenceTemperatureValue.includes(`type:${temperatureType}`)) {
          const temperatueValue = preferenceTemperatureValue
            .split(',')
            .find(splittedTemperatureValue =>
              splittedTemperatureValue.includes(`${temperatureValueType}:`)
            )
            .split(':')[1]
          return preferenceTemperatureValue.replace(
            new RegExp(`${temperatureValueType}:${temperatueValue}`),
            `${temperatureValueType}:${temperatureValue}`
          )
        }
        return preferenceTemperatureValue
      }
    )

    this.setState({
      preferenceTemperatureValues: updatedTemperatureValues,
    })
  }

  public isValidTemperature = () => {
    const {notify} = this.props
    const {preferenceTemperatureValues} = this.state

    return _.filter(preferenceTemperatureValues, temperatureValue =>
      temperatureValue.includes('active:1')
    ).some(preferenceTemperatureValue => {
      const selectedTemperatureTypeMatch = preferenceTemperatureValue.match(
        /type:(\w+),/
      )

      const temperatureMinValue = preferenceTemperatureValue
        .split(',')
        .find(splittedTemperatureValue =>
          splittedTemperatureValue.includes('min:')
        )
        .split(':')[1]

      const temperatureMaxValue = preferenceTemperatureValue
        .split(',')
        .find(splittedTemperatureValue =>
          splittedTemperatureValue.includes('max:')
        )
        .split(':')[1]

      if (!temperatureMinValue || !temperatureMaxValue) {
        notify(
          notifyPreferencesTemperatureApplyFailed(
            `Invalid Value in ${selectedTemperatureTypeMatch[1]} temperature type`
          )
        )
        return true
      }
      if (temperatureMinValue === '' || temperatureMaxValue === '') {
        notify(
          notifyPreferencesTemperatureApplyFailed(
            `Empty Value in ${selectedTemperatureTypeMatch[1]} temperature type`
          )
        )
        return true
      }

      const minValue = parseFloat(temperatureMinValue)
      const maxValue = parseFloat(temperatureMaxValue)

      if (minValue >= maxValue || minValue < 0 || maxValue < 0) {
        notify(
          notifyPreferencesTemperatureApplyFailed(
            `Out of range in ${selectedTemperatureTypeMatch[1]} temperature type`
          )
        )
        return true
      }
    })
  }

  private handleClickTemperatureOkButton = async () => {
    const {notify} = this.props
    const {hostsObject, preferenceTemperatureValues} = this.state
    let updateNode = null
    if (this.isValidTemperature()) {
      return
    }
    if (!this.graph) return
    const graph = this.graph
    const parent = graph.getDefaultParent()
    const cells = this.getAllCells(parent, true)
    try {
      const selectedTemperatureValue = _.filter(
        preferenceTemperatureValues,
        temperatureValue => temperatureValue.includes('active:1')
      )
      const [count, err] = detectedHostsStatus.bind(this)(
        cells,
        hostsObject,
        selectedTemperatureValue?.[0]
      )
      if (err) {
        throw err
      }
      updateNode = count
      notify(notifyPreferencesTemperatureApplySucceeded())

      this.setState({
        isTopologyChanged: true,
        unsavedPreferenceTemperatureValues: preferenceTemperatureValues,
        isPreferencesOverlayVisible: !this.state.isPreferencesOverlayVisible,
      })
    } catch (error) {
      notify(notifyGetDetectedHostStatusFailed(error.message))
    } finally {
      refreshGraph(updateNode, graph, cells?.[0])
      this.setState({
        isPreferencesOverlayVisible: !this.state.isPreferencesOverlayVisible,
      })
    }
  }

  private handleClickTemperatureApplyButton = async () => {
    const {notify} = this.props
    const {hostsObject, preferenceTemperatureValues} = this.state
    let updateNode = null

    if (this.isValidTemperature()) {
      return
    }
    if (!this.graph) return
    const graph = this.graph
    const parent = graph.getDefaultParent()
    const cells = this.getAllCells(parent, true)
    try {
      const selectedTemperatureValue = _.filter(
        preferenceTemperatureValues,
        temperatureValue => temperatureValue.includes('active:1')
      )
      const [count, err] = detectedHostsStatus.bind(this)(
        cells,
        hostsObject,
        selectedTemperatureValue?.[0]
      )
      if (err) {
        throw err
      }
      updateNode = count

      notify(notifyPreferencesTemperatureApplySucceeded())

      this.setState({
        isTopologyChanged: true,
        unsavedPreferenceTemperatureValues: preferenceTemperatureValues,
      })
    } catch (error) {
      notify(notifyGetDetectedHostStatusFailed(error.message))
    } finally {
      refreshGraph(updateNode, graph, cells?.[0])
    }
  }

  private handleClickTemperatureResetButton = (
    temperatureType: PreferenceType['temperatureType']
  ): void => {
    const {preferenceTemperatureValues} = this.state
    const isInActiveTemperatureType =
      temperatureType !==
      this.selectedTemperatureType(preferenceTemperatureValues)

    if (isInActiveTemperatureType) {
      return
    }

    const updatedTemperatureValues = _.map(
      preferenceTemperatureValues,
      temperatureValue => {
        if (temperatureValue.includes(`type:${temperatureType}`)) {
          const temperatueMinValue = temperatureValue
            .split(',')
            .find(splittedTemperatureValue =>
              splittedTemperatureValue.includes(`min:`)
            )
            .split(':')[1]

          const temperatueMaxValue = temperatureValue
            .split(',')
            .find(splittedTemperatureValue =>
              splittedTemperatureValue.includes(`max:`)
            )
            .split(':')[1]

          temperatureValue = temperatureValue.replace(
            new RegExp(`min:${temperatueMinValue}`),
            `min:${temperatureMinValue[temperatureType]}`
          )
          temperatureValue = temperatureValue.replace(
            new RegExp(`max:${temperatueMaxValue}`),
            `max:${temperatureMaxValue[temperatureType]}`
          )
        }
        return temperatureValue
      }
    )

    this.setState({
      preferenceTemperatureValues: updatedTemperatureValues,
    })
  }

  private handleChangeRadioButton = (
    temperatureType: PreferenceType['temperatureType']
  ): void => {
    const {preferenceTemperatureValues} = this.state
    const updatedTemperatureValues = _.map(
      preferenceTemperatureValues,
      temperatureValue => {
        if (temperatureValue.includes(`type:${temperatureType}`)) {
          return temperatureValue.replace(/active:\d/, 'active:1')
        } else {
          return temperatureValue.replace(/active:\d/, 'active:0')
        }
      }
    )

    this.setState({
      preferenceTemperatureValues: updatedTemperatureValues,
    })
  }

  private handlePreferencesToggleOverlay = (): void => {
    const {unsavedPreferenceTemperatureValues} = this.state

    this.setState({
      preferenceTemperatureValues: unsavedPreferenceTemperatureValues,
      isPreferencesOverlayVisible: !this.state.isPreferencesOverlayVisible,
    })
  }

  private handleChangeTopologyOption = () => {
    if (this.isValidTemperature()) {
      return
    }
    if (!this.graph) return
    const graph = this.graph
    const cells = graph.getModel().cells

    try {
      _.forEach(cells, (cell: mxCellType) => {
        const containerElement = getContainerElement(cell.value)
        if (containerElement && containerElement.hasAttribute('data-type')) {
          const dataType = containerElement.getAttribute('data-type')

          const attrsKeys = _.map(
            _.keys(eachNodeTypeAttrs[dataType].attrs),
            attr => `data-${attr}`
          )
          _.forEach(attrsKeys, attr => {
            applyMultiHandler.bind(this)(cell, attr, dataType)
          })
        }
      })
    } catch (error) {
      notify(notifyTopologyOptionChangeFailed(error.message))
    }
  }

  private mapReload = () => {
    if (this.isValidTemperature()) {
      return
    }
    if (!this.graph) return

    const graph = this.graph
    const currentTranslate = graph.getView().getTranslate()
    const currentScale = graph.getView().getScale()

    this.setState(prevState => ({...prevState, isTopologyChanged: true}))

    graph.getModel().beginUpdate()
    try {
      graph.getView().setTranslate(currentTranslate.x, currentTranslate.y)
      graph.getView().setScale(currentScale)
    } catch (error) {
      notify(notifyMapReloadFailed(error.message))
    } finally {
      graph.getModel().endUpdate()
    }
  }

  private onChangeTopologyOption = () => {
    const {notify} = this.props
    if (!this.graph) return
    this.setState(preState => ({
      ...preState,
      fetchIntervalDataStatus: RemoteDataState.Loading,
    }))
    try {
      this.graph.model.beginUpdate()
      this.handleChangeTopologyOption()

      this.fetchIpmiStatus()
      this.getDetectedHostStatus()
    } catch (error) {
      notify(notifyTopologyOptionChangeFailed(error.message))
    } finally {
      this.graph.model.endUpdate()
      this.graph.refresh()
      this.setState(preState => ({
        ...preState,
        fetchIntervalDataStatus: RemoteDataState.Done,
        topology: this.xmlExport(this.graph.getModel()),
        isTopologyChanged: true,
      }))
    }
  }

  private handleCloseInstanceTypeModal = () => {
    this.setState({isInstanceTypeModalVisible: false})
  }

  private get renderInstanceTypeModal() {
    return (
      <FancyScrollbar style={{height: '450px'}} autoHide={false}>
        <TopologyDetails
          selectInstanceData={getInstanceType(this.state.awsInstanceTypes)}
        />
      </FancyScrollbar>
    )
  }

  private closeCloudForm = () => {
    this.setState({
      isCloudFormVisible: false,
      cloudNamespace: '',
      cloudAccessKey: '',
      cloudSecretKey: '',
      cloudSAEmail: '',
      cloudSAKey: '',
    })
  }

  private ConfirmMessage = ({
    ipmiHost,
    popupText,
    onConfirm,
  }: {
    target: string
    ipmiHost: string
    ipmiUser: string
    popupText: string
    onConfirm: () => Promise<any>
  }) => {
    const HEADER_WIDTH = {width: '40%'}

    return (
      <Form>
        <Form.Element>
          <Table>
            <TableBody>
              <>
                <div className={'hosts-table--tr'}>
                  <div className={'hosts-table--th'} style={HEADER_WIDTH}>
                    Host
                  </div>
                  <div className={'hosts-table--td'}>{ipmiHost}</div>
                </div>
                <div className={'hosts-table--tr'}>
                  <div className={'hosts-table--th'} style={HEADER_WIDTH}>
                    Set Power
                  </div>
                  <div className={'hosts-table--td'}>{popupText}</div>
                </div>
              </>
            </TableBody>
          </Table>
        </Form.Element>
        <Form.Footer>
          <Button text={'Cancel'} onClick={this.handleClose} />
          <Button
            color={ComponentColor.Success}
            text={'Apply'}
            onClick={onConfirm}
            status={ComponentStatus.Default}
          />
        </Form.Footer>
      </Form>
    )
  }

  public async getInventoryTopology() {
    const topology = await this.props.handleGetInventoryTopology(
      this.props.links
    )

    if (_.get(topology, 'diagram')) {
      const graph = this.graph

      graph.getModel().beginUpdate()
      try {
        const doc = mxUtils.parseXml(topology.diagram)
        const codec = new mxCodec(doc)

        codec.decode(doc.documentElement, graph.getModel())

        _.forEach(graph.getModel().cells, (cell: mxCellType) => {
          const containerElement = getContainerElement(cell.value)

          if (containerElement && containerElement.hasAttribute('data-type')) {
            const dataType = containerElement.getAttribute('data-type')
            const attrsKeys = _.map(
              _.keys(eachNodeTypeAttrs[dataType].attrs),
              attr => `data-${attr}`
            )
            const filterdAttrs = _.difference(
              _.map(
                _.filter(
                  containerElement.attributes,
                  attr => attr.nodeName !== 'class'
                ),
                attr => attr.nodeName
              ),
              attrsKeys
            )

            const removeAttrs = _.filter(
              containerElement.attributes,
              attr => _.indexOf(filterdAttrs, attr.nodeName) > -1
            )

            _.forEach(removeAttrs, attr => {
              applyHandler.bind(this)(this.graph, cell, attr)
              containerElement.removeAttribute(attr.nodeName)
              cell.setValue(containerElement.outerHTML)
            })
            createIPMIStatusIcon.bind(this)(graph, cell)
          }
        })
      } finally {
        graph.getModel().endUpdate()

        if (_.get(topology, 'topologyOptions')) {
          this.setState({topologyOption: topology.topologyOptions})
        }
      }
    }

    if (this.graph) {
      this.graph.getModel().addListener(mxEvent.CHANGE, this.handleGraphModel)
    }

    this.setState({
      preferenceTemperatureValues: _.get(
        topology,
        'preferences',
        defaultPreferencesTemperature
      ),
      unsavedPreferenceTemperatureValues: _.get(
        topology,
        'preferences',
        defaultPreferencesTemperature
      ),
      originalTopology: _.get(topology, 'diagram'),
      topology: _.get(topology, 'diagram'),
      topologyId: _.get(topology, 'id'),
      topologyStatus: RemoteDataState.Done,
    })
  }

  private toggleIsPinned = () => {
    this.setState({isPinned: !this.state.isPinned})
  }

  private fetchIntervalData = async () => {
    const {notify} = this.props
    if (!this.graph) return
    this.setState(preState => ({
      ...preState,
      fetchIntervalDataStatus: RemoteDataState.Loading,
    }))
    try {
      this.graph.model.beginUpdate()
      await this.getHostData()
      this.fetchIpmiStatus()
      this.getDetectedHostStatus()
    } catch (error) {
      notify(notifyFetchIntervalDataFailed(error.message))
    } finally {
      this.graph.model.endUpdate()
      this.graph.refresh()
      this.setState(preState => ({
        ...preState,
        fetchIntervalDataStatus: RemoteDataState.Done,
      }))
    }
  }

  private getIpmiData = async () => {
    const {source, auth} = this.props

    const meRole = _.get(auth, 'me.role', '')

    const tempVars = generateForHosts(source)

    const hostsObject = await getHostsInfoWithIpmi(
      source.links.proxy,
      source.telegraf,
      tempVars,
      meRole
    )

    return hostsObject
  }
  private getHostData = async () => {
    const {source, links, auth} = this.props
    const meRole = _.get(auth, 'me.role', '')
    const envVars = await getEnv(links.environment)
    const telegrafSystemInterval = getDeep<string>(
      envVars,
      'telegrafSystemInterval',
      ''
    )
    const tempVars = generateForHosts(source)

    const agentObject = await getCpuAndLoadForHosts(
      source.links.proxy,
      source.telegraf,
      telegrafSystemInterval,
      tempVars,
      meRole
    )
    const ipmiObject = await this.getIpmiData()
    const hostsObject = _.defaultsDeep({}, agentObject, ipmiObject)
    const hostsError = notifyUnableToGetHosts().message
    if (!hostsObject) {
      throw new Error(hostsError)
    }
    this.setState({
      hostsObject,
    })
  }

  private getDetectedHostStatus = (focusedCellId?: string) => {
    const {unsavedPreferenceTemperatureValues, hostsObject} = this.state

    if (!this.graph) return

    const graph = this.graph
    const parent = graph.getDefaultParent()
    const cells = this.getAllCells(parent, true)
    const selectedTemperatureValue = _.find(
      unsavedPreferenceTemperatureValues,
      temperatureValue => temperatureValue.includes('active:1')
    )

    const filteredCells = focusedCellId
      ? getFocusedCell(cells, focusedCellId)
      : cells

    const [updateCount, err] = detectedHostsStatus.bind(this)(
      filteredCells,
      hostsObject,
      selectedTemperatureValue
    )
    return [updateCount, err]
  }

  private fetchIpmiStatus = (focusedCellId?: string) => {
    if (!this.graph || !this.state.topologyOption.ipmiVisible) return

    const graph = this.graph
    const {hostsObject} = this.state
    const parent = graph.getDefaultParent()
    const cells = this.getAllCells(parent, true)

    const filteredCells = focusedCellId
      ? getFocusedCell(cells, focusedCellId)
      : cells

    const ipmiCells: IpmiCell[] = filteredIpmiPowerStatus.bind(this)(
      filteredCells
    )

    _.forEach(ipmiCells, ipmiCell => {
      if (hostsObject[ipmiCell.hostname]?.powerStatus) {
        ipmiCell.powerStatus = hostsObject[ipmiCell.hostname].powerStatus
      }
    })
    ipmiPowerIndicator.bind(this)(ipmiCells)
  }

  private getIpmiTargetList = async () => {
    try {
      const minionList: string[] = await getMinionKeyAcceptedList(
        this.salt.url,
        this.salt.token
      )

      if (minionList) {
        this.setState({minionList})
      }
    } catch (error) {
      console.error(error)
    }
  }

  private createEditor = () => {
    this.editor = new mxEditor()
    this.graph = this.editor.graph

    this.container = this.containerRef.current
    this.outline = this.outlineRef.current
    this.tools = this.sidebarToolsRef.current
    this.properties = this.sidebarPropertiesRef.current
    this.toolbar = this.toolbarRef.current
  }

  private configureEditor = () => {
    new mxRubberband(this.graph)

    mxConstants.MIN_HOTSPOT_SIZE = 16
    mxConstants.DEFAULT_HOTSPOT = 1

    mxGraphHandler.prototype.previewColor = '#f58220'
    mxGraphHandler.prototype.guidesEnabled = true

    mxGuide.prototype.isEnabledForEvent = (evt: MouseEvent) => {
      return !mxEvent.isAltDown(evt)
    }

    mxEdgeHandler.prototype.snapToTerminals = true

    this.graph.setTooltips(true)
    this.graph.getTooltipForCell = function (cell: mxCellType) {
      const cellElement = getParseHTML(cell.value)
      const statusKind = cellElement
        .querySelector('div')
        .getAttribute('data-status-kind')
      const statusValue = cellElement
        .querySelector('div')
        .getAttribute('data-status-value')

      return statusKind !== null
        ? _.upperCase(statusKind) +
            ':' +
            statusValue +
            (!_.isEmpty(statusValue) ? '%' : '')
        : null
    }
    this.graph.connectionHandler.addListener(
      mxEvent.CONNECT,
      onConnectMxGraph.bind(this)
    )

    this.graph.connectionHandler.createEdgeState = createEdgeState.bind(this)

    if (mxClient.IS_QUIRKS) {
      document.body.style.overflow = 'hidden'
      new mxDivResizer(this.container)
      new mxDivResizer(this.outline)
      new mxDivResizer(this.toolbar)
      new mxDivResizer(this.tools)
    }

    this.graph.setDropEnabled(false)

    this.graph.connectionHandler.getConnectImage = getConnectImage
    this.graph.connectionHandler.targetConnectImage = true

    this.graph.setAllowDanglingEdges(false)
    this.graph.createGroupCell = (cells: mxCellType[]) => {
      if (_.isEmpty(cells)) return
      const group = mxGraph.prototype.createGroupCell.apply(this.graph, cells)
      const containerElement = getContainerElement(cells[0].value)
      const groupName = containerElement.getAttribute('data-parent')

      const groupObj = {
        ...tmpMenu,
        name: groupName ? groupName : 'Group',
        label: groupName ? groupName : 'Group',
        type: 'Group',
      }

      const groupCell = createHTMLValue(groupObj, 'group')
      group.setValue(groupCell.outerHTML)
      group.setVertex(true)
      group.setConnectable(true)

      group.setStyle('group')

      return group
    }

    mxConnectionHandler.prototype.mouseDown = function (_, me) {
      this.mouseDownCounter++

      const event = me.getEvent()

      if (event.button === 2 || event.buttons === 2) {
        return
      }

      if (
        this.isEnabled() &&
        this.graph.isEnabled() &&
        !me.isConsumed() &&
        !this.isConnecting() &&
        this.isStartEvent(me)
      ) {
        if (
          this.constraintHandler.currentConstraint != null &&
          this.constraintHandler.currentFocus != null &&
          this.constraintHandler.currentPoint != null
        ) {
          this.sourceConstraint = this.constraintHandler.currentConstraint
          this.previous = this.constraintHandler.currentFocus
          this.first = this.constraintHandler.currentPoint.clone()
        } else {
          // Stores the location of the initial mousedown
          this.first = new mxPoint(me.getGraphX(), me.getGraphY())
        }

        this.edgeState = this.createEdgeState(me)
        this.mouseDownCounter = 1

        if (this.waypointsEnabled && this.shape == null) {
          this.waypoints = null
          this.shape = this.createShape()

          if (this.edgeState != null) {
            this.shape.apply(this.edgeState)
          }
        }

        // Stores the starting point in the geometry of the preview
        if (this.previous == null && this.edgeState != null) {
          var pt = this.graph.getPointForEvent(me.getEvent())
          this.edgeState.cell.geometry.setTerminalPoint(pt, true)
        }

        this.fireEvent(new mxEventObject(mxEvent.START, 'state', this.previous))

        me.consume()
      }

      this.selectedIcon = this.icon
      this.icon = null
    }

    mxGraph.prototype.groupCells = function (group, border, cells) {
      if (cells == null) {
        cells = mxUtils.sortCells(this.getSelectionCells(), true)
      }

      cells = this.getCellsForGroup(cells)

      if (group == null) {
        group = this.createGroupCell(cells)
      }

      var bounds = this.getBoundsForGroup(group, cells, border)

      if (cells.length >= 1 && bounds != null) {
        // Uses parent of group or previous parent of first child
        var parent = this.model.getParent(group)

        if (parent == null) {
          parent = this.model.getParent(cells[0])
        }

        this.model.beginUpdate()
        try {
          // Checks if the group has a geometry and
          // creates one if one does not exist
          if (this.getCellGeometry(group) == null) {
            this.model.setGeometry(group, new mxGeometry())
          }

          // Adds the group into the parent
          var index = this.model.getChildCount(parent)
          this.cellsAdded(
            [group],
            parent,
            index,
            null,
            null,
            false,
            false,
            false
          )

          // Adds the children into the group and moves
          index = this.model.getChildCount(group)
          this.cellsAdded(cells, group, index, null, null, false, false, false)
          this.cellsMoved(cells, -bounds.x, -bounds.y, false, false, false)

          // Resizes the group
          this.cellsResized([group], [bounds], false)

          this.fireEvent(
            new mxEventObject(
              mxEvent.GROUP_CELLS,
              'group',
              group,
              'border',
              border,
              'cells',
              cells
            )
          )
        } finally {
          this.model.endUpdate()
        }
      }

      return group
    }

    this.graph.panningHandler.ignoreCell = true
    this.graph.panningHandler.isForcePanningEvent = me => {
      return me.getEvent().button === 2
    }

    this.graph.isCellSelectable = isCellSelectable.bind(this)
    this.graph.isCellMovable = isCellMovable.bind(this)

    this.graph.setConnectable(true)

    this.graph.dblClick = dblClick.bind(this)
    this.graph.getLabel = getLabel.bind(this)
    this.graph.isHtmlLabel = isHtmlLabel.bind(this)
    this.graph.convertValueToString = convertValueToString.bind(this)

    this.graph
      .getSelectionModel()
      .addListener(mxEvent.CHANGE, _.debounce(this.onChangedSelection, 600))

    this.graph.addListener(mxEvent.CLICK, onClickMxGraph.bind(this))

    this.graph.addMouseListener({
      mouseDown: () => {
        this.setState({isMouseUp: false})
      },
      mouseMove: _.throttle((_, me) => {
        const tooltipInfo = onMouseMovexGraph.call(this, this.graph, me)

        if (this.state.isMouseUp && tooltipInfo) {
          this.showTooltip(
            tooltipInfo.cell,
            tooltipInfo.geometry,
            tooltipInfo.isOverContainerHeight,
            tooltipInfo.cellId
          )
        } else {
          this.closeTooltip()
        }
      }, 250),
      mouseUp: () => {
        this.closeTooltip()

        this.setState({isMouseUp: true})
      },
    })

    mxPopupMenu.prototype.useLeftButtonForPopup = true
    this.graph.popupMenuHandler.factoryMethod = factoryMethod(
      this.saltIpmiSetPowerAsync,
      this.saltIpmiGetSensorDataAsync
    ).bind(this)

    this.graph.constrainChildren = false

    this.graph.resizeCell = resizeCell.bind(this)

    this.editor.setGraphContainer(this.container)
    this.graph.getFoldingImage = getFoldingImage.bind(this)

    const outln = new mxOutline(this.graph, this.outline)
    outln.outline.setHtmlLabels(true)
  }

  private onChangedSelection = (
    mxGraphSelectionModel: mxGraphSelectionModeltype,
    _mxEventObject: mxEventObjectType
  ) => {
    const {activeEditorTab} = this.state
    const selectionCells = mxGraphSelectionModel['cells']

    if (selectionCells.length > 0) {
      const cellElement = getContainerElement(selectionCells[0].value)
      const dataNavi = cellElement.getAttribute('data-data_navi')

      if (dataNavi) {
        const {cloudAccessInfos} = this.state

        const instancename = cellElement.getAttribute('data-name')
        const navi = dataNavi.split('.')
        const provider = navi[0]
        const namespace = navi[2]
        const instanceid = navi[4]
        const accessInfo = _.find(
          cloudAccessInfos,
          c => c.provider === provider && c.namespace === namespace
        )

        if (!_.isEmpty(accessInfo) && provider === CloudServiceProvider.AWS) {
          const {secretkey} = accessInfo

          const newCloudAccessInfos = {
            ...accessInfo,
            secretkey: cryptoJSAESdecrypt(secretkey, this.secretKey.url),
          }

          const getData = _.filter(accessInfo.data, d =>
            _.isNull(d) ? false : d.InstanceId === instanceid
          )

          const securityGroupIds = _.reduce(
            _.get(getData[0], 'SecurityGroups'),
            (groupIds: string[], current) => {
              groupIds = [...groupIds, current.GroupId]

              return groupIds
            },
            []
          )

          this.getAWSSecurity(newCloudAccessInfos, securityGroupIds)

          const volumeGroupIds = _.reduce(
            _.get(getData[0], 'BlockDeviceMappings'),
            (groupIds: string[], current) => {
              groupIds = [...groupIds, current.Ebs.VolumeId]

              return groupIds
            },
            []
          )

          this.getAWSVolume(newCloudAccessInfos, volumeGroupIds)

          const types = _.reduce(
            getData,
            (types: string[], current) => {
              types = [...types, current.InstanceType]

              return types
            },
            []
          )

          this.getAWSInstanceTypes(newCloudAccessInfos, types)
        } else {
          this.setState({
            awsSecurity: null,
            awsInstanceTypes: null,
            awsVolume: null,
          })
        }
        this.setState({
          focusedInstance: {
            provider,
            namespace,
            instanceid,
            instancename,
          },
          focusedHost: null,
        })
      } else {
        const containerElement = getContainerElement(selectionCells[0].value)
        const isDetectedServer = !_.isEmpty(
          containerElement.getAttribute('data-type')
        )
          ? containerElement.getAttribute('data-type') !== 'Server'
            ? false
            : true
          : false

        const focusedHost = getFocusedHost(containerElement)

        this.setState({
          focusedInstance: null,
          isDetectedServer,
          focusedHost: focusedHost,
          activeEditorTab: activeEditorTab,
        })
      }
    } else {
      this.setState({
        focusedInstance: null,
        focusedHost: null,
        filteredLayouts: [],
      })
    }

    createForm.bind(this)(mxGraphSelectionModel.graph, this.properties)
  }

  private getAWSSecurity = async (
    accessInfos: any,
    securityGroupIds: string[]
  ) => {
    try {
      this.setState({isGetAwsSecurity: RemoteDataState.Loading})
      const awsSecurity = await this.props.handleGetAWSSecurityAsync(
        this.salt.url,
        this.salt.token,
        accessInfos,
        securityGroupIds
      )

      this.setState({awsSecurity})
    } catch (error) {
      this.setState({awsSecurity: null})
    } finally {
      this.setState({isGetAwsSecurity: RemoteDataState.Done})
    }
  }

  private getAWSVolume = async (accessInfos: any, volumeGroupIds: string[]) => {
    try {
      this.setState({isGetAwsVolume: RemoteDataState.Loading})
      const awsVolume = await this.props.handleGetAWSVolumeAsync(
        this.salt.url,
        this.salt.token,
        accessInfos,
        volumeGroupIds
      )

      this.setState({awsVolume})
    } catch (error) {
      this.setState({awsVolume: null})
    } finally {
      this.setState({isGetAwsVolume: RemoteDataState.Done})
    }
  }

  private getAWSInstanceTypes = async (accessInfos: any, types: string[]) => {
    try {
      this.setState({isGetAwsInstanceType: RemoteDataState.Loading})
      const awsInstanceTypes = await this.props.handleGetAWSInstanceTypesAsync(
        this.salt.url,
        this.salt.token,
        accessInfos,
        types
      )

      this.setState({awsInstanceTypes})
    } catch (error) {
      this.setState({awsInstanceTypes: null})
    } finally {
      this.setState({isGetAwsInstanceType: RemoteDataState.Done})
    }
  }

  private handleInstanceTypeModal = () => {
    this.setState({isInstanceTypeModalVisible: true})
  }

  private saltIpmiSetPowerAsync = _.throttle(
    async (
      target: string,
      ipmiHost: string,
      ipmiUser: string,
      ipmiPass: string,
      state: IpmiSetPowerStatus,
      popupText: string
    ) => {
      const credentialKeys = {
        target: 'Using Minion',
        host: 'IPMI Host',
        user: 'IPMI User',
        pass: 'IPMI Password',
      }

      const ipmiCredentials = {
        target,
        host: ipmiHost,
        user: ipmiUser,
        pass: ipmiPass,
      }
      for (const key in ipmiCredentials) {
        if (!ipmiCredentials[key]) {
          this.props.notify(
            notifySetIpmiStatusFailed(
              `The "${credentialKeys[key]}" field cannot be empty.`
            )
          )
          return
        }
      }

      const decryptedPass = cryptoJSAESdecrypt(ipmiPass, this.secretKey.url)

      const ipmi: Ipmi = {
        target,
        host: ipmiHost,
        user: ipmiUser,
        pass: decryptedPass,
      }

      const onConfirm = async () => {
        this.props
          .handleSetIpmiStatusAsync(this.salt.url, this.salt.token, ipmi, state)
          .finally(() => {
            this.setState({isModalVisible: false})
          })
      }

      this.setState({
        isModalVisible: true,
        modalTitle: 'IPMI Set Power',
        modalMessage: this.ConfirmMessage({
          target,
          ipmiHost,
          ipmiUser,
          popupText,
          onConfirm,
        }),
      })
    },
    500
  )

  private saltIpmiGetSensorDataAsync = _.throttle(
    async (
      target: string,
      ipmiHost: string,
      ipmiUser: string,
      ipmiPass: string,
      cell: mxCellType
    ) => {
      const {handleGetIpmiSensorDataAsync} = this.props
      const {isPinned, isStatusVisible, minionList} = this.state

      if (!ipmiHost || !ipmiUser || !ipmiPass || !target) {
        if (!isStatusVisible && !isPinned) {
          this.setState({isStatusVisible: false})
        }
        this.setState({
          isOpenSensorData: RemoteDataState.Error,
        })
        return
      }

      document.querySelector('#statusContainer').classList.add('active')
      this.setState({isStatusVisible: true})

      clearTimeout(this.timeout)
      this.timeout = null

      if (!_.includes(minionList, target)) {
        if (!isPinned) {
          this.timeout = setTimeout(() => {
            this.setState({isStatusVisible: false})
          }, 3000)
        }
        this.setState({
          isOpenSensorData: RemoteDataState.Error,
        })
        return
      }

      const pIpmi: Ipmi = {
        target,
        host: ipmiHost,
        user: ipmiUser,
        pass: cryptoJSAESdecrypt(ipmiPass, this.secretKey.url),
      }

      this.setState({
        isOpenSensorData: RemoteDataState.Loading,
      })

      const sensorData = await handleGetIpmiSensorDataAsync(
        this.salt.url,
        this.salt.token,
        pIpmi
      )

      const valueToCheck = _.values(sensorData)[0]
      const includesException =
        (typeof valueToCheck === 'string' &&
          valueToCheck.toLowerCase().includes('exception')) ||
        (typeof valueToCheck === 'boolean' && valueToCheck === false)

      if (_.isEmpty(sensorData) || includesException) {
        if (!isPinned) {
          this.timeout = setTimeout(() => {
            this.setState({isStatusVisible: false})
          }, 3000)
        }
        this.setState({
          isOpenSensorData: RemoteDataState.Error,
        })
        return
      }

      if (!isPinned) {
        this.timeout = setTimeout(() => {
          this.setState({isStatusVisible: false})
        }, 3000)
      }

      const currentCell = this.graph.getSelectionCell()

      if (cell && currentCell && cell.getId() === currentCell.getId()) {
        this.openSensorData(sensorData)
      } else {
        this.setState({
          isOpenSensorData: RemoteDataState.Error,
        })
        return
      }
      this.setState({
        isOpenSensorData: RemoteDataState.Done,
      })
    },
    500
  )

  private setActionInEditor = () => {
    const {auth} = this.props
    const meRole = _.get(auth, 'me.role', '')

    this.editor.addAction('group', () => {
      if (this.graph.isEnabled()) {
        let cells = mxUtils.sortCells(this.graph.getSelectionCells(), true)
        cells = _.filter(cells, cell => !cell.isEdge())

        let addEdgeCells = [...cells]

        _.forEach(cells, cell => {
          const childCell = this.graph.getChildCells(cell)

          if (childCell.length > 0) {
            const childCells = this.getAllCells(cell, true)

            _.forEach(childCells, childCell => {
              if (childCell?.edges) {
                const {edges} = childCell

                _.forEach(edges, edge => {
                  const excludeOwnEdge = _.filter(cells, c => c !== cell)

                  const isHasOwnEdge =
                    _.includes(excludeOwnEdge, edge.target) ||
                    _.includes(excludeOwnEdge, edge.source)

                  if (isHasOwnEdge) {
                    const isHasEdge = !_.includes(addEdgeCells, edge)
                    if (isHasEdge) {
                      addEdgeCells.push(edge)
                    }
                  }
                })
              }
            })
          } else {
            if (cell?.edges) {
              const {edges} = cell
              _.forEach(edges, edge => {
                const isHasConnectionEdge =
                  _.includes(cells, edge.target) &&
                  _.includes(cells, edge.source)

                if (isHasConnectionEdge) {
                  const isHasEdge = !_.includes(addEdgeCells, edge)

                  if (isHasEdge) {
                    addEdgeCells.push(edge)
                  }
                }
              })
            }
          }
        })

        if (
          addEdgeCells.length === 1 &&
          this.graph.isSwimlane(addEdgeCells[0])
        ) {
          return
        } else {
          const cellsForGroup = this.graph.getCellsForGroup(addEdgeCells)

          if (
            cellsForGroup.length > 1 &&
            cellsForGroup.length === addEdgeCells.length
          ) {
            const model = this.graph.getModel()
            const getParent = model.getParent(cellsForGroup[0])
            const isVertexSwimlane = this.graph.isSwimlane(getParent)

            if (!isVertexSwimlane) {
              const groupCell = this.graph.groupCells(null, 30, cellsForGroup)
              this.graph.setSelectionCell(groupCell)
            } else {
              const model = this.graph.getModel()
              const getParent = model.getParent(cellsForGroup[0])
              const getChildCells = this.graph.getChildCells(getParent)
              const isSameLength = getChildCells.length !== cellsForGroup.length

              if (isSameLength) {
                const groupCell = this.graph.groupCells(null, 30, cellsForGroup)
                this.graph.setSelectionCell(groupCell)
              }
            }
          }
        }
      }
    })

    this.editor.addAction('ungroup', () => {
      if (this.graph.isEnabled()) {
        const cells = this.graph.getSelectionCells()
        const groupCells = _.filter(cells, cell => this.graph.isSwimlane(cell))

        this.graph.model.beginUpdate()
        try {
          const temp = this.graph.ungroupCells(groupCells)

          const ungroupCells = _.map(temp, cell => {
            if (!this.graph.model.isVertex(cell)) {
              let geo = this.graph.getCellGeometry(cell)

              geo = geo.clone()
              geo.x = null
              geo.y = null
              geo.relative = true

              this.graph.getModel().setGeometry(cell, geo)
            }
            return cell
          })

          if (cells !== null) {
            _.forEach(cells, cell => {
              if (this.graph.model.contains(cell)) {
                if (
                  this.graph.model.getChildCount(cell) == 0 &&
                  this.graph.model.isVertex(cell)
                ) {
                  this.graph.setCellStyles('group', '0', [cell])
                }
                ungroupCells.push(cell)
              }
            })
          }

          this.graph.setSelectionCells(ungroupCells)
        } finally {
          this.graph.model.endUpdate()
        }
      }
    })

    this.editor.addAction('import', () => {
      this.setState({
        isImportTopologyOverlayVisible: true,
      })
      this.onChangeTopologyOption()
    })

    this.editor.addAction('export', () => {
      const {auth} = this.props
      const xmlString = this.xmlExport(this.graph.getModel())
      const exportFileName = `Topology_${auth.me.currentOrganization.name}`

      try {
        download(xmlString, `${exportFileName}.xml`, 'text/xml')
        this.props.notify(notifyTopologyExported(exportFileName))
      } catch (error) {
        this.props.notify(notifyTopologyExportedFailed(exportFileName, error))
      }
    })

    this.editor.addAction('save', async () => {
      if (
        meRole === SUPERADMIN_ROLE ||
        meRole === ADMIN_ROLE ||
        meRole === EDITOR_ROLE
      ) {
        this.handleTopologySave()
      } else {
        this.props.notify(notifyTopologySaveAuthFailed())
      }
    })

    this.editor.addAction('preferences', async () => {
      if (
        meRole === SUPERADMIN_ROLE ||
        meRole === ADMIN_ROLE ||
        meRole === EDITOR_ROLE
      ) {
        this.setState({
          isOptionOverlayVisible: false,
          isPreferencesOverlayVisible: true,
        })
      }
    })

    this.editor.addAction('option', async () => {
      if (
        meRole === SUPERADMIN_ROLE ||
        meRole === ADMIN_ROLE ||
        meRole === EDITOR_ROLE
      ) {
        this.setState({
          isOptionOverlayVisible: true,
          isPreferencesOverlayVisible: false,
        })
      }
    })
  }

  // @ts-ignore
  private graphUpdateSave = (cell: mxCellType) => {
    try {
      if (cell) {
        this.graph.refresh(cell)
        this.handleGraphModel(this.graph.getModel())
      }
    } catch (error) {
      console.error('Error updating graph:', error)
    }
  }

  private changedDOM = () => {
    const inventoryContainer = document.querySelector('#hostInventoryContainer')

    if (!inventoryContainer) return

    const hostList: NodeListOf<HTMLElement> = inventoryContainer.querySelectorAll(
      '.hosts-table--td'
    )

    _.forEach(hostList, host => {
      mxEvent.removeAllListeners(host)
    })

    _.forEach(hostList, host => {
      const dragElt = document.createElement('div')
      dragElt.style.border = 'dashed #f58220 1px'
      dragElt.style.width = `${90}px`
      dragElt.style.height = `${90}px`

      const value = host.textContent
      const node = {
        ...eachNodeTypeAttrs.Server.attrs,
        label: value,
        name: value,
        type: 'Server',
        status: 'agent',
        detected: true,
      }

      let ds = mxUtils.makeDraggable(
        host,
        this.graph,
        dragCell(node, this),
        dragElt,
        0,
        0,
        true,
        true
      )

      ds.setGuidesEnabled(true)
    })
  }

  private xmlExport = (sender: mxGraphModelType) => {
    const enc = new mxCodec(mxUtils.createXmlDocument())
    const cells = enc.encode(sender)

    // @ts-ignore
    const xmlString = mxUtils.getPrettyXml(cells)
    return xmlString
  }

  private handleGraphModel = (sender: mxGraphModelType) => {
    const previousTopology = this.state.topology
    const currentTopology = this.xmlExport(sender)

    const previousTopologyHash = generateSHA256Hash(previousTopology)
    const currentTopologyHash = generateSHA256Hash(currentTopology)

    if (previousTopologyHash !== currentTopologyHash) {
      this.setState({
        topology: currentTopology,
        isTopologyChanged: true,
      })
    }
  }

  private handleClose = () => {
    this.setState({isModalVisible: false})
  }

  private debouncedFit = _.debounce(() => {
    WindowResizeEventTrigger()
  }, 250)

  private handleResize = (fieldName: string) => (proportions: number[]) => {
    this.debouncedFit()
    this.setState((prevState: State) => ({
      ...prevState,
      [fieldName]: proportions,
    }))
  }

  private get threesizerDivisions() {
    const {screenProportions} = this.state
    const [leftSize, rightSize] = screenProportions

    return [
      {
        name: '',
        handleDisplay: HANDLE_NONE,
        headerButtons: [],
        menuOptions: [],
        size: leftSize,
        render: () => (
          <Threesizer
            orientation={HANDLE_HORIZONTAL}
            divisions={this.sidebarDivisions}
            onResize={this.handleResize('sidebarProportions')}
          />
        ),
      },
      {
        name: '',
        headerOrientation: HANDLE_VERTICAL,
        headerButtons: [],
        menuOptions: [],
        size: rightSize,
        handlePixels: 8,
        render: () => {
          return this.renderThreeSizer()
        },
      },
    ]
  }

  private get renderThreeSizerDivisions() {
    const {
      bottomProportions,
      topologyStatus,
      isStatusVisible,
      resizableDockHeight,
      resizableDockWidth,
      isPinned,
      isOpenSensorData,
      fetchIntervalDataStatus,
      topologyOption,
    } = this.state
    const [topSize, bottomSize] = bottomProportions
    return [
      {
        name: '',
        handleDisplay: 'none',
        headerOrientation: HANDLE_HORIZONTAL,
        headerButtons: [],
        menuOptions: [],
        size: topSize,
        render: () => {
          return (
            <>
              <div id="contentHeaderSection">
                <div id="toolbarContainer" ref={this.toolbarRef}></div>
              </div>
              <div id="contentBodySection">
                {fetchIntervalDataStatus === RemoteDataState.Loading && (
                  <LoadingSpinner className={'fetchIntervalDots'} />
                )}

                <div id="graphContainer" ref={this.containerRef}>
                  {topologyStatus === RemoteDataState.Loading && (
                    <PageSpinner />
                  )}
                  <div
                    id="outlineContainer"
                    ref={this.outlineRef}
                    style={{
                      display: topologyOption.minimapVisible ? 'block' : 'none',
                    }}
                  ></div>

                  <ResizableDock
                    className={classnames('', {
                      active: isStatusVisible,
                      impiInfoBorder: isStatusVisible,
                    })}
                    height={resizableDockHeight}
                    width={resizableDockWidth}
                    onResize={this.onResize}
                    resizeHandles={['sw']}
                    maxConstraints={[800, 200]}
                  >
                    <div id="statusContainer">
                      <Button
                        onClick={() => {
                          this.setState({isStatusVisible: false})
                        }}
                        customClass={'impiInfoButton'}
                        size={ComponentSize.ExtraSmall}
                        shape={ButtonShape.Square}
                        icon={IconFont.Remove}
                      ></Button>
                      <Button
                        onClick={() => {
                          this.toggleIsPinned()
                        }}
                        size={ComponentSize.ExtraSmall}
                        shape={ButtonShape.Square}
                        icon={IconFont.Pin}
                        customClass={'impiInfoButton'}
                        color={
                          isPinned
                            ? ComponentColor.Primary
                            : ComponentColor.Default
                        }
                      ></Button>
                      <span className="status-title">IPMI Sensor Info</span>
                      <div className={'status-ref-wrap'}>
                        <FancyScrollbar autoHide={false}>
                          {(isOpenSensorData === RemoteDataState.NotStarted ||
                            isOpenSensorData === RemoteDataState.Error) && (
                            <NoState
                              customClass="ipmiInfoNoData"
                              message="No Data"
                            />
                          )}
                          {isOpenSensorData === RemoteDataState.Loading && (
                            <PageSpinner customClass="ipmiInfoSpinner" />
                          )}
                          <div
                            id="statusContainerRef"
                            ref={this.statusRef}
                          ></div>
                        </FancyScrollbar>
                      </div>
                    </div>
                  </ResizableDock>
                </div>
                {this.tooltip}
              </div>
            </>
          )
        },
      },
      {
        name: '',
        headerOrientation: HANDLE_VERTICAL,
        headerButtons: [],
        menuOptions: [],
        size: bottomSize,
        handlePixels: 8,
        render: this.detailsGraph,
      },
    ]
  }

  private onSetActiveEditorTab = (activeEditorTab: string): void => {
    this.setState({
      activeEditorTab,
    })
  }

  private onClickActiveDetailsTab = (activeDetailsTab: string): void => {
    this.setState({
      activeDetailsTab,
    })
  }
  private detailsGraph = () => {
    const {
      focusedInstance,
      activeEditorTab,
      activeDetailsTab,
      selected,
    } = this.state

    const getFromItems = getFromOptions(focusedInstance)
    return (
      <>
        <Page className="inventory-hosts-list-page">
          <Page.Header fullWidth={true}>
            <Page.Header.Left>
              <>
                <div className="radio-buttons radio-buttons--default radio-buttons--sm">
                  <Radio.Button
                    id="hostspage-tab-monitoring"
                    titleText="monitoring"
                    value="monitoring"
                    active={activeEditorTab === 'monitoring'}
                    onClick={this.onSetActiveEditorTab}
                  >
                    Monitoring
                  </Radio.Button>
                  <Radio.Button
                    id="hostspage-tab-details"
                    titleText="details"
                    value="details"
                    active={activeEditorTab === 'details'}
                    onClick={this.onSetActiveEditorTab}
                  >
                    Details
                  </Radio.Button>
                </div>
              </>
            </Page.Header.Left>
            <Page.Header.Right>
              {activeEditorTab === 'monitoring' ? (
                <>
                  <span>
                    Get from <span style={{margin: '0 3px'}}>:</span>
                  </span>
                  <Dropdown
                    items={getFromItems}
                    onChoose={this.getHandleOnChoose}
                    selected={selected}
                    className="dropdown-sm"
                    disabled={false}
                  />
                </>
              ) : (
                ''
              )}
            </Page.Header.Right>
          </Page.Header>
          {this.detailsLoadingStatus}
          <Page.Contents scrollable={false}>
            {activeEditorTab === 'details' ? (
              <>
                {_.get(focusedInstance, 'provider') ===
                CloudServiceProvider.AWS ? (
                  <>
                    <div style={{marginBottom: '10px'}}>
                      <div className="radio-buttons radio-buttons--default radio-buttons--sm">
                        <Radio.Button
                          titleText="Details"
                          value="details"
                          active={activeDetailsTab === 'details'}
                          onClick={this.onClickActiveDetailsTab}
                        >
                          Details
                        </Radio.Button>
                        <Radio.Button
                          titleText="Security"
                          value="security"
                          active={activeDetailsTab === 'security'}
                          onClick={this.onClickActiveDetailsTab}
                        >
                          Security
                        </Radio.Button>
                        <Radio.Button
                          titleText="Storage"
                          value="storage"
                          active={activeDetailsTab === 'storage'}
                          onClick={this.onClickActiveDetailsTab}
                        >
                          Storage
                        </Radio.Button>
                      </div>
                    </div>
                  </>
                ) : null}
                <div style={{height: 'calc(100% - 22.5px)'}}>
                  <FancyScrollbar>
                    <TopologyDetails
                      selectInstanceData={this.getInstanceData()}
                      instanceTypeModal={this.handleInstanceTypeModal}
                    />
                  </FancyScrollbar>
                </div>
              </>
            ) : null}
            {activeEditorTab === 'monitoring' ? this.renderGraph() : null}
          </Page.Contents>
        </Page>
      </>
    )
  }

  private get detailsLoadingStatus() {
    const {
      isGetAwsSecurity,
      isGetAwsVolume,
      isGetAwsInstanceType,
      isGetHostDetailInfo,
      activeEditorTab,
    } = this.state
    const isActibeTabDetails = activeEditorTab === 'details'

    if (
      (isActibeTabDetails && isGetAwsSecurity === RemoteDataState.Loading) ||
      (isActibeTabDetails && isGetAwsVolume === RemoteDataState.Loading) ||
      (isActibeTabDetails &&
        isGetAwsInstanceType === RemoteDataState.Loading) ||
      (isActibeTabDetails && isGetHostDetailInfo === RemoteDataState.Loading)
    ) {
      return (
        <div
          style={{
            position: 'absolute',
            zIndex: 3,
            backgroundColor: 'rgba(0,0,0,0.5)',
            width: '100%',
            height: '100%',
          }}
        >
          <PageSpinner />
        </div>
      )
    }
    return null
  }

  private getInstanceData = () => {
    const {
      activeDetailsTab,
      focusedInstance,
      hostDetailInfoWithSalt,
      cloudAccessInfos,
      treeMenu,
      awsSecurity,
      awsVolume,
      focusedHost,
    } = this.state
    switch (_.get(focusedInstance, 'provider')) {
      case CloudServiceProvider.AWS: {
        if (activeDetailsTab === 'details') {
          return getInstanceDetails(cloudAccessInfos, focusedInstance)
        }

        if (activeDetailsTab === 'security') {
          return getInstanceSecurity(treeMenu, focusedInstance, awsSecurity)
        }

        if (activeDetailsTab === 'storage') {
          return getInstancStorage(treeMenu, focusedInstance, awsVolume)
        }
      }
      case CloudServiceProvider.AWS: {
        return getInstanceDetails(cloudAccessInfos, focusedInstance)
      }
      default: {
        return focusedHost === null ? {} : hostDetailInfoWithSalt
      }
    }
  }

  private getHandleOnChoose = (selectItem: {text: string}) => {
    this.setState({selected: selectItem.text})
  }

  private renderThreeSizer = () => {
    return (
      <Threesizer
        orientation={HANDLE_HORIZONTAL}
        divisions={this.renderThreeSizerDivisions}
        onResize={this.handleResize('bottomProportions')}
      />
    )
  }
  private onResize = (_event, data) => {
    const {size} = data

    this.setState({resizableDockWidth: size.width})
  }

  private onChooseItem = selectItem => {
    this.setState({selectItem})
  }

  private handleLoadCsps = async () => {
    const {handleLoadCspsAsync, handleGetCSPListInstancesAsync} = this.props
    const dbResp: any[] = await handleLoadCspsAsync()

    const filterDbResp: any[] = _.filter(dbResp, resp =>
      _.includes(_.keys(this.state.treeMenu), resp.provider)
    )

    const newDbResp = _.map(filterDbResp, resp => {
      if (resp.provider === CloudServiceProvider.AWS) {
        const {secretkey} = resp

        resp = {
          ...resp,
          secretkey: cryptoJSAESdecrypt(secretkey, this.secretKey.url),
        }
      } else if (resp.provider === CloudServiceProvider.GCP) {
        resp = {
          ...resp,
        }
      }

      return resp
    })

    const saltResp = await handleGetCSPListInstancesAsync(
      this.salt.url,
      this.salt.token,
      newDbResp
    )

    _.forEach(filterDbResp, (dResp, index) => {
      if (_.isUndefined(saltResp)) return

      if (dResp.provider === CloudServiceProvider.AWS) {
        dResp['data'] = !_.isEmpty(saltResp.return[index])
          ? _.values(saltResp.return[index]).length > 0
            ? _.values(saltResp.return[index])
            : []
          : []
      } else if (dResp.provider === CloudServiceProvider.GCP) {
        dResp['data'] =
          !_.isEmpty(saltResp.return[index]) &&
          _.isObject(saltResp.return[index])
            ? _.values(saltResp.return[index][dResp.namespace]['gce']).length >
              0
              ? _.values(saltResp.return[index][dResp.namespace]['gce'])
              : []
            : []
      }
    })

    this.setState({cloudAccessInfos: [...filterDbResp]})
  }

  private handleTopologySave = async () => {
    const {notify, links} = this.props
    const {
      topologyId,
      topology,
      unsavedPreferenceTemperatureValues,
      topologyOption,
    } = this.state

    this.setState({topologyStatus: RemoteDataState.Loading})

    try {
      if (_.isEmpty(topologyId) && !_.isEmpty(topology)) {
        const response = await createInventoryTopology(
          links,
          topology,
          unsavedPreferenceTemperatureValues
        )
        const getTopologyId = _.get(response, 'data.id', null)

        notify(notifyTopologySaved())

        this.setState({
          originalTopology: topology,
          topologyId: getTopologyId,
          topologyStatus: RemoteDataState.Done,
        })
      } else if (!_.isEmpty(topologyId)) {
        await updateInventoryTopology(
          links,
          topologyId,
          topology,
          unsavedPreferenceTemperatureValues,
          topologyOption
        )

        notify(notifyTopologySaved())

        this.fetchIntervalData()
        this.setState({
          originalTopology: topology,
          topologyStatus: RemoteDataState.Done,
          isTopologyChanged: false,
        })
      }
    } catch (err) {
      this.setState({topologyStatus: RemoteDataState.Done})

      const {data} = err
      const {error} = data
      if (!error) {
        notify(notifyTopologySaveFailed('Cannot save topology'))
        return false
      }
      const errorMsg = error.split(': ').pop()
      notify(notifyTopologySaveFailed(errorMsg))
      return false
    }
  }

  private handleAddNamespace = async () => {
    const {
      notify,
      handleCreateCspAsync,
      handleGetCSPListInstancesAsync,
    } = this.props
    const {
      provider,
      cloudNamespace,
      cloudAccessKey,
      cloudSecretKey,
      cloudSAEmail,
      cloudSAKey,
      isUpdateCloud,
      cloudAccessInfos,
    } = this.state

    const requiredCheck = isGCPRequiredCheck(
      provider,
      cloudNamespace,
      cloudAccessKey,
      cloudSecretKey,
      cloudSAEmail,
      cloudSAKey,
      isUpdateCloud
    )

    if (!_.isNull(requiredCheck)) {
      notify(notifyRequiredFailed(requiredCheck))
      return
    }

    const data = {
      provider,
      namespace: cloudNamespace,
      accesskey: cloudAccessKey,
      secretkey: cloudSecretKey,
    }

    const newData = (() => {
      if (provider === CloudServiceProvider.AWS) {
        return {
          ...data,
          secretkey: cryptoJSAESdecrypt(cloudSecretKey, this.secretKey.url),
        }
      } else {
        return data
      }
    })()

    try {
      this.setState({loadingState: RemoteDataState.Loading})

      if (
        !(provider === CloudServiceProvider.GCP
          ? await this.cloudproviderConfigWrite()
          : true)
      )
        return

      const saltResp = await handleGetCSPListInstancesAsync(
        this.salt.url,
        this.salt.token,
        [newData]
      )

      const checkSaltResp: string = (() => {
        if (provider === CloudServiceProvider.AWS) {
          return saltResp.return[0]
        } else {
          return saltResp.return[0][newData.namespace]
        }
      })()

      if (_.isString(checkSaltResp) && _.includes(checkSaltResp, 'exception')) {
        throw new Error('Failed to add namespace. exception error')
      }

      const dbResp = await handleCreateCspAsync(data)

      const newCloudAccessInfos = createCSPInstanceData(
        dbResp,
        saltResp,
        cloudAccessInfos
      )

      this.setState({
        cloudAccessInfos: newCloudAccessInfos,
      })
    } catch (error) {
      console.error(error)
    } finally {
      this.setState({loadingState: RemoteDataState.Done})
      this.closeCloudForm()
    }
  }

  private handleUpdateNamespace = async () => {
    const {handleUpdateCspAsync, handleGetCSPListInstancesAsync} = this.props
    const {
      treeMenu,
      provider,
      cloudNamespace,
      cloudAccessKey,
      cloudSecretKey,
      cloudSAEmail,
      cloudSAKey,
      isUpdateCloud,
      cloudAccessInfos,
    } = this.state

    const requiredCheck = isGCPRequiredCheck(
      provider,
      cloudNamespace,
      cloudAccessKey,
      cloudSecretKey,
      cloudSAEmail,
      cloudSAKey,
      isUpdateCloud
    )

    if (!_.isNull(requiredCheck)) {
      notify(notifyRequiredFailed(requiredCheck))
      return
    }

    let namespaceID = getNamespaceID(treeMenu, provider, cloudNamespace)

    const data: paramsUpdateCSP = {
      id: namespaceID,
      namespace: cloudNamespace,
      accesskey: cloudAccessKey,
      secretkey: cloudSecretKey,
    }

    const newData = (() => {
      if (provider === CloudServiceProvider.AWS) {
        const {secretkey} = data

        return {
          ...data,
          provider,
          secretkey: cryptoJSAESdecrypt(secretkey, this.secretKey.url),
        }
      } else {
        return {...data, provider}
      }
    })()

    try {
      this.setState({loadingState: RemoteDataState.Loading})

      if (
        !(provider === CloudServiceProvider.GCP
          ? await this.cloudproviderConfigWrite()
          : true)
      )
        return

      const saltResp = await handleGetCSPListInstancesAsync(
        this.salt.url,
        this.salt.token,
        [newData]
      )

      const dbResp = await handleUpdateCspAsync(data)

      const newCloudAccessInfos = updateCSPInstanceData(
        dbResp,
        saltResp,
        cloudAccessInfos
      )

      this.setState({cloudAccessInfos: [...newCloudAccessInfos]})
    } catch (error) {
      console.error(error)
    } finally {
      this.setState({loadingState: RemoteDataState.Done})
      this.closeCloudForm()
    }
  }

  private handleRemoveNamespace = async (
    provider: CloudServiceProvider,
    namespace: string
  ) => {
    const {treeMenu, cloudAccessInfos} = this.state
    const {handleDeleteCspAsync} = this.props
    const namespaceID = getNamespaceID(treeMenu, provider, namespace)
    const {isDelete} = await handleDeleteCspAsync(namespaceID)

    if (isDelete) {
      delete treeMenu[provider]['nodes'][namespace]

      const newCloudAccessInfos = _.filter(cloudAccessInfos, info => {
        let isNotSame = true
        if (info.provider === provider && info.namespace === namespace) {
          isNotSame = false
        }

        return isNotSame
      })

      this.setState({
        cloudAccessInfos: [...newCloudAccessInfos],
        treeMenu: {...treeMenu},
      })

      if (provider === CloudServiceProvider.GCP) {
        try {
          const confFile = `${this.confPath + namespace.trim()}.conf`
          const keyFile = path.join(
            this.keyPath,
            provider,
            namespace.trim() + '.pem'
          )

          await setRunnerFileRemoveApi(this.salt.url, this.salt.token, [
            confFile,
            keyFile,
          ])
        } catch (error) {
          console.error(error)
        }
      }
    }
  }

  private openCspFormBtn = (properties: any) => {
    const {
      provider,
      namespace,
      accesskey,
      secretkey,
      isUpdateCloud,
      icon,
      text,
    } = properties

    return (
      <Button
        color={ComponentColor.Primary}
        onClick={async () => {
          const {handleGetRunnerFileReadAsync} = this.props

          if (provider === CloudServiceProvider.GCP && isUpdateCloud) {
            const confFile = `${this.confPath + namespace.trim()}.conf`
            const keyFile = path.join(
              this.keyPath,
              provider,
              namespace.trim() + '.pem'
            )

            const saltResp = await handleGetRunnerFileReadAsync(
              this.salt.url,
              this.salt.token,
              [confFile, keyFile]
            )

            this.setState({
              provider,
              cloudNamespace: namespace,
              cloudAccessKey: accesskey,
              cloudSecretKey: secretkey,
              cloudSAEmail: _.get(
                yaml.safeLoad(saltResp.return[0]),
                `${namespace}.service_account_email_address`
              ),
              cloudSAKey: saltResp.return[1],
              isUpdateCloud: isUpdateCloud,
              isCloudFormVisible: true,
            })
          } else {
            this.setState({
              provider,
              cloudNamespace: namespace,
              cloudAccessKey: accesskey,
              cloudSecretKey: secretkey,
              isUpdateCloud: isUpdateCloud,
              isCloudFormVisible: true,
            })
          }
        }}
        shape={isUpdateCloud ? ButtonShape.Square : ButtonShape.Default}
        size={ComponentSize.ExtraSmall}
        icon={icon}
        text={text}
      />
    )
  }

  private removeNamespaceBtn = ({
    provider,
    namespace,
  }: {
    provider: CloudServiceProvider
    namespace: string
  }) => {
    return (
      <div style={{marginLeft: '3px'}}>
        <ConfirmButton
          text="Delete"
          type="btn-danger"
          size="btn-xs"
          icon={'trash'}
          confirmAction={() => {
            this.handleRemoveNamespace(provider, namespace)
          }}
          isEventStopPropagation={true}
          isButtonLeaveHide={true}
          isHideText={true}
          square={true}
        />
      </div>
    )
  }

  private get sidebarDivisions() {
    const {sidebarProportions, treeMenu, selectItem, hostsObject} = this.state
    const [topSize, middleSize, bottomSize] = sidebarProportions

    return [
      {
        name: 'Detected Hosts',
        headerOrientation: HANDLE_HORIZONTAL,
        headerButtons: !_.isEmpty(treeMenu)
          ? [
              <Button
                key={'Host'}
                color={
                  selectItem === 'Host'
                    ? ComponentColor.Primary
                    : ComponentColor.Default
                }
                text={'Host'}
                onClick={() => {
                  this.onChooseItem('Host')
                }}
                size={ComponentSize.ExtraSmall}
              />,
              <Button
                key={'Cloud'}
                color={
                  selectItem === 'Cloud'
                    ? ComponentColor.Primary
                    : ComponentColor.Default
                }
                text={'Cloud'}
                onClick={() => {
                  this.onChooseItem('Cloud')
                }}
                size={ComponentSize.ExtraSmall}
              />,
            ]
          : [],
        menuOptions: [],
        size: topSize,
        render: () => {
          if (selectItem === 'Host') {
            const hostList = _.keys(hostsObject)
            if (hostList.length > 0) {
              return (
                <FancyScrollbar>
                  <div id={'hostInventoryContainer'}>
                    <TableBody>
                      <>
                        {_.map(hostList, host => {
                          return (
                            <div key={host} className={`hosts-table--tr`}>
                              <TableBodyRowItem title={host} width={'100%'} />
                            </div>
                          )
                        })}
                      </>
                    </TableBody>
                  </div>
                </FancyScrollbar>
              )
            } else {
              return <NoState message={'There is no host'} />
            }
          }

          if (selectItem === 'Cloud') {
            return (
              <FancyScrollbar>
                <InventoryTreemenu
                  data={treeMenu}
                  graph={this.graph}
                  handleOpenCspFormBtn={this.openCspFormBtn}
                  handleDeleteNamespaceBtn={this.removeNamespaceBtn}
                />
              </FancyScrollbar>
            )
          }

          return null
        },
      },
      {
        name: 'Tools',
        headerOrientation: HANDLE_HORIZONTAL,
        headerButtons: [],
        menuOptions: [],
        size: middleSize,
        render: () => (
          <FancyScrollbar>
            <div ref={this.sidebarToolsRef} className={'tool-box'} />
          </FancyScrollbar>
        ),
      },
      {
        name: 'Properties',
        headerOrientation: HANDLE_HORIZONTAL,
        headerButtons: [],
        menuOptions: [],
        size: bottomSize,
        render: () => {
          return (
            <>
              <FancyScrollbar>
                {<div ref={this.sidebarPropertiesRef} />}
              </FancyScrollbar>
            </>
          )
        },
      },
    ]
  }

  private renderGraph = () => {
    const {source, manualRefresh, timeRange} = this.props
    const {filteredLayouts, focusedHost, focusedInstance} = this.state

    const layoutCells = getCells(filteredLayouts, source)
    const tempVars = generateForHosts(source)

    return (
      <FancyScrollbar>
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
          host={focusedHost}
          instance={focusedInstance}
        />
      </FancyScrollbar>
    )
  }

  private async fetchHostsAndMeasurements(layouts: Layout[], hostID: string) {
    const {source} = this.props
    const {selected} = this.state
    const tempVars = generateForHosts(source)

    const fetchMeasurements = getMeasurementsForHost(source, hostID, selected)

    const filterLayouts = _.filter(
      layouts,
      m => !_.includes(notIncludeApps, m.app)
    )

    const fetchHosts = getAppsForHost(
      source.links.proxy,
      hostID,
      filterLayouts,
      source.telegraf,
      tempVars,
      selected
    )

    const [host, measurements] = await Promise.all([
      fetchHosts,
      fetchMeasurements,
    ])
    const filteredMeasurements =
      selected === 'Agent'
        ? measurements.filter(measurement => measurement !== 'ipmi_sensor')
        : measurements

    return {host, measurements: filteredMeasurements}
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
        return (
          layout.app === 'system' ||
          layout.app === 'win_system' ||
          layout.app === 'ipmi_sensor'
        )
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

  private async fetchEtcAndMeasurements(layouts: Layout[], hostID: string) {
    const {source} = this.props

    const tempVars = generateForHosts(source)
    const fetchMeasurements = getMeasurementsForEtc(source, hostID)
    const filterLayouts = _.filter(layouts, m =>
      _.includes(['cloudwatch_elb', 'system', 'win_system'], m.app)
    )

    const fetchHosts = getAppsForEtc(
      source.links.proxy,
      hostID,
      filterLayouts,
      source.telegraf,
      tempVars
    )

    const [host, measurements] = await Promise.all([
      fetchHosts,
      fetchMeasurements,
    ])

    return {host, measurements}
  }

  private async getLayoutsforEtc(layouts: Layout[], hostID: string) {
    const {host, measurements} = await this.fetchEtcAndMeasurements(
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
        return (
          layout.app === 'cloudwatch_elb' ||
          layout.app === 'system' ||
          layout.app === 'win_system'
        )
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

  private async fetchInstancesAndMeasurements(
    layouts: Layout[],
    pInstance: Instance
  ) {
    const {source} = this.props
    const {selected, focusedInstance} = this.state

    const tempVars = generateForHosts(source)
    const fetchMeasurements = getMeasurementsForInstance(
      source,
      pInstance,
      selected
    )
    const filterLayouts = (() => {
      if (focusedInstance.provider === CloudServiceProvider.AWS) {
        return _.filter(layouts, m =>
          _.includes(['cloudwatch', 'system', 'win_system'], m.app)
        )
      } else if (focusedInstance.provider === CloudServiceProvider.GCP) {
        return _.filter(layouts, m =>
          _.includes(['stackdriver', 'system', 'win_system'], m.app)
        )
      } else {
        return layouts
      }
    })()

    const fetchInstances = getAppsForInstance(
      source.links.proxy,
      pInstance,
      filterLayouts,
      source.telegraf,
      tempVars,
      selected
    )

    const [instance, measurements] = await Promise.all([
      fetchInstances,
      fetchMeasurements,
    ])

    return {instance, measurements}
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
          layout.app === 'stackdriver'
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

  private handleChangeInput = (inputKey: string) => (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const input = {[inputKey]: e.target.value}
    this.setState({...this.state, ...input})
  }

  private handleChangeTextArea = (inputKey: string) => (
    e: ChangeEvent<HTMLTextAreaElement>
  ) => {
    const input = {[inputKey]: e.target.value}
    this.setState({...this.state, ...input})
  }

  private makeTreemenu = () => {
    const {treeMenu, cloudAccessInfos} = this.state

    if (_.isEmpty(treeMenu)) return

    const cloudDataTree = {...treeMenu}

    _.forEach(cloudAccessInfos, cloudAccessInfo => {
      const {
        id,
        provider,
        namespace,
        accesskey,
        secretkey,
        data,
      } = cloudAccessInfo
      const cloudProvider = cloudDataTree[provider]
      const cloudNamespaces = cloudProvider['nodes']

      if (cloudAccessInfo.provider === CloudServiceProvider.AWS) {
        cloudNamespaces[namespace] = {
          ...cloudNamespaces[namespace],
          buttons: [
            {
              id,
              provider,
              namespace,
              accesskey,
              secretkey,
              isUpdateCloud: true,
              isDeleteCloud: false,
              text: 'Update Namespace',
              icon: 'pencil',
            },
            {
              id,
              provider,
              namespace,
              isUpdateCloud: false,
              isDeleteCloud: true,
              text: 'Delete Namespace',
            },
          ],
          label: namespace,
          index: _.values(cloudNamespaces).length,
          level: 1,
          namespaceID: id,
          nodes: {},
        }
      } else if (cloudAccessInfo.provider === CloudServiceProvider.GCP) {
        cloudNamespaces[namespace] = {
          ...cloudNamespaces[namespace],
          buttons: [
            {
              id,
              provider,
              namespace,
              accesskey,
              secretkey,
              isUpdateCloud: true,
              isDeleteCloud: false,
              text: 'Update Project',
              icon: 'pencil',
            },
            {
              id,
              provider,
              namespace,
              isUpdateCloud: false,
              isDeleteCloud: true,
              text: 'Delete Project',
            },
          ],
          label: namespace,
          index: _.values(cloudNamespaces).length,
          level: 1,
          namespaceID: id,
          nodes: {},
        }
      }

      if (cloudAccessInfo.provider === CloudServiceProvider.AWS) {
        _.forEach(data, instanceData => {
          if (
            !instanceData ||
            !_.isObject(instanceData) ||
            !_.has(instanceData, 'Tags')
          )
            return
          const instanceid: string = _.get(instanceData, 'InstanceId')
          const label = _.get(instanceData, 'Tags')[0]['Value']
          const cloudNamespace = cloudNamespaces[namespace]
          const cloudInstances = cloudNamespace['nodes']

          cloudInstances[instanceid] = {
            ...cloudInstances[instanceid],
            instanceid,
            label,
            index: _.values(cloudInstances).length,
            provider,
            namespace,
            level: 2,
            meta: instanceData,
            nodes: {},
          }
        })
      } else if (cloudAccessInfo.provider === CloudServiceProvider.GCP) {
        _.forEach(data, instanceData => {
          if (!instanceData || typeof instanceData !== 'object') return
          const instanceid: string = _.get(instanceData, 'id')
          const label = _.get(instanceData, 'name')
          const cloudNamespace = cloudNamespaces[namespace]
          const cloudInstances = cloudNamespace['nodes']

          cloudInstances[instanceid] = {
            ...cloudInstances[instanceid],
            instanceid,
            label,
            index: _.values(cloudInstances).length,
            provider,
            namespace,
            level: 2,
            meta: instanceData,
            nodes: {},
          }
        })
      }
    })

    this.setState({treeMenu: cloudDataTree})
  }

  private handleEncrypt = () => {
    const {cloudSecretKey} = this.state

    if (cloudSecretKey.length < 1) return

    const encryptCloudSecretKey = cryptoJSAESencrypt(
      cloudSecretKey,
      this.secretKey.url
    )

    this.setState({cloudSecretKey: encryptCloudSecretKey})
  }

  private handleKeyPressEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const enterKeyCode = 13
    const enterKey = 'Enter'

    if (
      e.keyCode === enterKeyCode ||
      e.charCode === enterKeyCode ||
      e.key === enterKey
    ) {
      this.handleEncrypt()
    }
  }

  private cloudproviderConfigWrite = async () => {
    const {provider, cloudNamespace, cloudSAEmail, cloudSAKey} = this.state
    const {notify, handleWriteCspConfig, handleWriteCspKey} = this.props
    try {
      const confFileName = `${cloudNamespace.trim()}.conf`
      const keyFileName = `${cloudNamespace.trim()}.pem`

      const cspConfig = `${cloudNamespace.trim()}:
  project: ${cloudNamespace}
  service_account_email_address: ${cloudSAEmail.trim()}
  service_account_private_key: ${path.join(this.keyPath, provider, keyFileName)}

  grains:
    node_type: broker
    release: 1.0.1

  driver: gce`

      const config: CSPFileWriteParam = {
        path: this.confPath,
        fileName: confFileName,
        script: cspConfig,
      }

      await handleWriteCspConfig(this.salt.url, this.salt.token, config).then(
        configRes => {
          if (!configRes) {
            notify(notifygetCSPConfigFailed())
            throw new Error(notifygetCSPConfigFailed().message)
          }
        }
      )

      if (!_.isEmpty(cloudSAKey)) {
        const key: CSPFileWriteParam = {
          path: path.join(this.keyPath, provider, '/'),
          fileName: keyFileName,
          script: cloudSAKey.trim(),
        }

        await handleWriteCspKey(this.salt.url, this.salt.token, key).then(
          keyRes => {
            if (!keyRes) {
              notify(notifygetCSPKeyFailed())
              throw new Error(notifygetCSPKeyFailed().message)
            }
          }
        )
      }

      return true
    } catch (error) {
      console.error(error)
      this.setState({loadingState: RemoteDataState.Done})
    }
  }

  private showTooltip = (
    focusedCell: mxCellType,
    geometry: {x: number; y: number},
    isOverContainerHeight: boolean,
    cellId: string
  ) => {
    const {
      isTooltipActiveHost,
      hostsObject,
      unsavedPreferenceTemperatureValues,
    } = this.state

    const container = getContainerElement(focusedCell.value)
    const hostname = container.getAttribute('data-name')
    const dataGatherType = container.getAttribute('data-status')

    if (isTooltipActiveHost === cellId || dataGatherType === 'none') {
      return
    }

    const tooltipStatus = mouseOverTooltipStatus(
      hostsObject,
      hostname,
      unsavedPreferenceTemperatureValues,
      dataGatherType
    )

    this.setState({
      isTooltipActiveHost: cellId,
      targetPosition: {
        left: geometry.x,
        top: geometry.y,
        right: 0,
        width: 0,
        isOverContainerHeight,
        cellId,
      },

      tooltipNode: {
        dataType: dataGatherType,
        hostname,
        ...tooltipStatus,
        extraTag: hostsObject[hostname]?.extraTag ?? {},
      },
    })
  }

  private closeTooltip = () => {
    const {isTooltipActiveHost} = this.state
    if (isTooltipActiveHost !== null) {
      this.setState({
        isTooltipActiveHost: null,
      })
    }
  }

  private get tooltip() {
    const {isTooltipActiveHost, targetPosition, tooltipNode} = this.state
    if (isTooltipActiveHost) {
      return (
        <TopologyTooltip
          key={targetPosition.cellId}
          targetPosition={targetPosition}
          tooltipNode={tooltipNode}
        />
      )
    }
  }

  private setTopologySetting = () => {
    const {auth} = this.props

    const {zoom, translate} = getLocalStorage('inventoryTopologySetting')?.[
      auth.me.currentOrganization.name
    ] ?? {
      zoom: 1,
      translate: {x: 0, y: 0},
    }

    const view = this.graph.getView()
    view.setScale(zoom)
    view.setTranslate(translate.x, translate.y)
    view.revalidate()
  }

  private setLocalStorageToplogySetting = (view: mxGraphView) => {
    const {auth} = this.props
    const zoom = view.getScale()
    const translate = view.getTranslate()

    setLocalStorage('inventoryTopologySetting', {
      [auth.me.currentOrganization.name]: {zoom, translate},
    })
  }
}
const mapStateToProps = ({links, auth}) => {
  return {
    links,
    auth,
  }
}

const mapDispatchToProps = {
  handleGetInventoryTopology: loadInventoryTopologyAsync,
  handleGetIpmiStatus: getIpmiStatusAsync,
  handleSetIpmiStatusAsync: setIpmiStatusAsync,
  handleGetIpmiSensorDataAsync: getIpmiSensorDataAsync,
  notify: notifyAction,
  handleLoadCspsAsync: loadCloudServiceProvidersAsync,
  handleCreateCspAsync: createCloudServiceProviderAsync,
  handleUpdateCspAsync: updateCloudServiceProviderAsync,
  handleDeleteCspAsync: deleteCloudServiceProviderAsync,
  handleGetCSPListInstancesAsync: getCSPListInstancesAsync,
  handleGetAWSSecurityAsync: getAWSSecurityAsync,
  handleGetAWSVolumeAsync: getAWSVolumeAsync,
  handleGetAWSInstanceTypesAsync: getAWSInstanceTypesAsync,
  handleWriteCspConfig: writeCSPConfigAsync,
  handleWriteCspKey: writeCSPKeyAsync,
  handleGetRunnerFileReadAsync: getRunnerFileReadAsync,
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null
)(InventoryTopology)
