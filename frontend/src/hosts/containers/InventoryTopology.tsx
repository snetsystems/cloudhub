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
import {Form, Button, ComponentColor, ComponentSize} from 'src/reusable_ui'
import {Table, TableBody} from 'src/addon/128t/reusable/layout'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import Modal from 'src/hosts/components/Modal'
import PageSpinner from 'src/shared/components/PageSpinner'
import ResizableDock from 'src/shared/components/ResizableDock'

// constants
import {
  HANDLE_NONE,
  HANDLE_HORIZONTAL,
  HANDLE_VERTICAL,
} from 'src/shared/constants/'
import {tmpMenu} from 'src/hosts/constants/tools'

// Types
import {
  Source,
  Links,
  Host,
  RemoteDataState,
  Notification,
  NotificationFunc,
  Ipmi,
  IpmiCell,
} from 'src/types'
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

// Constants
import {notifyUnableToGetHosts} from 'src/shared/copy/notifications'

import {notify as notifyAction} from 'src/shared/actions/notifications'

// APIs
import {getCpuAndLoadForHosts} from 'src/hosts/apis'
import {getEnv} from 'src/shared/apis/env'

// Utils
import {generateForHosts} from 'src/utils/tempVars'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {
  getContainerElement,
  getIsDisableName,
  getParseHTML,
} from 'src/hosts/utils/topology'

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
  addHostsButton,
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
  detectedHostsStatus,
  dragCell,
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
      screenProportions: [0.3, 0.7],
      sidebarProportions: [0.333, 0.333, 0.333],
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
    }
  }

  public intervalID: number
  private isComponentMounted: boolean = true

  private containerRef = createRef<HTMLDivElement>()
  private outlineRef = createRef<HTMLDivElement>()
  private statusRef = createRef<HTMLDivElement>()
  private toolbarRef = createRef<HTMLDivElement>()
  private sidebarHostsRef = createRef<HTMLDivElement>()
  private cloudInventoryRef = createRef<HTMLDivElement>()
  private sidebarToolsRef = createRef<HTMLDivElement>()
  private sidebarPropertiesRef = createRef<HTMLDivElement>()

  private container: HTMLDivElement = null
  private outline: HTMLDivElement = null
  private toolbar: HTMLDivElement = null
  private hosts: HTMLDivElement = null
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
  private addHostsButton = addHostsButton
  private addToolsButton = addToolsButton
  private setToolbar = setToolbar

  public async componentDidMount() {
    this.createEditor()
    this.configureEditor()
    this.setActionInEditor()
    this.configureStylesheet(mx)
    // this.addHostsButton(this.state.hostsObject, this.hosts)
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
        if (_.get(topology, 'diagram')) {
          const graph = this.graph

          graph.getModel().beginUpdate()
          try {
            const doc = mxUtils.parseXml(topology.diagram)
            const codec = new mxCodec(doc)

            codec.decode(doc.documentElement, graph.getModel())
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

          console.log('hostList', hostList)

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
    if (
      JSON.stringify(_.keys(prevState.hostsObject)) !==
      JSON.stringify(_.keys(this.state.hostsObject))
    ) {
      this.setCellsWarning(_.keys(this.state.hostsObject))
      this.addHostsButton(this.state.hostsObject, this.hosts)
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

    const hostsError = notifyUnableToGetHosts().message
    if (!hostsObject) {
      throw new Error(hostsError)
    }

    const graph = this.graph
    const parent = graph.getDefaultParent()
    const cells = this.getAllCells(parent, true)

    // console.log('cells', cells)

    detectedHostsStatus.bind(this)(cells, hostsObject)

    // console.log('hostsObject', hostsObject)

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
    this.hosts = this.sidebarHostsRef.current
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
      console.log(cell)

      //     const doc = getParseHTML(target)
      // const containerElement = doc.querySelector('.vertex')

      const cellElement = getParseHTML(cell.value)
      const statusKind = cellElement
        .querySelector('div')
        .getAttribute('data-status-kind')
      const statusValue = cellElement
        .querySelector('div')
        .getAttribute('data-status-value')

      console.log(cellElement, statusKind)

      return statusKind !== null ? statusKind + ':' + statusValue + '%' : null
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
      console.log('createGroupCell', cells)
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
      console.log('groupCells', cells)
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
        const isDisableName = getIsDisableName(containerElement)
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
                    <Button
                      customClass="resizable-openbtn"
                      onClick={() => {
                        this.setState({isStatusVisible: true})
                      }}
                      text={'Open'}
                    ></Button>
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
    ]
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
      'Amazon Web Service': {
        label: 'Amazon Web Service',
        index: 0,
        level: 0,
        nodes: {
          Seoul: {
            label: 'Seoul',
            index: 0,
            level: 1,
            nodes: {
              EC1: {
                label: 'EC1',
                index: 0,
                level: 2,
                nodes: {},
              },
              EC2: {
                label: 'EC2',
                index: 0,
                level: 2,
                nodes: {},
              },
              EC5: {
                label: 'EC5',
                index: 0,
                level: 2,
                nodes: {},
              },
              EC6: {
                label: 'EC6',
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
              EC3: {
                label: 'EC3',
                index: 0,
                level: 2,
                nodes: {},
              },
            },
          },
        },
      },
      'Google Cloud Platform': {
        label: 'Google Cloud Platform',
        index: 1,
        level: 0,
        nodes: {},
      },
      Azure: {
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
        render: () => (
          <>
            <FancyScrollbar>
              {this.state.selectItem === 'total' ? (
                <TableBody>{<div ref={this.sidebarHostsRef} />}</TableBody>
              ) : (
                <InventoryTreemenu
                  data={dummyData}
                  graph={this.graph}

                  // onMouse
                  // onClickItem={this.onSelectedHost}
                  // initialActiveKey={initialActiveKey}
                  // initialOpenNodes={initialOpenNodes}
                />
              )}
            </FancyScrollbar>
          </>
        ),
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
