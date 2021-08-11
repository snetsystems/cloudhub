import React, {createRef, PureComponent} from 'react'
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
import {ComponentStatus} from 'src/reusable_ui/types'
import {IpmiSetPowerStatus} from 'src/shared/apis/saltStack'

// Actions
import {
  loadInventoryTopologyAsync,
  createInventoryTopologyAsync,
  updateInventoryTopologyAsync,
  getIpmiStatusAsync,
  setIpmiStatusAsync,
  getIpmiSensorDataAsync,
  getMinionKeyAcceptedListAsync,
} from 'src/hosts/actions'

import {notify as notifyAction} from 'src/shared/actions/notifications'

// APIs
import {getEnv} from 'src/shared/apis/env'
// APIs
import {
  getCpuAndLoadForHosts,
  getLayouts,
  getAppsForHosts,
  getAppsForHost,
  getMeasurementsForHost,
} from 'src/hosts/apis'

// Utils
import {generateForHosts} from 'src/utils/tempVars'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {
  getContainerElement,
  getContainerTitle,
  getIsDisableAttr,
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
} from 'src/hosts/configurations/topology'
import InventoryTreemenu from '../components/InventoryTreemenu'

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

const warningImage = new mxImage(
  require('mxgraph/javascript/src/images/warning.png'),
  16,
  16
)

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
}

interface State {
  screenProportions: number[]
  sidebarProportions: number[]
  bottomProportions: number[]
  topSideProportions: number[]
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
}

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
      screenProportions: [0.15, 0.85],
      sidebarProportions: [0.333, 0.333, 0.333],
      bottomProportions: [0.54, 0.46],
      topSideProportions: [0.7, 0.3],
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
      resizableDockHeight: 200,
      resizableDockWidth: 200,
      selectItem: 'total',
      layouts: [],
      filteredLayouts: [],
      focusedHost: '',
      timeRange: timeRanges.find(tr => tr.lower === 'now() - 1h'),
      activeEditorTab: 'details',
      selected: 'CloudWatch',
      appHostData: {},
    }
  }

  public intervalID: number
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

      this.setState({
        hostsObject: newHosts,
      })
    } catch (error) {
      console.error(error)
    }
  }

  public async componentDidMount() {
    this.createEditor()
    this.configureEditor()
    this.setActionInEditor()
    this.configureStylesheet(mx)

    this.addToolsButton(this.tools)
    this.setToolbar(this.editor, this.toolbar)

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
    await this.fetchHostsData(layouts)

    // For rendering the charts with the focused single host.
    const hostID =
      this.state.focusedHost || this.getFirstHost(this.state.hostsObject)

    const {autoRefresh} = this.props
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
    })

    const topology = await this.props.handleGetInventoryTopology(
      this.props.links
    )

    this.setState(
      {
        topology: _.get(topology, 'diagram'),
        topologyId: _.get(topology, 'id'),
      },
      async () => {
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
    const {layouts, focusedHost} = this.state

    if (layouts) {
      if (prevState.focusedHost !== focusedHost) {
        this.fetchHostsData(layouts)
        const {filteredLayouts} = await this.getLayoutsforHost(
          layouts,
          focusedHost
        )
        // console.log({filteredLayouts, layouts, focusedHost})
        this.setState({filteredLayouts})
      }

      // if (prevProps.autoRefresh !== autoRefresh) {
      //   GlobalAutoRefresher.poll(autoRefresh)
      // }
    }

    if (
      prevState.selectItem !== this.state.selectItem &&
      this.state.selectItem === 'total'
    ) {
      this.changedDOM()
    }

    if (
      JSON.stringify(_.keys(prevState.hostsObject)) !==
      JSON.stringify(_.keys(this.state.hostsObject))
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
    this.graph.setTooltips(false)
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
      const group = mxGraph.prototype.createGroupCell.apply(this.graph, cells)

      const groupObj = {
        ...tmpMenu,
        name: 'Group',
        label: 'Group',
        type: 'Group',
      }

      const groupCell = createHTMLValue(groupObj, 'group')
      group.setValue(groupCell.outerHTML)
      group.setVertex(true)
      group.setConnectable(true)

      group.setStyle('group')

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

    if (selectionCells.length > 0) {
      const containerElement = getContainerElement(selectionCells[0].value)
      const title = getContainerTitle(containerElement).textContent

      this.setState({focusedHost: title})
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
      const decryptedBytes = CryptoJS.AES.decrypt(ipmiPass, this.secretKey.url)
      const originalPass = decryptedBytes.toString(CryptoJS.enc.Utf8)
      const pIpmi: Ipmi = {
        target,
        host: ipmiHost,
        user: ipmiUser,
        pass: originalPass,
      }

      const sensorData = await this.props.handleGetIpmiSensorDataAsync(
        this.salt.url,
        this.salt.token,
        pIpmi
      )

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
        const isDisableName = getIsDisableAttr(containerElement, 'data-name')
        const name = containerElement.getAttribute('data-name')

        if (isDisableName) {
          graph.removeCellOverlays(cell)
          if (!_.find(hostList, host => host === name)) {
            graph.setCellWarning(cell, 'Warning', warningImage)
          }
        }
      }
    })
  }

  private changedDOM = () => {
    const hostList: NodeListOf<HTMLElement> = document
      .querySelector('#hostInventoryContainer')
      .querySelectorAll('.hosts-table--td')

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

  private topThreeSizer = () => {
    return (
      <Threesizer
        orientation={HANDLE_VERTICAL}
        divisions={this.topThreeSizerDivisions}
        onResize={this.handleResize('topSideProportions')}
      />
    )
  }

  private get topThreeSizerDivisions() {
    const [topLeft, topRight] = this.state.topSideProportions

    return [
      {
        name: '',
        handleDisplay: 'none',
        headerButtons: [],
        menuOptions: [],
        headerOrientation: HANDLE_HORIZONTAL,
        size: this.state.isPinned ? topLeft : 1,
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
                  {!this.state.isStatusVisible ? (
                    <div className="resizable-openbtn">
                      <Button
                        onClick={() => {
                          this.setState({isStatusVisible: true})
                        }}
                        text={'Open'}
                      ></Button>
                      <Button
                        onClick={() => {
                          this.toggleIsPinned()
                        }}
                        text="pin"
                      ></Button>
                    </div>
                  ) : null}
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
                        text="close"
                      ></Button>
                      <Button
                        onClick={() => {
                          this.toggleIsPinned()
                        }}
                        text="pin"
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
        },
      },
      {
        name: '123',
        headerOrientation: HANDLE_VERTICAL,
        headerButtons: [],
        menuOptions: [],
        handleDisplay: this.state.isPinned ? 'visible' : 'none',
        size: this.state.isPinned ? topRight : 0,
        render: (visibility: string) => {
          return visibility === 'visible' ? (
            <>
              <div>Pinded Hardware info</div>
            </>
          ) : null
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
          return this.topThreeSizer()
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
                items={['CloudWatch', '2', '3']}
                onChoose={this.getHandleOnChoose}
                selected={this.state.selected}
                className="dropdown-sm"
                disabled={false}
                // onClick={() => {
                //   this.handleFocusedBtnName({selected: this.state.selected})
                // }}
              />
            </Page.Header.Left>
            <Page.Header.Right></Page.Header.Right>
          </Page.Header>
        </Page>

        {this.renderGraph()}
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

  private get sidebarDivisions() {
    const {sidebarProportions} = this.state
    const [topSize, middleSize, bottomSize] = sidebarProportions

    const dummyData = {
      'first-level-node-1': {
        label: 'Amazon Web Service',
        index: 0,
        level: 0,
        nodes: {
          Seoul: {
            label: 'Seoul',
            index: 0,
            level: 1,
            nodes: {
              system: {
                label: 'EC2',
                index: 0,
                level: 2,
                nodes: {},
              },
            },
          },
          Pusan: {
            label: 'Pusan',
            index: 0,
            level: 1,
            nodes: {
              system: {
                label: 'EC2',
                index: 0,
                level: 2,
                nodes: {},
              },
            },
          },
        },
      },
      'first-level-node-2': {
        label: 'Google Cloud Platform',
        index: 1,
        level: 0,
        nodes: {},
      },
      'first-level-node-3': {
        label: 'Azure',
        index: 2,
        level: 0,
        nodes: {},
      },
    }

    return [
      {
        name: 'Detected Hosts',
        headerOrientation: HANDLE_HORIZONTAL,
        headerButtons: [
          <Button
            key={'total'}
            color={
              this.state.selectItem === 'total'
                ? ComponentColor.Primary
                : ComponentColor.Default
            }
            text={'total'}
            onClick={() => {
              this.onChooseItem('total')
            }}
            size={ComponentSize.ExtraSmall}
          />,
          <Button
            key={'cloud'}
            color={
              this.state.selectItem === 'cloud'
                ? ComponentColor.Primary
                : ComponentColor.Default
            }
            text={'cloud'}
            onClick={() => {
              this.onChooseItem('cloud')
            }}
            size={ComponentSize.ExtraSmall}
          />,
        ],
        menuOptions: [],
        size: topSize,
        render: () => {
          if (this.state.selectItem === 'total') {
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

          if (this.state.selectItem === 'cloud') {
            return (
              <InventoryTreemenu
                data={dummyData}
                graph={this.graph}

                // onMouse
                // onClickItem={this.onSelectedHost}
                // initialActiveKey={initialActiveKey}
                // initialOpenNodes={initialOpenNodes}
              />
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
    const {filteredLayouts, focusedHost, timeRange} = this.state

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
  notify: notifyAction,
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null
)(InventoryTopology)
