import React, {createRef, PureComponent, ChangeEvent} from 'react'
import {Controlled as ReactCodeMirror} from 'react-codemirror2'
import {connect} from 'react-redux'
import _ from 'lodash'
import {getDeep} from 'src/utils/wrappers'
import CryptoJS from 'crypto-js'
import classnames from 'classnames'

import {
  default as mxgraph,
  mxEditor as mxEditorType,
  mxCell as mxCellType,
  mxGraph as mxGraphType,
  mxGraphModel as mxGraphModelType,
  mxGraphSelectionModel as mxGraphSelectionModeltype,
  mxEventObject as mxEventObjectType,
} from 'mxgraph'

// component
import {
  Form,
  Button,
  ComponentColor,
  ComponentSize,
  Page,
  Radio,
  Input,
  InputType,
  OverlayTechnology,
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
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

// constants
import {
  HANDLE_NONE,
  HANDLE_HORIZONTAL,
  HANDLE_VERTICAL,
} from 'src/shared/constants/'
import {eachNodeTypeAttrs, tmpMenu} from 'src/hosts/constants/tools'
import {notifyUnableToGetHosts} from 'src/shared/copy/notifications'

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
} from 'src/types'
import {timeRanges} from 'src/shared/data/timeRanges'
import {AddonType} from 'src/shared/constants'
import {ButtonShape, ComponentStatus, IconFont} from 'src/reusable_ui/types'
import {IpmiSetPowerStatus} from 'src/shared/apis/saltStack'
import {CloudServiceProvider} from 'src/hosts/types'

// Actions
import {
  loadInventoryTopologyAsync,
  createInventoryTopologyAsync,
  updateInventoryTopologyAsync,
  getIpmiStatusAsync,
  setIpmiStatusAsync,
  getIpmiSensorDataAsync,
  getMinionKeyAcceptedListAsync,
  loadCloudServiceProviderAsync,
  loadCloudServiceProvidersAsync,
  createCloudServiceProviderAsync,
  updateCloudServiceProviderAsync,
  deleteCloudServiceProviderAsync,
  getAWSInstancesAsync,
  getAWSSecurityAsync,
  getAWSVolumeAsync,
  getAWSInstanceTypesAsync,
} from 'src/hosts/actions'

import {notify as notifyAction} from 'src/shared/actions/notifications'

// APIs
import {getEnv} from 'src/shared/apis/env'
import {
  getCpuAndLoadForHosts,
  getLayouts,
  getAppsForHost,
  getMeasurementsForHost,
  getAppsForInstance,
  getMeasurementsForInstance,
  paramsCreateCSP,
  paramsUpdateCSP,
} from 'src/hosts/apis'

// Utils
import {generateForHosts} from 'src/utils/tempVars'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {
  getContainerElement,
  getContainerTitle,
  getTimeSeriesHost,
  getParseHTML,
} from 'src/hosts/utils/topology'
import {getCells} from 'src/hosts/utils/getCells'

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
} from 'src/hosts/configurations/topology'

import {cloudData} from './treemenuDummy'

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

const warningImage = new mxImage(
  require('mxgraph/javascript/src/images/warning.png'),
  16,
  16
)
interface Instance {
  provider: string
  region: string
  instanceid: string
  instancename: string
}

interface Props {
  source: Source
  links: Links
  autoRefresh: number
  manualRefresh: number
  notify: (message: Notification | NotificationFunc) => void
  onManualRefresh: () => void
  handleGetInventoryTopology: (links: Links) => Promise<any>
  handleCreateInventoryTopology: (
    links: Links,
    topology: string
  ) => Promise<any>
  handleUpdateInventoryTopology: (
    links: Links,
    topologyId: string,
    topology: string
  ) => Promise<any>
  handleGetMinionKeyAcceptedList: (
    saltMasterUrl: string,
    saltMasterToken: string
  ) => Promise<string[]>
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
  handleLoadCspAsync: (id: string) => Promise<any>
  handleLoadCspsAsync: () => Promise<any>
  handleCreateCspAsync: (data: paramsCreateCSP) => Promise<any>
  handleUpdateCspAsync: (data: paramsUpdateCSP) => Promise<any>
  handleDeleteCspAsync: (id: string) => Promise<any>
  handleGetAWSInstancesAsync: (
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
  focusedHost: string
  timeRange: TimeRange
  activeEditorTab: string
  activeDetailsTab: string
  selected: string
  appHostData: {}
  isCloudFormVisible: boolean
  isUpdateCloud: boolean
  cloudRegion: string
  cloudAccessKey: string
  cloudSecretKey: string
  cloudTargetMinion: string
  provider: CloudServiceProvider
  treeMenu: any
  focusedInstance: Instance
  cloudAccessInfos: {
    id: string
    minion: string
    accesskey: string
    secretkey: string
    region: string
    provider: CloudServiceProvider
    organization: string
    data: any[]
  }[]
  cloudGetDatas: any
  loadingState: RemoteDataState
  loadingStateDetails: RemoteDataState
  awsSecurity: Promise<any>
  awsVolume: Promise<any>
  awsInstanceTypes: any
  isInstanceTypeModalVisible: boolean
}

@ErrorHandling
class InventoryTopology extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.setState = (args, callback) => {
      if (!this.isComponentMounted) return
      PureComponent.prototype.setState.bind(this)(args, callback)
    }

    let cloud = {}

    _.map(_.values(cloudData), f => {
      if (_.find(this.props.links.addons, addon => addon.name === f.provider)) {
        cloud[`${f.provider}`] = f
      }
    })

    this.state = {
      isPinned: false,
      screenProportions: [0.3, 0.7],
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
      isStatusVisible: false,
      resizableDockHeight: 165,
      resizableDockWidth: 200,
      selectItem: 'Private',
      layouts: [],
      filteredLayouts: [],
      focusedHost: '',
      timeRange: timeRanges.find(tr => tr.lower === 'now() - 1h'),
      activeEditorTab: 'monitoring',
      activeDetailsTab: 'details',
      selected: 'ALL',
      appHostData: {},
      isCloudFormVisible: false,
      isUpdateCloud: false,
      cloudRegion: '',
      cloudAccessKey: '',
      cloudSecretKey: '',
      cloudTargetMinion: '',
      provider: null,
      treeMenu: {...cloud},
      focusedInstance: null,
      cloudAccessInfos: [],
      cloudGetDatas: [],
      loadingState: RemoteDataState.NotStarted,
      loadingStateDetails: RemoteDataState.Done,
      awsSecurity: null,
      awsVolume: null,
      awsInstanceTypes: null,
      isInstanceTypeModalVisible: false,
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

  private configureStylesheet = configureStylesheet
  private getAllCells = getAllCells
  private openSensorData = openSensorData
  private addToolsButton = addToolsButton
  private setToolbar = setToolbar

  public async componentDidMount() {
    await this.handleLoadCsps()

    this.createEditor()
    this.configureEditor()
    this.setActionInEditor()
    this.configureStylesheet(mx)

    this.addToolsButton(this.tools)
    this.setToolbar(this.editor, this.toolbar)

    const topology = await this.props.handleGetInventoryTopology(
      this.props.links
    )

    this.setState(
      {
        topology: _.get(topology, 'diagram'),
        topologyId: _.get(topology, 'id'),
      },
      async () => {
        const layoutResults = await getLayouts()
        const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

        // // For rendering whole hosts list
        await this.getHostData()
        await this.getIpmiTargetList()

        this.setState({
          layouts,
        })

        if (_.get(topology, 'diagram')) {
          const graph = this.graph

          graph.getModel().beginUpdate()
          try {
            const doc = mxUtils.parseXml(topology.diagram)
            const codec = new mxCodec(doc)

            codec.decode(doc.documentElement, graph.getModel())

            _.forEach(graph.getModel().cells, (cell: mxCellType) => {
              const containerElement = getContainerElement(cell.value)

              if (
                containerElement &&
                containerElement.hasAttribute('data-type')
              ) {
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
              }
            })
          } finally {
            graph.getModel().endUpdate()
          }

          await this.fetchIntervalData()

          if (this.props.autoRefresh) {
            this.intervalID = window.setInterval(
              () => this.fetchIntervalData(),
              this.props.autoRefresh
            )
          }

          GlobalAutoRefresher.poll(this.props.autoRefresh)

          const hostList = _.keys(this.state.hostsObject)

          this.setCellsWarning(hostList)
        }
      }
    )
    this.setState({
      topologyStatus: RemoteDataState.Done,
    })

    if (this.graph) {
      this.graph.getModel().addListener(mxEvent.CHANGE, this.handleGraphModel)
    }
  }

  public async componentDidUpdate(prevProps: Props, prevState: State) {
    const {
      handleUpdateInventoryTopology,
      handleCreateInventoryTopology,
      links,
      autoRefresh,
      manualRefresh,
    } = this.props
    const {
      layouts,
      focusedHost,
      isPinned,
      focusedInstance,
      selected,
      cloudAccessInfos,
      selectItem,
      hostsObject,
      topologyId,
      topology,
    } = this.state

    if (layouts) {
      if (
        (prevState.focusedHost !== focusedHost && focusedHost) ||
        (prevState.selected !== selected && focusedHost)
      ) {
        const {filteredLayouts} = await this.getLayoutsforHost(
          layouts,
          focusedHost
        )
        this.setState({filteredLayouts})
      }
      if (
        (prevState.focusedInstance !== focusedInstance && focusedInstance) ||
        (prevState.selected !== selected && focusedInstance)
      ) {
        const {filteredLayouts} = await this.getLayoutsforInstance(
          layouts,
          focusedInstance
        )
        this.setState({filteredLayouts})
      }

      if (prevState.cloudAccessInfos !== cloudAccessInfos) {
        this.makeTreemenu()
      }
    }

    if (prevState.selectItem !== selectItem && selectItem === 'Private') {
      this.changedDOM()
    }

    if (
      JSON.stringify(_.keys(prevState.hostsObject)) !==
        JSON.stringify(_.keys(hostsObject)) &&
      prevState.hostsObject !== null
    ) {
      this.setCellsWarning(_.keys(hostsObject))
      this.changedDOM()
    }

    if (_.isEmpty(topologyId) && !_.isEmpty(topology)) {
      const response = await handleCreateInventoryTopology(links, topology)

      if (_.get(response, 'data.id')) {
        this.setState({topologyId: _.get(response, 'data.id')})
      }
    } else if (
      !_.isEmpty(topologyId) &&
      !_.isEmpty(prevState.topology) &&
      prevState.topology !== topology
    ) {
      await handleUpdateInventoryTopology(links, topologyId, topology)
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
  }

  public componentWillUnmount() {
    if (this.graph !== null) {
      this.graph.destroy()
      this.graph = null
    }

    if (this.intervalID !== null) {
      clearInterval(this.intervalID)
      this.intervalID = null
    }

    this.isComponentMounted = false
  }

  public render() {
    const {
      isModalVisible,
      modalMessage,
      modalTitle,
      isInstanceTypeModalVisible,
    } = this.state
    const isExportXML = modalTitle === 'Export XML'

    return (
      <div id="containerWrapper">
        {!mxClient.isBrowserSupported() ? (
          <>this Browser Not Supported</>
        ) : (
          <>
            {this.writeCloudForm}
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
          </>
        )}
      </div>
    )
  }

  private handleCloseInstanceTypeModal = () => {
    this.setState({isInstanceTypeModalVisible: false})
  }

  private get renderInstanceTypeModal() {
    return (
      <FancyScrollbar style={{height: '450px'}} autoHide={false}>
        <TopologyDetails selectInstanceData={this.getInstanceType()} />
      </FancyScrollbar>
    )
  }

  private get loadingState() {
    const {loadingState} = this.state
    let isLoading = false

    if (loadingState === RemoteDataState.Loading) {
      isLoading = true
    }

    return isLoading ? (
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
    ) : null
  }

  private closeCloudForm = () => {
    this.setState({
      isCloudFormVisible: false,
      cloudRegion: '',
      cloudAccessKey: '',
      cloudSecretKey: '',
      cloudTargetMinion: '',
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

  private ExportXMLMessage = () => {
    const {topology} = this.state
    const options = {
      tabIndex: 1,
      readonly: true,
      indentUnit: 2,
      smartIndent: true,
      electricChars: true,
      completeSingle: false,
      lineWrapping: true,
      mode: 'xml',
      theme: 'xml',
      autoFocus: true,
    }

    return (
      <FancyScrollbar>
        <ReactCodeMirror
          autoCursor={true}
          value={topology}
          options={options}
          onBeforeChange={(): void => {}}
          onTouchStart={(): void => {}}
        />
      </FancyScrollbar>
    )
  }

  private toggleIsPinned = () => {
    this.setState({isPinned: !this.state.isPinned})
  }

  private fetchIntervalData = async () => {
    await this.getHostData()
    await this.getIpmiStatus()
  }

  private getHostData = async () => {
    if (!this.graph) return

    const {source, links} = this.props

    const envVars = await getEnv(links.environment)
    const telegrafSystemInterval = getDeep<string>(
      envVars,
      'telegrafSystemInterval',
      ''
    )
    const tempVars = generateForHosts(source)

    const hostsObject = await getCpuAndLoadForHosts(
      source.links.proxy,
      source.telegraf,
      telegrafSystemInterval,
      tempVars
    )

    const hostsError = notifyUnableToGetHosts().message
    if (!hostsObject) {
      throw new Error(hostsError)
    }

    const graph = this.graph
    const parent = graph.getDefaultParent()
    const cells = this.getAllCells(parent, true)

    detectedHostsStatus.bind(this)(cells, hostsObject)

    this.setState({
      hostsObject,
    })
  }

  private getIpmiStatus = async () => {
    if (!this.graph) return

    const graph = this.graph
    const parent = graph.getDefaultParent()
    const cells = this.getAllCells(parent, true)
    let ipmiCells: IpmiCell[] = filteredIpmiPowerStatus.bind(this)(cells)

    this.setIpmiStatus(ipmiCells)
  }

  private setIpmiStatus = async (ipmiCells: IpmiCell[]) => {
    const ipmiCellsStatus: IpmiCell[] = await this.props.handleGetIpmiStatus(
      this.salt.url,
      this.salt.token,
      ipmiCells
    )

    ipmiPowerIndicator.bind(this)(ipmiCellsStatus)
  }

  private getIpmiTargetList = async () => {
    const minionList: string[] = await this.props.handleGetMinionKeyAcceptedList(
      this.salt.url,
      this.salt.token
    )

    if (minionList) {
      this.setState({minionList})
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

    this.graph.isCellSelectable = isCellSelectable.bind(this)

    this.graph.setConnectable(true)

    this.graph.dblClick = dblClick.bind(this)
    this.graph.getLabel = getLabel.bind(this)
    this.graph.isHtmlLabel = isHtmlLabel.bind(this)
    this.graph.convertValueToString = convertValueToString.bind(this)

    this.graph
      .getSelectionModel()
      .addListener(mxEvent.CHANGE, _.debounce(this.onChangedSelection, 600))

    this.graph.addListener(mxEvent.CLICK, onClickMxGraph.bind(this))

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
    outln.outline.labelsVisible = true
    outln.outline.setHtmlLabels(true)
  }

  private onChangedSelection = (
    mxGraphSelectionModel: mxGraphSelectionModeltype,
    _mxEventObject: mxEventObjectType
  ) => {
    const selectionCells = mxGraphSelectionModel['cells']

    if (selectionCells.length > 0) {
      const cellElement = getContainerElement(selectionCells[0].value)
      const dataNavi = cellElement.getAttribute('data-data_navi')

      if (dataNavi) {
        const {cloudAccessInfos} = this.state

        const instancename = cellElement.getAttribute('data-name')
        const navi = dataNavi.split('.')
        const provider = navi[0]
        const region = navi[2]
        const instanceid = navi[4]

        const accessInfo = _.find(
          cloudAccessInfos,
          c => c.provider === provider && c.region === region
        )

        if (!_.isEmpty(accessInfo)) {
          const {secretkey} = accessInfo
          const decryptedBytes = CryptoJS.AES.decrypt(
            secretkey,
            this.secretKey.url
          )
          const originalSecretkey = decryptedBytes.toString(CryptoJS.enc.Utf8)

          const newCloudAccessInfos = {
            ...accessInfo,
            secretkey: originalSecretkey,
          }

          const getData = _.filter(accessInfo.data, d =>
            _.isNull(d) ? false : d.InstanceId === instanceid
          )

          const securityGroupIds = _.reduce(
            getData[0].SecurityGroups,
            (groupIds: string[], current) => {
              groupIds = [...groupIds, current.GroupId]

              return groupIds
            },
            []
          )

          this.getAWSSecurity(newCloudAccessInfos, securityGroupIds)

          const volumeGroupIds = _.reduce(
            getData[0].BlockDeviceMappings,
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
          focusedInstance: {provider, region, instanceid, instancename},
          focusedHost: null,
          activeEditorTab: 'monitoring',
        })
      } else {
        const containerElement = getContainerElement(selectionCells[0].value)
        const title = getContainerTitle(containerElement).textContent

        this.setState({
          focusedInstance: null,
          focusedHost: title,
          activeEditorTab: 'monitoring',
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
      const awsSecurity = await this.props.handleGetAWSSecurityAsync(
        this.salt.url,
        this.salt.token,
        accessInfos,
        securityGroupIds
      )

      this.setState({awsSecurity})
    } catch (error) {
      this.setState({awsSecurity: null})
    }
  }

  private getAWSVolume = async (accessInfos: any, volumeGroupIds: string[]) => {
    try {
      const awsVolume = await this.props.handleGetAWSVolumeAsync(
        this.salt.url,
        this.salt.token,
        accessInfos,
        volumeGroupIds
      )

      this.setState({awsVolume})
    } catch (error) {
      this.setState({awsVolume: null})
    }
  }

  private getAWSInstanceTypes = async (accessInfos: any, types: string[]) => {
    const awsInstanceTypes = await this.props.handleGetAWSInstanceTypesAsync(
      this.salt.url,
      this.salt.token,
      accessInfos,
      types
    )

    this.setState({awsInstanceTypes})
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
      const decryptedBytes = CryptoJS.AES.decrypt(ipmiPass, this.secretKey.url)
      const originalPass = decryptedBytes.toString(CryptoJS.enc.Utf8)

      const ipmi: Ipmi = {
        target,
        host: ipmiHost,
        user: ipmiUser,
        pass: originalPass,
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
      const {isPinned} = this.state

      const decryptedBytes = CryptoJS.AES.decrypt(ipmiPass, this.secretKey.url)
      const originalPass = decryptedBytes.toString(CryptoJS.enc.Utf8)
      const pIpmi: Ipmi = {
        target,
        host: ipmiHost,
        user: ipmiUser,
        pass: originalPass,
      }

      const sensorData = await handleGetIpmiSensorDataAsync(
        this.salt.url,
        this.salt.token,
        pIpmi
      )

      this.setState({isStatusVisible: true})
      clearTimeout(this.timeout)
      this.timeout = null

      if (!isPinned) {
        this.timeout = setTimeout(() => {
          this.setState({isStatusVisible: false})
        }, 3000)
      }

      const currentCell = this.graph.getSelectionCell()

      if (cell && currentCell && cell.getId() === currentCell.getId()) {
        this.openSensorData(sensorData)
      }
    },
    500
  )

  private setActionInEditor = () => {
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

    this.editor.addAction('export', () => {
      const xmlString = this.xmlExport(this.graph.getModel())
      this.setState({
        topology: xmlString,
        isModalVisible: true,
        modalTitle: 'Export XML',
        modalMessage: this.ExportXMLMessage(),
      })
    })
  }

  // @ts-ignore
  private graphUpdate = () => {
    this.graph.getModel().beginUpdate()
    try {
    } finally {
      this.graph.getModel().endUpdate()
      this.graph.refresh()
      this.handleGraphModel(this.graph.getModel())
    }
  }

  private setCellsWarning = (hostList: string[]) => {
    if (!this.graph) return

    const graph = this.graph
    const parent = graph.getDefaultParent()
    const cells = this.getAllCells(parent, true)

    _.forEach(cells, cell => {
      if (cell.getStyle() === 'node') {
        const containerElement = getContainerElement(cell.value)
        const isTimeSeriesHost = getTimeSeriesHost(containerElement)
        const name = containerElement.getAttribute('data-name')

        if (isTimeSeriesHost) {
          graph.removeCellOverlays(cell)
          if (_.isEmpty(_.find(hostList, host => host === name))) {
            graph.setCellWarning(cell, 'Warning', warningImage)
          }
        }
      }
    })
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
        timeseries_host: true,
      }

      let ds = mxUtils.makeDraggable(
        host,
        this.graph,
        dragCell(node),
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
    const topology = this.xmlExport(sender)

    this.setState({topology})
  }

  private handleClose = () => {
    this.setState({isModalVisible: false})
  }

  private handleResize = (fieldName: string) => (proportions: number[]) => {
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
                <div id="graphContainer" ref={this.containerRef}>
                  {topologyStatus === RemoteDataState.Loading && (
                    <PageSpinner />
                  )}
                  <div id="outlineContainer" ref={this.outlineRef}></div>
                  <ResizableDock
                    className={classnames('', {
                      active: isStatusVisible,
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
                        color={
                          isPinned
                            ? ComponentColor.Primary
                            : ComponentColor.Default
                        }
                      ></Button>
                      <div className={'status-ref-wrap'}>
                        <FancyScrollbar autoHide={false}>
                          <div
                            id="statusContainerRef"
                            ref={this.statusRef}
                          ></div>
                        </FancyScrollbar>
                      </div>
                    </div>
                  </ResizableDock>
                </div>
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
      focusedHost,
      treeMenu,
      activeEditorTab,
      activeDetailsTab,
      selected,
    } = this.state
    return (
      <>
        <Page className="inventory-hosts-list-page">
          <Page.Header fullWidth={true}>
            <Page.Header.Left>
              {!_.isEmpty(focusedHost) || _.isEmpty(treeMenu) ? (
                <div className="radio-buttons radio-buttons--default radio-buttons--sm">
                  <Radio.Button
                    id="hostspage-tab-monitoring"
                    titleText="monitoring"
                    value="monitoring"
                    active={true}
                    onClick={this.onSetActiveEditorTab}
                  >
                    Monitoring
                  </Radio.Button>
                </div>
              ) : (
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
              )}
            </Page.Header.Left>
            <Page.Header.Right>
              {focusedHost === null && activeEditorTab === 'monitoring' ? (
                <>
                  <span>
                    Get from <span style={{margin: '0 3px'}}>:</span>
                  </span>
                  <Dropdown
                    items={['ALL', 'CloudWatch', 'Within instances']}
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
          <Page.Contents scrollable={false}>
            {activeEditorTab === 'details' ? (
              <>
                <div style={{marginBottom: '10px'}}>
                  <Radio shape={ButtonShape.Default} customClass={'auth-radio'}>
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
                  </Radio>
                </div>
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

  private getInstanceDetails = () => {
    const {cloudAccessInfos, focusedInstance} = this.state
    let instanceData = {}

    if (_.isEmpty(cloudAccessInfos) || _.isEmpty(focusedInstance)) {
      return instanceData
    }

    const accessInfo = _.find(
      cloudAccessInfos,
      c =>
        c.provider === focusedInstance.provider &&
        c.region === focusedInstance.region
    )

    const getData = _.filter(accessInfo.data, d =>
      _.isNull(d) ? false : d.InstanceId === focusedInstance.instanceid
    )

    _.reduce(
      getData,
      (_, current) => {
        const {
          InstanceId,
          NetworkInterfaces,
          PrivateIpAddress,
          State,
          PrivateDnsName,
          InstanceType,
          VpcId,
          SubnetId,
          Platform,
          ImageId,
          Monitoring,
          LaunchTime,
          AmiLaunchIndex,
          KeyName,
          Placement,
          VirtualizationType,
          CpuOptions,
          CapacityReservationSpecification,
        } = current

        const instance = {
          Instance_summary: {
            Instance_ID: this.detailsValueChecker(InstanceId),
            Public_IPv4_address: this.detailsValueChecker(
              NetworkInterfaces[0].Association?.PublicIp
            ),
            Private_IPv4_addresses: this.detailsValueChecker(PrivateIpAddress),
            IPv6_address: this.detailsValueChecker(
              NetworkInterfaces[0].Ipv6Addresses
            ),
            Instance_state: this.instanceState(
              this.detailsValueChecker(State.Name)
            ),
            Public_IPv4_DNS: this.detailsValueChecker(),
            Private_IPv4_DNS: this.detailsValueChecker(PrivateDnsName),
            Instance_type: this.detailsValueChecker(InstanceType),
            Elastic_IP_addresses: this.detailsValueChecker(),
            VPC_ID: this.detailsValueChecker(VpcId),
            AWS_Compute_Optimizer_finding: this.detailsValueChecker(),
            IAM_Role: this.detailsValueChecker(),
            Subnet_ID: this.detailsValueChecker(SubnetId),
          },
          Instance_details: {
            Platform: this.detailsValueChecker(Platform),
            AMI_ID: this.detailsValueChecker(ImageId),
            Monitoring: this.detailsValueChecker(Monitoring.State),
            Platform_details: this.detailsValueChecker(),
            AMI_name: this.detailsValueChecker(),
            Termination_protection: this.detailsValueChecker(),
            Launch_time: this.detailsValueChecker(LaunchTime.toString()),
            AMI_location: this.detailsValueChecker(),
            Lifecycle: this.detailsValueChecker(),
            'Stop-hibernate_behavior': this.detailsValueChecker(),
            AMI_Launch_index: this.detailsValueChecker(AmiLaunchIndex),
            Key_pair_name: this.detailsValueChecker(KeyName),
            State_transition_reason: this.detailsValueChecker(),
            Credit_specification: this.detailsValueChecker(),
            Kernel_ID: this.detailsValueChecker(),
            State_transition_message: this.detailsValueChecker(),
            Usage_operation: this.detailsValueChecker(),
            RAM_disk_ID: this.detailsValueChecker(),
            Owner: this.detailsValueChecker(NetworkInterfaces[0].OwnerId),
            Enclaves_Support: this.detailsValueChecker(),
            Boot_mode: this.detailsValueChecker(),
          },
          Host_and_placement_group: {
            Host_ID: this.detailsValueChecker(),
            Affinity: this.detailsValueChecker(),
            Placement_group: this.detailsValueChecker(),
            Host_resource_group_name: this.detailsValueChecker(),
            Tenancy: this.detailsValueChecker(Placement.Tenancy),
            Partition_number: this.detailsValueChecker(),
            Virtualization_type: this.detailsValueChecker(VirtualizationType),
            Reservation: this.detailsValueChecker(),
            Number_of_vCPUs: this.detailsValueChecker(
              CpuOptions.CoreCount * CpuOptions.ThreadsPerCore
            ),
          },
          Capacity_reservation: {
            Capacity_Reservation_ID: this.detailsValueChecker(),
            Capacity_Reservation_setting: this.detailsValueChecker(
              CapacityReservationSpecification.CapacityReservationPreference
            ),
          },
          Accelerators: {
            Elastic_inference_accelerator_ID: this.detailsValueChecker(),
          },
        }

        instanceData = {
          ...instance,
        }

        return false
      },
      {}
    )

    return instanceData
  }

  private getInstanceSecurity = () => {
    const {treeMenu, focusedInstance, awsSecurity} = this.state
    let instanceData = {}

    try {
      if (_.isNull(awsSecurity)) return

      const getAWSSecurity = _.values(_.values(awsSecurity)[0][0])[0][0]
      const rules = _.get(getAWSSecurity, 'rules', [])
      const rulesEgress = _.get(getAWSSecurity, 'rules_egress', [])
      const outboundRules = []
      const inboundRules = []

      _.forEach(rules, rule => {
        const {grants, from_port, ip_protocol} = rule
        const isAll = ip_protocol === '-1'
        _.forEach(grants, grant => {
          const {source_group_group_id, cidr_ip} = grant

          inboundRules.push({
            port: isAll ? 'All' : from_port,
            protocol: isAll ? 'All' : _.upperCase(ip_protocol),
            source: cidr_ip || source_group_group_id,
            security_groups: getAWSSecurity.name,
          })
        })
      })

      _.forEach(rulesEgress, rule => {
        const {grants, from_port, ip_protocol} = rule
        const isAll = ip_protocol === '-1'
        _.forEach(grants, grant => {
          const {cidr_ip} = grant

          outboundRules.push({
            port: isAll ? 'All' : from_port,
            protocol: isAll ? 'All' : _.upperCase(ip_protocol),
            destination: cidr_ip,
            security_groups: getAWSSecurity.name,
          })
        })
      })

      return {
        Security_details: {
          Owner_ID: getAWSSecurity.owner_id,
          Launch_Time: treeMenu[focusedInstance.provider]['nodes'][
            focusedInstance.region
          ]['nodes'][focusedInstance.instanceid].meta.LaunchTime.toString(),
          Security_groups: `${getAWSSecurity.id}(${getAWSSecurity.name})`,
        },
        Inbound_rules: {name: 'security', role: 'table', data: inboundRules},
        Outbound_rules: {name: 'security', role: 'table', data: outboundRules},
      }
    } catch (error) {
      return instanceData
    }
  }

  private getInstancStorage = () => {
    const {treeMenu, focusedInstance, awsVolume} = this.state
    let instanceData = {}

    try {
      if (_.isNull(awsVolume)) return

      const {provider, region, instanceid} = focusedInstance
      const getAWSVolume = _.values(_.values(_.values(awsVolume)[0])[0])[0]
      const blockDevices = []

      _.forEach(getAWSVolume, s => {
        if (!s || !s.Attachments) return

        _.forEach(s.Attachments, volume => {
          blockDevices.push({
            volumeId: volume.VolumeId,
            deviceName: volume.Device,
            volumeSize: s.Size,
            attachmentStatus: volume.State,
            attachmentTime: volume.AttachTime.toString(),
            encrypted: s.Encrypted.toString(),
            deleteOnTermination: volume.DeleteOnTermination.toString(),
          })
        })
      })

      return {
        Root_device_details: {
          Root_device_name:
            treeMenu[provider]['nodes'][region]['nodes'][instanceid].meta
              .RootDeviceName,
          Root_device_type:
            treeMenu[provider]['nodes'][region]['nodes'][instanceid].meta
              .RootDeviceType,
        },
        Block_devices: {
          name: 'storage',
          role: 'table',
          data: blockDevices,
        },
      }
    } catch (error) {
      return instanceData
    }
  }

  private getInstanceType = () => {
    const {awsInstanceTypes} = this.state

    try {
      if (_.isNull(awsInstanceTypes)) return
      let instanceTypes = {}

      const getAWSInstanceTypes = _.values(
        _.values(_.values(awsInstanceTypes)[0])[0]
      )[0]

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
            const accelators = {
              Accelerators: {
                GPUs: current.GpuInfo.Gpus.Count,
                'GPU_memory_(GiB)': current.GpuInfo.Gpus.MemoryInfo.SizeInMiB,
                GPU_manufacturer: current.GpuInfo.Gpus.Manufacturer,
                GPU_name: current.GpuInfo.Gpus.Name,
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

  private getInstanceData = () => {
    const {activeDetailsTab} = this.state

    if (activeDetailsTab === 'details') {
      return this.getInstanceDetails()
    }

    if (activeDetailsTab === 'security') {
      return this.getInstanceSecurity()
    }

    if (activeDetailsTab === 'storage') {
      return this.getInstancStorage()
    }
  }

  private instanceState = (instanceState = null) => {
    return (
      <div
        className={classnames(`status-tip`, {
          active: instanceState === 'running',
        })}
      >
        <div className={'status-tip-bg'}>
          <span className={'icon checkmark'}></span>
        </div>
        {instanceState}
      </div>
    )
  }

  private detailsValueChecker = (
    value: string | number | boolean = null
  ): string | number | boolean | '-' => {
    if (
      _.isUndefined(value) ||
      _.isNaN(value) ||
      _.isNull(value) ||
      _.isError(value) ||
      _.isArray(value)
    ) {
      value = '-'
    }
    return value
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

  private handleAddRegion = async () => {
    const {handleCreateCspAsync, handleGetAWSInstancesAsync} = this.props
    const {
      provider,
      cloudAccessKey,
      cloudSecretKey,
      cloudRegion,
      cloudTargetMinion,
      cloudAccessInfos,
    } = this.state

    const data = {
      provider,
      region: cloudRegion,
      accesskey: cloudAccessKey,
      secretkey: cloudSecretKey,
      minion: cloudTargetMinion,
    }

    const decryptedBytes = CryptoJS.AES.decrypt(
      cloudSecretKey,
      this.secretKey.url
    )

    const originalSecretkey = decryptedBytes.toString(CryptoJS.enc.Utf8)

    const newData = {
      ...data,
      secretkey: originalSecretkey,
    }

    try {
      this.setState({loadingState: RemoteDataState.Loading})
      const saltResp = await handleGetAWSInstancesAsync(
        this.salt.url,
        this.salt.token,
        [newData]
      )

      const checkSaltResp: string = saltResp.return[0][newData.minion]

      if (_.isString(checkSaltResp) && _.includes(checkSaltResp, 'exception')) {
        throw new Error('Failed to add region. exception error')
      }

      const dbResp = await handleCreateCspAsync(data)
      dbResp['data'] =
        _.values(saltResp.return[0])[0].length > 0
          ? _.values(saltResp.return[0])[0]
          : []

      const newCloudAccessInfos = [...cloudAccessInfos, dbResp]

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

  private removeRegion = async (
    provider: CloudServiceProvider,
    region: string
  ) => {
    const {treeMenu, cloudAccessInfos} = this.state
    const {handleDeleteCspAsync} = this.props
    const regionID = this.getRegionID(provider, region)
    const {isDelete} = await handleDeleteCspAsync(regionID)

    if (isDelete) {
      delete treeMenu[provider]['nodes'][region]

      const newCloudAccessInfos = _.filter(cloudAccessInfos, info => {
        let isNotSame = true
        if (info.provider === provider && info.region === region) {
          isNotSame = false
        }

        return isNotSame
      })

      this.setState({
        cloudAccessInfos: [...newCloudAccessInfos],
        treeMenu: {...treeMenu},
      })
    }
  }

  private openCspFormBtn = (properties: any) => {
    const {minionList} = this.state
    const {
      provider,
      region,
      accesskey,
      secretkey,
      isUpdateCloud,
      icon,
      text,
    } = properties

    return (
      <Button
        color={ComponentColor.Primary}
        onClick={() => {
          this.setState({
            provider,
            cloudTargetMinion: minionList[0],
            cloudRegion: region,
            cloudAccessKey: accesskey,
            cloudSecretKey: secretkey,
            isUpdateCloud: isUpdateCloud,
            isCloudFormVisible: true,
          })
        }}
        shape={isUpdateCloud ? ButtonShape.Square : ButtonShape.Default}
        size={ComponentSize.ExtraSmall}
        icon={icon}
        text={text}
      />
    )
  }

  private removeRegionBtn = ({
    provider,
    region,
  }: {
    provider: CloudServiceProvider
    region: string
  }) => {
    return (
      <div style={{marginLeft: '3px'}}>
        <ConfirmButton
          text="Delete"
          type="btn-danger"
          size="btn-xs"
          icon={'trash'}
          confirmAction={() => {
            this.removeRegion(provider, region)
          }}
          isEventStopPropagation={true}
          isButtonLeaveHide={true}
          isHideText={true}
          square={true}
        />
      </div>
    )
  }

  private getRegionID = (
    provider: CloudServiceProvider,
    region: string
  ): string => {
    const {treeMenu} = this.state
    const menus = _.keys(treeMenu)
    let regionID = ''

    if (provider && region) {
      for (let i = 0; i < menus.length; i++) {
        if (treeMenu[menus[i]].provider === provider) {
          regionID = treeMenu[menus[i]]['nodes'][region].regionID
          break
        }
      }
    }

    return regionID
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
                key={'Private'}
                color={
                  selectItem === 'Private'
                    ? ComponentColor.Primary
                    : ComponentColor.Default
                }
                text={'Private'}
                onClick={() => {
                  this.onChooseItem('Private')
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
          if (selectItem === 'Private') {
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
                  handleDeleteRegionBtn={this.removeRegionBtn}
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
    const {source, manualRefresh} = this.props
    const {
      filteredLayouts,
      focusedHost,
      focusedInstance,
      timeRange,
    } = this.state

    const layoutCells = getCells(filteredLayouts, source)
    const tempVars = generateForHosts(source)

    return (
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
    )
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

  private async fetchInstancesAndMeasurements(
    layouts: Layout[],
    pInstance: Instance
  ) {
    const {source} = this.props
    const {selected} = this.state

    const fetchMeasurements = getMeasurementsForInstance(
      source,
      pInstance,
      selected
    )
    const fetchInstances = getAppsForInstance(
      source.links.proxy,
      pInstance,
      layouts,
      source.telegraf,
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

  private handleChangeInput = (inputKey: string) => (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const input = {[inputKey]: e.target.value}
    this.setState({...this.state, ...input})
  }

  private makeTreemenu = () => {
    const {treeMenu, cloudAccessInfos} = this.state

    if (_.isEmpty(treeMenu)) return

    const cloudDataTree = {...treeMenu}

    _.forEach(cloudAccessInfos, cloudRegion => {
      cloudDataTree[cloudRegion.provider]['nodes'][cloudRegion.region] = {
        ...cloudDataTree[cloudRegion.provider]['nodes'][cloudRegion.region],
        buttons: [
          {
            id: cloudRegion.id,
            provider: cloudRegion.provider,
            region: cloudRegion.region,
            accesskey: cloudRegion.accesskey,
            secretkey: cloudRegion.secretkey,
            isUpdateCloud: true,
            isDeleteCloud: false,
            text: 'Save Region',
            icon: 'pencil',
          },
          {
            id: cloudRegion.id,
            provider: cloudRegion.provider,
            region: cloudRegion.region,
            isUpdateCloud: false,
            isDeleteCloud: true,
            text: 'Update Region',
          },
        ],
        label: cloudRegion.region,
        index: _.values(cloudDataTree[cloudRegion.provider]['nodes']).length,
        level: 1,
        regionID: cloudRegion.id,
        nodes: {},
      }

      _.forEach(cloudRegion.data, instanceData => {
        if (!instanceData || typeof instanceData !== 'object') return
        cloudDataTree[cloudRegion.provider]['nodes'][cloudRegion.region][
          'nodes'
        ][_.get(instanceData, 'InstanceId')] = {
          ...cloudDataTree[cloudRegion.provider]['nodes'][cloudRegion.region][
            'nodes'
          ][_.get(instanceData, 'InstanceId')],
          instanceid: _.get(instanceData, 'InstanceId'),
          label: _.get(instanceData, 'Tags')[0]['Value'],
          index: _.values(
            cloudDataTree[cloudRegion.provider]['nodes'][cloudRegion.region][
              'nodes'
            ]
          ).length,
          provider: cloudRegion.provider,
          region: cloudRegion.region,
          level: 2,
          meta: instanceData,
          nodes: {},
        }
      })
    })

    this.setState({treeMenu: cloudDataTree})
  }

  private handleChooseTargetMinion = (selectItem: {text: string}) => {
    this.setState({
      cloudTargetMinion: selectItem.text,
    })
  }

  private encrypt = () => {
    const {cloudSecretKey} = this.state

    if (cloudSecretKey.length < 1) return

    const encryptCloudSecretKey = CryptoJS.AES.encrypt(
      cloudSecretKey,
      this.secretKey.url
    ).toString()

    this.setState({cloudSecretKey: encryptCloudSecretKey})
  }

  private onKeyPressEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const enterKeyCode = 13
    const enterKey = 'Enter'

    if (
      e.keyCode === enterKeyCode ||
      e.charCode === enterKeyCode ||
      e.key === enterKey
    ) {
      this.encrypt()
    }
  }

  private get writeCloudForm() {
    const {
      minionList,
      isCloudFormVisible,
      isUpdateCloud,
      cloudRegion,
      cloudTargetMinion,
      cloudAccessKey,
      cloudSecretKey,
    } = this.state

    return (
      <OverlayTechnology visible={isCloudFormVisible}>
        <OverlayContainer>
          <div style={{position: 'relative'}}>
            {this.loadingState}
            <OverlayHeading
              title={isUpdateCloud ? 'UPDATE REGION' : 'ADD REGION'}
              onDismiss={this.closeCloudForm}
            />
            <OverlayBody>
              <Form>
                <Form.Element label="Target Minion" colsXS={12}>
                  <Dropdown
                    items={['NONE', ...minionList]}
                    selected={
                      cloudTargetMinion !== '' ? cloudTargetMinion : 'NONE'
                    }
                    onChoose={this.handleChooseTargetMinion}
                    className="dropdown-stretch"
                  />
                </Form.Element>
                <Form.Element label="Region" colsXS={12}>
                  <Input
                    value={cloudRegion}
                    onChange={this.handleChangeInput('cloudRegion')}
                    placeholder={'Region'}
                    type={InputType.Text}
                    status={isUpdateCloud && ComponentStatus.Disabled}
                  />
                </Form.Element>
                <Form.Element label="Access Key" colsXS={12}>
                  <Input
                    value={cloudAccessKey}
                    onChange={this.handleChangeInput('cloudAccessKey')}
                    placeholder={'Access Key'}
                    type={InputType.Password}
                  />
                </Form.Element>
                <Form.Element label="Secret Key" colsXS={12}>
                  <Input
                    value={cloudSecretKey}
                    onChange={this.handleChangeInput('cloudSecretKey')}
                    onFocus={() => {
                      this.setState({cloudSecretKey: ''})
                    }}
                    onBlur={this.encrypt}
                    onKeyDown={this.onKeyPressEnter}
                    placeholder={'Secret Key'}
                    type={InputType.Password}
                  />
                </Form.Element>
                <Form.Footer>
                  <Button
                    color={ComponentColor.Default}
                    onClick={this.closeCloudForm}
                    size={ComponentSize.Medium}
                    text={'Cancel'}
                  />
                  <Button
                    color={ComponentColor.Primary}
                    onClick={() => {
                      isUpdateCloud
                        ? this.handleUpdateRegion()
                        : this.handleAddRegion()
                    }}
                    size={ComponentSize.Medium}
                    text={isUpdateCloud ? 'Update Region' : 'Save Region'}
                  />
                </Form.Footer>
              </Form>
            </OverlayBody>
          </div>
        </OverlayContainer>
      </OverlayTechnology>
    )
  }

  private handleLoadCsps = async () => {
    const {handleLoadCspsAsync, handleGetAWSInstancesAsync} = this.props
    const dbResp: any[] = await handleLoadCspsAsync()
    const newDbResp = _.map(dbResp, resp => {
      const {secretkey} = resp
      const decryptedBytes = CryptoJS.AES.decrypt(secretkey, this.secretKey.url)
      const originalSecretkey = decryptedBytes.toString(CryptoJS.enc.Utf8)

      resp = {
        ...resp,
        secretkey: originalSecretkey,
      }

      return resp
    })

    const saltResp = await handleGetAWSInstancesAsync(
      this.salt.url,
      this.salt.token,
      newDbResp
    )

    _.forEach(dbResp, (dResp, index) => {
      if (_.isUndefined(saltResp)) return

      dResp['data'] =
        _.values(saltResp.return[index])[0].length > 0
          ? _.values(saltResp.return[index])[0]
          : []
    })

    this.setState({cloudAccessInfos: [...dbResp]})
  }

  private handleUpdateRegion = async () => {
    const {handleUpdateCspAsync, handleGetAWSInstancesAsync} = this.props
    const {
      cloudTargetMinion,
      cloudRegion,
      cloudAccessKey,
      cloudSecretKey,
      provider,
      cloudAccessInfos,
    } = this.state

    let regionID = this.getRegionID(provider, cloudRegion)

    const data: paramsUpdateCSP = {
      id: regionID,
      minion: cloudTargetMinion,
      region: cloudRegion,
      accesskey: cloudAccessKey,
      secretkey: cloudSecretKey,
    }

    const {secretkey} = data
    const decryptedBytes = CryptoJS.AES.decrypt(secretkey, this.secretKey.url)
    const originalSecretkey = decryptedBytes.toString(CryptoJS.enc.Utf8)

    const newData = {
      ...data,
      secretkey: originalSecretkey,
    }

    try {
      this.setState({loadingState: RemoteDataState.Loading})

      const saltResp = await handleGetAWSInstancesAsync(
        this.salt.url,
        this.salt.token,
        [newData]
      )

      const dbResp = await handleUpdateCspAsync(data)

      const newCloudAccessInfos = _.map(cloudAccessInfos, c => {
        if (c.id === dbResp.id) {
          c = {
            ...dbResp,
            data:
              _.values(saltResp.return[0])[0].length > 0
                ? _.values(saltResp.return[0])[0]
                : [],
          }
        }
        return c
      })

      this.setState({cloudAccessInfos: [...newCloudAccessInfos]})
    } catch (error) {
      console.error(error)
    } finally {
      this.setState({loadingState: RemoteDataState.Done})
      this.closeCloudForm()
    }
  }
}

const mapStateToProps = ({links}) => {
  return {
    links,
  }
}

const mapDispatchToProps = {
  handleGetInventoryTopology: loadInventoryTopologyAsync,
  handleCreateInventoryTopology: createInventoryTopologyAsync,
  handleUpdateInventoryTopology: updateInventoryTopologyAsync,
  handleGetMinionKeyAcceptedList: getMinionKeyAcceptedListAsync,
  handleGetIpmiStatus: getIpmiStatusAsync,
  handleSetIpmiStatusAsync: setIpmiStatusAsync,
  handleGetIpmiSensorDataAsync: getIpmiSensorDataAsync,
  // handleCreateCloudServiceProviderAsync: createCloudServiceProviderAsync,
  notify: notifyAction,
  handleLoadCspAsync: loadCloudServiceProviderAsync,
  handleLoadCspsAsync: loadCloudServiceProvidersAsync,
  handleCreateCspAsync: createCloudServiceProviderAsync,
  handleUpdateCspAsync: updateCloudServiceProviderAsync,
  handleDeleteCspAsync: deleteCloudServiceProviderAsync,
  handleGetAWSInstancesAsync: getAWSInstancesAsync,
  handleGetAWSSecurityAsync: getAWSSecurityAsync,
  handleGetAWSVolumeAsync: getAWSVolumeAsync,
  handleGetAWSInstanceTypesAsync: getAWSInstanceTypesAsync,
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null
)(InventoryTopology)
