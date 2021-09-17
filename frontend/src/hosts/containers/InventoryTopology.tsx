import React, {createRef, PureComponent, ChangeEvent} from 'react'
import {Controlled as ReactCodeMirror} from 'react-codemirror2'
import {connect} from 'react-redux'
import _ from 'lodash'
import {getDeep} from 'src/utils/wrappers'
import CryptoJS from 'crypto-js'
import classnames from 'classnames'
import yaml from 'js-yaml'

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
  createCloudServiceProviderAsync,
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

// import {AWSInstanceData, CSPAccessObject} from 'src/hosts/types/cloud'
// import {saltDetailsDummy} from './detailsTest'
// import {treeMenuDummy} from './treeMenuDummy'

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
  handleLoadCloudServiceProviderAsync: (id: string) => Promise<any>
  handleLoadCloudServiceProvidersAsync: () => Promise<any>
  handleCreateCloudServiceProviderAsync: (data: {
    provider: CloudServiceProvider
    region: string
    accesskey: string
    secretkey: string
  }) => Promise<any>
  handleUpdateCloudServiceProviderAsync: (data: {
    provider: CloudServiceProvider
    region: string
    accesskey: string
    secretkey: string
    id: string
  }) => Promise<any>
  handleDeleteCloudServiceProviderAsync: (id: string) => Promise<any>
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
  selected: string
  appHostData: {}
  isCloudFormVisible: boolean
  isUpdateCloud: boolean
  cloudRegions: string[]
  selectedCloudRegion: string
  cloudAccessKey: string
  cloudSecretKey: string
  provider: CloudServiceProvider
  providerLabel: string
  treeMenu: any
  focusedInstance: Instance
}

const cloudInfo = [
  {
    provider: 'aws',
    region: 'ap-northeast-2',
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
]

const cloudData = {
  aws: {
    label: 'Amazon Web Service',
    index: 0,
    level: 0,
    provider: CloudServiceProvider.AWS,
    nodes: {},
  },
}

const awsSeoulDummy = require('./aws.yaml')
const awsPusanDummy = require('./aws.yaml')

@ErrorHandling
class InventoryTopology extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.setState = (args, callback) => {
      if (!this.isComponentMounted) return

      PureComponent.prototype.setState.bind(this)(args, callback)
    }

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
      selectItem: 'Cloud',
      layouts: [],
      filteredLayouts: [],
      focusedHost: '',
      timeRange: timeRanges.find(tr => tr.lower === 'now() - 1h'),
      activeEditorTab: 'details',
      selected: 'ALL',
      appHostData: {},
      isCloudFormVisible: false,
      isUpdateCloud: false,
      cloudRegions: [],
      selectedCloudRegion: '',
      cloudAccessKey: '',
      cloudSecretKey: '',
      provider: null,
      providerLabel: '',
      treeMenu: {},
      focusedInstance: null,
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
    this.makeTreemenu()
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

        if (!layouts) {
          // notify(notifyUnableToGetApps())
          this.setState({
            // hostsPageStatus: RemoteDataState.Error,
            layouts,
          })
          return
        }

        // For rendering whole hosts list
        await this.getHostData()

        const {autoRefresh} = this.props
        if (autoRefresh) {
          this.intervalID = window.setInterval(
            () => this.getHostData(),
            autoRefresh
          )
        }
        GlobalAutoRefresher.poll(autoRefresh)

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

  private getFirstHost = (hostsObject: {[x: string]: Host}): string => {
    const hostsArray = _.values(hostsObject)
    return hostsArray.length > 0 ? hostsArray[0].name : null
  }

  public async componentDidUpdate(prevProps: Props, prevState: State) {
    const {
      layouts,
      focusedHost,
      isPinned,
      focusedInstance,
      selected,
    } = this.state

    if (layouts) {
      if (
        (prevState.focusedHost !== focusedHost && focusedHost) ||
        (prevState.selected !== selected && focusedHost)
      ) {
        console.log('getLayoutsforHost')
        this.getHostData()
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
        console.log('getLayoutsforInstance')
        const {filteredLayouts} = await this.getLayoutsforInstance(
          layouts,
          focusedInstance
        )
        this.setState({filteredLayouts})
      }
    }

    if (
      prevState.selectItem !== this.state.selectItem &&
      this.state.selectItem === 'Private'
    ) {
      this.changedDOM()
    }

    if (
      JSON.stringify(_.keys(prevState.hostsObject)) !==
        JSON.stringify(_.keys(this.state.hostsObject)) &&
      prevState.hostsObject !== null
    ) {
      this.setCellsWarning(_.keys(this.state.hostsObject))
      this.changedDOM()
    }

    if (_.isEmpty(this.state.topologyId) && !_.isEmpty(this.state.topology)) {
      const response = await this.props.handleCreateInventoryTopology(
        this.props.links,
        this.state.topology
      )

      if (_.get(response, 'data.id')) {
        this.setState({topologyId: _.get(response, 'data.id')})
      }
    } else if (
      !_.isEmpty(this.state.topologyId) &&
      !_.isEmpty(prevState.topology) &&
      prevState.topology !== this.state.topology
    ) {
      await this.props.handleUpdateInventoryTopology(
        this.props.links,
        this.state.topologyId,
        this.state.topology
      )
    }

    if (prevProps.autoRefresh !== this.props.autoRefresh) {
      clearInterval(this.intervalID)
      GlobalAutoRefresher.poll(this.props.autoRefresh)

      if (this.props.autoRefresh) {
        this.intervalID = window.setInterval(() => {
          this.fetchIntervalData()
        }, this.props.autoRefresh)
      }
    }

    if (prevProps.manualRefresh !== this.props.manualRefresh) {
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
    const {isModalVisible, modalMessage, modalTitle} = this.state
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
          </>
        )}
      </div>
    )
  }

  // private toggleCloudFormVisible = (): void => {
  //   this.setState({isCloudFormVisible: !this.state.isCloudFormVisible})
  // }

  private openCloudForm = (provider: CloudServiceProvider) => {
    let cloudRegions = []

    if (provider === CloudServiceProvider.AWS) {
      cloudRegions = [...cloudRegions, 'SEOUL', 'SYDNEY']
    }

    if (provider === CloudServiceProvider.GCP) {
      cloudRegions = [...cloudRegions, 'SEOUL', 'TOKYO', 'OSAKA', 'TAIWAN']
    }

    if (provider === CloudServiceProvider.AZURE) {
      cloudRegions = [
        ...cloudRegions,
        'SEOUL',
        'BUSAN',
        'TOKYO',
        'SAITAMA',
        'OSAKA',
      ]
    }

    this.setState({
      provider,
      isCloudFormVisible: true,
      cloudRegions,
      selectedCloudRegion: cloudRegions[0],
    })
  }

  private closeCloudForm = () => {
    this.setState({
      isCloudFormVisible: false,
      isUpdateCloud: false,
      cloudRegions: [],
      selectedCloudRegion: '',
      cloudAccessKey: '',
      cloudSecretKey: '',
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
          value={this.state.topology}
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
    await this.getIpmiTargetList()
  }

  private getHostData = async () => {
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

    console.log('hostsObject', hostsObject)

    const hostsError = notifyUnableToGetHosts().message
    if (!hostsObject) {
      console.log('notifyUnableToGetHosts')
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

    this.setState({minionList})
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
    // this.graph.setTooltips(false)
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
        // if (bounds != null) {
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
      .addListener(mxEvent.CHANGE, this.onChangedSelection)

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

    console.log('cell click', selectionCells)

    if (selectionCells.length > 0) {
      const cellElement = getParseHTML(selectionCells[0].value)
      const dataNavi = cellElement
        .querySelector('div')
        .getAttribute('data-data_navi')

      if (dataNavi) {
        console.log('meta', _.get(this.state.treeMenu, `${dataNavi}.meta`))

        const instanceData = _.get(this.state.treeMenu, `${dataNavi}`)
        const provider = _.get(instanceData, 'provider')
        const region = _.get(instanceData, 'region')
        const instanceid = _.get(instanceData, 'instanceid')
        const instancename = _.get(instanceData, 'label')
        this.setState({
          focusedInstance: {provider, region, instanceid, instancename},
          focusedHost: null,
          activeEditorTab: 'details',
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
      const decryptedBytes = CryptoJS.AES.decrypt(ipmiPass, this.secretKey.url)
      const originalPass = decryptedBytes.toString(CryptoJS.enc.Utf8)
      const pIpmi: Ipmi = {
        target,
        host: ipmiHost,
        user: ipmiUser,
        pass: originalPass,
      }

      handleGetIpmiSensorDataAsync(this.salt.url, this.salt.token, pIpmi).then(
        (sensorData: any) => {
          const {isPinned} = this.state

          this.setState({isStatusVisible: true})

          // timeout 초기화
          clearTimeout(this.timeout)
          this.timeout = null

          //
          if (!isPinned) {
            this.timeout = setTimeout(() => {
              this.setState({isStatusVisible: false})
            }, 3000)
          }

          // console.log('sensorData: ', sensorData)
        }
      )

      const currentCell = this.graph.getSelectionCell()

      // if (cell && currentCell && cell.getId() === currentCell.getId()) {
      //   this.openSensorData(sensorData)
      // }
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
    const {bottomProportions} = this.state
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
                  {this.state.topologyStatus === RemoteDataState.Loading && (
                    <PageSpinner />
                  )}
                  <div id="outlineContainer" ref={this.outlineRef}></div>
                  <ResizableDock
                    className={classnames('', {
                      active: this.state.isStatusVisible,
                    })}
                    height={this.state.resizableDockHeight}
                    width={this.state.resizableDockWidth}
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
                          this.state.isPinned
                            ? ComponentColor.Primary
                            : ComponentColor.Default
                        }
                        // text="pin"
                      ></Button>
                      <FancyScrollbar autoHide={false}>
                        <div id="statusContainerRef" ref={this.statusRef}></div>
                      </FancyScrollbar>
                    </div>
                  </ResizableDock>
                </div>
              </div>
            </>
          )
          // return this.topThreeSizer()
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

  private detailsGraph = () => {
    return (
      <>
        <Page className="inventory-hosts-list-page">
          <Page.Header fullWidth={true}>
            <Page.Header.Left>
              {!_.isEmpty(this.state.focusedHost) ? (
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
                      id="hostspage-tab-details"
                      titleText="details"
                      value="details"
                      active={this.state.activeEditorTab === 'details'}
                      onClick={this.onSetActiveEditorTab}
                    >
                      Details
                    </Radio.Button>
                    <Radio.Button
                      id="hostspage-tab-monitoring"
                      titleText="monitoring"
                      value="monitoring"
                      active={this.state.activeEditorTab === 'monitoring'}
                      onClick={this.onSetActiveEditorTab}
                    >
                      Monitoring
                    </Radio.Button>
                  </div>
                  <span>Get from :</span>
                  <Dropdown
                    items={['ALL', 'CloudWatch', 'Within instances']}
                    onChoose={this.getHandleOnChoose}
                    selected={this.state.selected}
                    className="dropdown-sm"
                    disabled={false}
                    // onClick={() => {
                    //   this.handleFocusedBtnName({selected: this.state.selected})
                    // }}
                  />
                </>
              )}
            </Page.Header.Left>
            <Page.Header.Right></Page.Header.Right>
          </Page.Header>
          <Page.Contents scrollable={true}>
            {this.state.activeEditorTab === 'details' ? (
              <TopologyDetails selectInstanceData={} />
            ) : null}
            {this.state.activeEditorTab === 'monitoring'
              ? this.renderGraph()
              : null}
          </Page.Contents>
        </Page>
      </>
    )
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

  private handleAddRegion = () => {
    const {handleCreateCloudServiceProviderAsync} = this.props
    const {
      provider,
      selectedCloudRegion,
      cloudAccessKey,
      cloudSecretKey,
      treeMenu,
    } = this.state

    const decryptedBytes = CryptoJS.AES.decrypt(
      cloudSecretKey,
      this.secretKey.url
    )
    const originalSecretkey = decryptedBytes.toString(CryptoJS.enc.Utf8)

    const data = {
      provider,
      region: selectedCloudRegion,
      accesskey: cloudAccessKey,
      secretkey: originalSecretkey,
    }

    handleCreateCloudServiceProviderAsync(data).then(res => {
      _.values(treeMenu).forEach(tm => {
        if (tm.provider === res.provider) {
          tm.nodes[res.region] = {
            buttons: [
              this.updateRegionBtn(res.provider, res.region),
              this.removeRegionBtn(res.provider, res.region),
            ],
            index: 0,
            label: res.region,
            level: 1,
            regionID: res.id,
            nodes: {},
          }
        }
      })

      this.setState({treeMenu})
      this.closeCloudForm()
    })
  }

  private addRegionBtn = (provider: CloudServiceProvider) => () => {
    return (
      <Button
        color={ComponentColor.Primary}
        onClick={event => {
          event.stopPropagation()
          this.openCloudForm(provider)
        }}
        size={ComponentSize.ExtraSmall}
        text={'+ Add Region'}
        shape={ButtonShape.Default}
      />
    )
  }

  private handleUpdateRegion = () => {
    // 가정 Salt 보낸 후 etcd 에 저장할 건지 말건지
    // const {handleUpdateCloudServiceProviderAsync} = this.props
    const {
      selectedCloudRegion,
      cloudAccessKey,
      cloudSecretKey,
      provider,
    } = this.state

    let regionID = this.getRegionID(provider, selectedCloudRegion)

    // secretkey 복호화 후
    const data = {
      provider,
      id: regionID,
      region: selectedCloudRegion,
      accesskey: cloudAccessKey,
      secretkey: cloudSecretKey,
    }

    // handleUpdateCloudServiceProviderAsync(data)
    //   .then(resp => {
    //     console.log('resp:', resp)
    //   })
    //   .finally(() => {
    //     this.closeCloudForm()
    //     // // secretkey 암호화 후 저장
    //   })
  }

  private openUpdateRegion = async (
    provider: CloudServiceProvider,
    region: string
  ) => {
    // const {handleLoadCloudServiceProviderAsync} = this.props

    let regionID = this.getRegionID(provider, region)

    // handleLoadCloudServiceProviderAsync(regionID).then(data => {
    //   console.log('getCSP: ', data)
    //   this.setState({
    //     isUpdateCloud: true,
    //     selectedCloudRegion: region,
    //     cloudAccessKey: 'test',
    //     cloudSecretKey: 'test',
    //   })
    // })
  }

  private updateRegionBtn = (
    provider: CloudServiceProvider,
    region: string
  ) => () => {
    return (
      <Button
        color={ComponentColor.Primary}
        onClick={event => {
          event.stopPropagation()
          this.openCloudForm(provider)
          this.openUpdateRegion(provider, region)
        }}
        size={ComponentSize.ExtraSmall}
        icon={IconFont.Pencil}
        shape={ButtonShape.Square}
      />
    )
  }

  private removeRegion = (provider: CloudServiceProvider, region: string) => {
    const {treeMenu} = this.state
    const regionID = this.getRegionID(provider, region)

    this.props.handleDeleteCloudServiceProviderAsync(regionID).then(() => {
      const menus = _.keys(treeMenu)

      for (let i = 0; i < menus.length; i++) {
        if (treeMenu[menus[i]].provider === provider) {
          delete treeMenu[menus[i]]['nodes'][region]
          break
        }
      }

      this.setState({treeMenu: {...treeMenu}})
    })
  }

  private removeRegionBtn = (
    provider: CloudServiceProvider,
    region: string
  ) => () => {
    return (
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
    const {sidebarProportions} = this.state
    const [topSize, middleSize, bottomSize] = sidebarProportions

    return [
      {
        name: 'Detected Hosts',
        headerOrientation: HANDLE_HORIZONTAL,
        headerButtons: [
          <Button
            key={'Private'}
            color={
              this.state.selectItem === 'Private'
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
              this.state.selectItem === 'Cloud'
                ? ComponentColor.Primary
                : ComponentColor.Default
            }
            text={'Cloud'}
            onClick={() => {
              this.onChooseItem('Cloud')
            }}
            size={ComponentSize.ExtraSmall}
          />,
        ],
        menuOptions: [],
        size: topSize,
        render: () => {
          if (this.state.selectItem === 'Private') {
            const hostList = _.keys(this.state.hostsObject)
            if (hostList.length > 0) {
              return (
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
              )
            } else {
              return <NoState message={'There is no host'} />
            }
          }

          if (this.state.selectItem === 'Cloud') {
            return (
              <FancyScrollbar>
                <InventoryTreemenu
                  data={this.state.treeMenu}
                  graph={this.graph}
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
    const {source} = this.props
    const {
      filteredLayouts,
      focusedHost,
      focusedInstance,
      timeRange,
    } = this.state

    const layoutCells = getCells(filteredLayouts, source)
    const tempVars = generateForHosts(source)

    return (
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
          manualRefresh={this.props.manualRefresh}
          host={focusedHost}
          instance={focusedInstance}
        />
      </Page.Contents>
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
    // action start
    const arrayCloudData = [awsSeoulDummy, awsPusanDummy]

    _.map(arrayCloudData, (cloudData, index) => {
      cloudInfo[index].data = cloudData
    })
    // action end

    const cloudDataTree = {...cloudData}

    _.map(cloudInfo, cloudRegion => {
      cloudDataTree[cloudRegion.provider]['nodes'][cloudRegion.region] = {
        ...cloudDataTree[cloudRegion.provider]['nodes'][cloudRegion.region],
        label: cloudRegion.region,
        index: _.values(cloudDataTree[cloudRegion.provider]['nodes']).length,
        level: 1,
        nodes: {},
      }

      _.map(_.get(cloudRegion.data, 'local'), instanceData => {
        // cloudData[cloudRegion.provider]['nodes'][cloudRegion.region]['nodes']['label']

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

    const treeMenu = {...cloudDataTree}

    _.reduce(
      _.keys(cloudDataTree),
      (_, currentCSP: CloudServiceProvider) => {
        let nodes = {}

        Object.keys(treeMenu[currentCSP]['nodes']).reduce((_, region) => {
          treeMenu[currentCSP]['nodes'][region] = {
            ...treeMenu[currentCSP]['nodes'][region],
            buttons: [
              this.updateRegionBtn(treeMenu[currentCSP]['provider'], region),
              this.removeRegionBtn(treeMenu[currentCSP]['provider'], region),
            ],
          }

          nodes[region] = {
            ...treeMenu[currentCSP]['nodes'][region],
          }

          return false
        }, {})

        treeMenu[currentCSP] = {
          ...treeMenu[currentCSP],
          buttons: [this.addRegionBtn(treeMenu[currentCSP]['provider'])],
          nodes: {
            ...nodes,
          },
        }
        return false
      },
      {}
    )

    this.setState({treeMenu})
  }

  private handleChooseRegion = (selectItem: {text: string}) => {
    this.setState({
      selectedCloudRegion: selectItem.text,
      cloudAccessKey: '',
      cloudSecretKey: '',
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
      providerLabel,
      isCloudFormVisible,
      isUpdateCloud,
      cloudRegions,
      selectedCloudRegion,
      cloudAccessKey,
      cloudSecretKey,
    } = this.state

    return (
      <OverlayTechnology visible={isCloudFormVisible}>
        <OverlayContainer>
          <OverlayHeading
            title={providerLabel}
            onDismiss={this.closeCloudForm}
          />
          <OverlayBody>
            <Form>
              <Form.Element label="Region" colsXS={12}>
                <Dropdown
                  items={cloudRegions}
                  selected={selectedCloudRegion}
                  onChoose={isUpdateCloud ? null : this.handleChooseRegion}
                  disabled={isUpdateCloud}
                  className="dropdown-stretch"
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
        </OverlayContainer>
      </OverlayTechnology>
    )
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
  handleCreateCloudServiceProviderAsync: createCloudServiceProviderAsync,
  notify: notifyAction,
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null
)(InventoryTopology)
