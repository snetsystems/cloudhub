import React, {createRef, PureComponent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import {getDeep} from 'src/utils/wrappers'
import CryptoJS from 'crypto-js'

import {
  default as mxgraph,
  mxEditor as mxEditorType,
  mxCell as mxCellType,
  mxCellState as mxCellStateType,
  mxForm as mxFormType,
  mxGraph as mxGraphType,
  mxGraphModel as mxGraphModelType,
  mxRectangle as mxRectangleType,
  mxGraphSelectionModel as mxGraphSelectionModeltype,
  mxEventObject as mxEventObjectType,
} from 'mxgraph'

// component
import {TableBody} from 'src/addon/128t/reusable/layout'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import XMLExportModal from 'src/hosts/components/XMLExportModal'
import PageSpinner from 'src/shared/components/PageSpinner'

// constants
import {
  HANDLE_NONE,
  HANDLE_HORIZONTAL,
  HANDLE_VERTICAL,
} from 'src/shared/constants/'
import {
  toolbarMenu,
  toolsMenu,
  tmpMenu,
  hostMenu,
  Menu,
} from 'src/hosts/constants/tools'

import {
  OUTPUT_INPUT_FIELD,
  CELL_SIZE_WIDTH,
  CELL_SIZE_HEIGHT,
} from 'src/hosts/constants/topology'

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
import {getCpuAndLoadForHosts} from 'src/hosts/apis'

import {getEnv} from 'src/shared/apis/env'

// Utils
import {generateForHosts} from 'src/utils/tempVars'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {
  getContainerElement,
  getContainerTitle,
  getIsDisableName,
  getIsHasString,
} from 'src/hosts/utils/topology'

// error
import {ErrorHandling} from 'src/shared/decorators/errors'

// css
import 'mxgraph/javascript/src/css/common.css'

import {Controlled as ReactCodeMirror} from 'react-codemirror2'
import {IpmiSetPowerStatus} from 'src/shared/apis/saltStack'

// Topology Configure
import {
  configureStylesheet,
  convertValueToString,
  isHtmlLabel,
  getLabel,
  dblClick,
  setOutline,
  getAllCells,
  getConnectImage,
  isCellSelectable,
  createForm,
  createHTMLValue,
  openSensorData,
  dragCell,
} from 'src/hosts/configurations/topology'

const mx = mxgraph()

const {
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
  hostsObject: {[x: string]: Host}
  minionList: string[]
  ipmis: Ipmi[]
  topology: string
  topologyId: string
  isModalVisible: boolean
  topologyStatus: RemoteDataState
}

@ErrorHandling
class InventoryTopology extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      screenProportions: [0.15, 0.85],
      sidebarProportions: [0.333, 0.333, 0.333],
      hostsObject: {},
      minionList: [],
      ipmis: [],
      topology: null,
      topologyId: null,
      isModalVisible: false,
      topologyStatus: RemoteDataState.Loading,
    }
  }

  public intervalID: number

  private containerRef = createRef<HTMLDivElement>()
  private outlineRef = createRef<HTMLDivElement>()
  private statusRef = createRef<HTMLDivElement>()
  private toolbarRef = createRef<HTMLDivElement>()
  private sidebarHostsRef = createRef<HTMLDivElement>()
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
  private setOutline = setOutline
  private getAllCells = getAllCells
  private openSensorData = openSensorData

  public async componentDidMount() {
    this.createEditor()
    this.configureEditor()
    this.setActionInEditor()
    this.configureStylesheet(mx)
    this.setOutline()
    this.setSidebar()
    this.setToolbar()

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

          this.setCellsWarning(hostList)

          this.setState({
            topologyStatus: RemoteDataState.Done,
          })
        } else {
          this.setState({
            topologyStatus: RemoteDataState.Done,
          })
        }
      }
    )

    this.graph.getModel().addListener(mxEvent.CHANGE, this.handleGraphModel)
  }

  public async componentDidUpdate(prevProps: Props, prevState: State) {
    if (
      JSON.stringify(_.keys(prevState.hostsObject)) !==
      JSON.stringify(_.keys(this.state.hostsObject))
    ) {
      this.setCellsWarning(_.keys(this.state.hostsObject))
      this.addHostsButton()
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
  }

  public render() {
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
            <XMLExportModal
              isVisible={this.state.isModalVisible}
              headingTitle={'XML Export'}
              onCancel={this.handleClose}
              message={
                <FancyScrollbar>
                  <ReactCodeMirror
                    autoCursor={true}
                    value={this.state.topology}
                    options={options}
                    onBeforeChange={(): void => {}}
                    onTouchStart={(): void => {}}
                  />
                </FancyScrollbar>
              }
            />
          </>
        )}
      </div>
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

    this.setState({
      hostsObject,
    })
  }

  private getIpmiStatus = async () => {
    const graph = this.graph
    const parent = graph.getDefaultParent()

    const cells = this.getAllCells(parent, true)

    let ipmiCells: IpmiCell[] = []

    _.forEach(cells, cell => {
      if (cell.getStyle() === 'node') {
        const containerElement = getContainerElement(cell.value)

        if (containerElement.hasAttribute('data-ipmi_host')) {
          const ipmiTarget = containerElement.getAttribute('data-using_minion')
          const ipmiHost = containerElement.getAttribute('data-ipmi_host')
          const ipmiUser = containerElement.getAttribute('data-ipmi_user')
          const ipmiPass = containerElement.getAttribute('data-ipmi_pass')

          if (
            !_.isEmpty(ipmiTarget) &&
            !_.isEmpty(ipmiHost) &&
            !_.isEmpty(ipmiUser) &&
            !_.isEmpty(ipmiPass)
          ) {
            const decryptedBytes = CryptoJS.AES.decrypt(
              ipmiPass,
              this.secretKey.url
            )
            const originalPass = decryptedBytes.toString(CryptoJS.enc.Utf8)

            const ipmiCell: IpmiCell = {
              target: ipmiTarget,
              host: ipmiHost,
              user: ipmiUser,
              pass: originalPass,
              powerStatus: '',
              cell: cell,
            }

            ipmiCells = [...ipmiCells, ipmiCell]
          }
        }
      }
    })

    this.setIpmiStatus(ipmiCells)
  }

  private setIpmiStatus = async (ipmiCells: IpmiCell[]) => {
    const ipmiCellsStatus: IpmiCell[] = await this.props.handleGetIpmiStatus(
      this.salt.url,
      this.salt.token,
      ipmiCells
    )

    const model = this.graph.getModel()
    model.beginUpdate()
    try {
      _.forEach(ipmiCellsStatus, ipmiCellStatus => {
        const childrenCell = ipmiCellStatus.cell.getChildAt(0)
        const childrenContainerElement = getContainerElement(childrenCell.value)

        if (!_.isEmpty(ipmiCellStatus.powerStatus)) {
          if (ipmiCellStatus.powerStatus === 'on') {
            this.graph.setCellStyles(mxConstants.STYLE_STROKECOLOR, '#f58220', [
              childrenCell,
            ])

            childrenContainerElement.setAttribute('ipmi-power-status', 'on')
            childrenCell.setValue(childrenContainerElement.outerHTML)
          } else if (ipmiCellStatus.powerStatus === 'off') {
            this.graph.setCellStyles(mxConstants.STYLE_STROKECOLOR, '#f58220', [
              childrenCell,
            ])

            childrenContainerElement.setAttribute('ipmi-power-status', 'off')
            childrenCell.setValue(childrenContainerElement.outerHTML)
          }
        } else {
          childrenContainerElement.setAttribute(
            'ipmi-power-status',
            'unconnected'
          )

          this.graph.setCellStyles(mxConstants.STYLE_STROKECOLOR, '#bec2cc', [
            childrenCell,
          ])

          childrenCell.setValue(childrenContainerElement.outerHTML)
        }
      })
    } finally {
      model.endUpdate()
      this.graphUpdate()
    }
  }

  // {
  //   if (!data) return
  //   const statusWindow = document.createElement('div')
  //   const statusTable = document.createElement('table')
  //   const rootItem = _.keys(data)

  //   _.forEach(rootItem, key => {
  //     const current: any = data[key]
  //     _.forEach(_.keys(current), c => {
  //       const statusTableRow = document.createElement('tr')
  //       let statusTableValue = document.createElement('td')

  //       const kindStatus = current[c]
  //       const isUnavailable = kindStatus?.unavailable === 1

  //       if (!isUnavailable) {
  //         const statusTableKind = document.createElement('th')
  //         statusTableKind.textContent = c

  //         const {value, units, states} = kindStatus

  //         let kindValue = ''

  //         if (_.isNumber(value) || _.isString(value)) {
  //           kindValue += value
  //           if (units) {
  //             kindValue += ' ' + units
  //           }
  //         } else {
  //           if (_.isEmpty(states)) {
  //             kindValue += '-'
  //           } else {
  //             kindValue += states[0]
  //           }
  //         }

  //         statusTableValue.textContent = kindValue
  //         statusTableRow.appendChild(statusTableKind)
  //         statusTableRow.appendChild(statusTableValue)
  //         statusTable.appendChild(statusTableRow)
  //       }
  //     })
  //   })

  //   statusWindow.appendChild(statusTable)

  //   this.statusRef.current.appendChild(statusWindow)
  //   document.querySelector('#statusContainer').classList.add('active')
  // }

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

  private insertHandler = (
    cells: mxCellType[],
    _asText?: string,
    model?: mxGraphModelType
  ) => {
    model = model ? model : this.graph.getModel()

    model.beginUpdate()
    try {
      _.forEach(cells, cell => {
        if (model.isEdge(cell)) {
          const edgeObj = {
            ...tmpMenu,
            name: 'Edge',
            label: 'Edge',
            type: 'Edge',
          }

          const edge = createHTMLValue(edgeObj, 'edge')

          cell.setValue(edge.outerHTML)
          cell.setStyle('edge')
        }
      })
    } finally {
      model.endUpdate()
    }
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
      (_sender, evt) => {
        const cells = [evt.getProperty('cell')]

        if (evt.getProperty('terminalInserted')) {
          cells.push(evt.getProperty('terminal'))
        }

        this.insertHandler(cells)
      }
    )

    this.graph.connectionHandler.createEdgeState = () => {
      const edge = this.graph.createEdge(null, null, null, null, null)

      return new mxCellState(
        this.graph.view,
        edge,
        this.graph.getCellStyle(edge)
      )
    }

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

    this.graph.addListener(mxEvent.CLICK, (_graph, me) => {
      const {
        properties: {cell},
      } = me

      document.querySelector('#statusContainer').classList.remove('active')
      document.querySelector('#statusContainerRef').innerHTML = null

      if (!_.isEmpty(cell) && cell.style === 'node') {
        const containerElement = getContainerElement(cell.value)

        if (containerElement.hasAttribute('data-ipmi_host')) {
          const target = containerElement.getAttribute('data-using_minion')
          const ipmiHost = containerElement.getAttribute('data-ipmi_host')
          const ipmiUser = containerElement.getAttribute('data-ipmi_user')
          const ipmiPass = containerElement.getAttribute('data-ipmi_pass')

          if (ipmiHost && ipmiUser && ipmiPass && target) {
            this.saltIpmiGetSensorDataAsync(
              target,
              ipmiHost,
              ipmiUser,
              ipmiPass,
              cell
            )
          }
        }
      }
    })

    mxPopupMenu.prototype.useLeftButtonForPopup = true

    this.graph.popupMenuHandler.factoryMethod = (menu, cell, evt) => {
      const cellValue = this.graph.getModel().getValue(cell)

      // @ts-ignore
      if (cellValue !== null && mxEvent.isLeftMouseButton(evt)) {
        const containerElement = getContainerElement(
          this.graph.getModel().getValue(cell)
        )

        if (containerElement.getAttribute('btn-type') === 'ipmi') {
          const ipmiPowerstate = containerElement.getAttribute(
            'ipmi-power-status'
          )

          const parentContainerElement = getContainerElement(
            cell.getParent().value
          )

          const ipmiTarget = parentContainerElement.getAttribute(
            'data-using_minion'
          )
          const ipmiHost = parentContainerElement.getAttribute('data-ipmi_host')
          const ipmiUser = parentContainerElement.getAttribute('data-ipmi_user')
          const ipmiPass = parentContainerElement.getAttribute('data-ipmi_pass')

          if (ipmiPowerstate === 'on') {
            menu.addItem('Power Off System', null, () => {
              this.saltIpmiSetPowerAsync(
                ipmiTarget,
                ipmiHost,
                ipmiUser,
                ipmiPass,
                IpmiSetPowerStatus.PowerOff
              )
            })

            menu.addItem('Graceful Shutdown', null, () => {
              this.saltIpmiSetPowerAsync(
                ipmiTarget,
                ipmiHost,
                ipmiUser,
                ipmiPass,
                IpmiSetPowerStatus.Shutdown
              )
            })

            menu.addItem('Force Reset System', null, () => {
              this.saltIpmiSetPowerAsync(
                ipmiTarget,
                ipmiHost,
                ipmiUser,
                ipmiPass,
                IpmiSetPowerStatus.Reset
              )
            })
          } else if (ipmiPowerstate === 'off') {
            menu.addItem('Power On', null, () => {
              this.saltIpmiSetPowerAsync(
                ipmiTarget,
                ipmiHost,
                ipmiUser,
                ipmiPass,
                IpmiSetPowerStatus.PowerOn
              )
            })
          }
          if (ipmiHost && ipmiUser && ipmiPass) {
            this.saltIpmiGetSensorDataAsync(
              ipmiTarget,
              ipmiHost,
              ipmiUser,
              ipmiPass,
              cell
            )
          }

          this.graph.setSelectionCell(cell.parent)
        }
      }
    }

    this.graph.constrainChildren = false

    this.graph.resizeCell = (
      cell: mxCellType,
      bounds: mxRectangleType,
      recurse?: boolean
    ) => {
      if (cell.getStyle() === 'node') {
        const containerElement = getContainerElement(cell.value)
        const title = containerElement.querySelector('.mxgraph-cell--title')
        title.setAttribute('style', `width: ${bounds.width}px;`)

        cell.setValue(containerElement.outerHTML)
      }

      return mxGraph.prototype.resizeCell.apply(this.graph, [
        cell,
        bounds,
        recurse,
      ])
    }

    this.editor.setGraphContainer(this.container)

    // @ts-ignore
    const getFoldingImage = mxGraph.prototype.getFoldingImage
    this.graph.getFoldingImage = () => {
      return null
    }
  }

  private onChangedSelection = (
    mxGraphSelectionModel: mxGraphSelectionModeltype,
    _mxEventObject: mxEventObjectType
  ) => {
    const graph: mxGraphType = mxGraphSelectionModel.graph
    const properties = this.properties

    properties.innerHTML = ''
    graph.container.focus()
    createForm.bind(this)(graph, properties)
  }

  private saltIpmiSetPowerAsync = _.throttle(
    async (
      target: string,
      ipmiHost: string,
      ipmiUser: string,
      ipmiPass: string,
      state: IpmiSetPowerStatus
    ) => {
      const decryptedBytes = CryptoJS.AES.decrypt(ipmiPass, this.secretKey.url)
      const originalPass = decryptedBytes.toString(CryptoJS.enc.Utf8)

      const ipmi: Ipmi = {
        target,
        host: ipmiHost,
        user: ipmiUser,
        pass: originalPass,
      }

      const setPowerStatus = await this.props.handleSetIpmiStatusAsync(
        this.salt.url,
        this.salt.token,
        ipmi,
        state
      )

      return setPowerStatus
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

      this.setState({topology: xmlString, isModalVisible: true})
    })
  }

  private setSidebar = () => {
    this.addHostsButton()
    this.addToolsButton()
  }

  private addHostsButton = () => {
    const hostList = _.keys(this.state.hostsObject)
    let menus: Menu[] = []

    this.hosts.innerHTML = ''

    _.forEach(hostList, host => {
      const hostObj = {
        ...hostMenu,
        name: host,
        label: host,
      }

      menus.push(hostObj)
    })

    _.forEach(menus, menu => {
      const rowElement = document.createElement('div')
      rowElement.classList.add('hosts-table--tr')
      rowElement.classList.add('topology-hosts-row')

      const hostElement = document.createElement('div')
      hostElement.classList.add('hosts-table--td')

      const span = document.createElement('span')
      span.style.fontSize = '14px'
      span.textContent = menu.label

      hostElement.appendChild(span)
      rowElement.appendChild(hostElement)

      this.addSidebarButton({
        sideBarArea: this.hosts,
        node: menu,
        element: rowElement,
      })
    })
  }

  private addToolsButton = () => {
    _.forEach(toolsMenu, menu => {
      const iconBox = document.createElement('div')
      iconBox.classList.add('tool-instance')

      const icon = document.createElement('div')
      icon.classList.add(`mxgraph-cell--icon`)
      icon.classList.add(`mxgraph-cell--icon-${menu.type.toLowerCase()}`)

      iconBox.appendChild(icon)

      this.addSidebarButton({
        sideBarArea: this.tools,
        node: menu,
        element: iconBox,
      })
    })
  }

  private addSidebarButton({
    sideBarArea,
    node,
    element,
  }: {
    sideBarArea: HTMLElement
    node: Menu
    element: HTMLDivElement
    iconClassName?: string
  }) {
    sideBarArea.appendChild(element)

    const dragElt = document.createElement('div')
    dragElt.style.border = 'dashed #f58220 1px'
    dragElt.style.width = `${CELL_SIZE_WIDTH}px`
    dragElt.style.height = `${CELL_SIZE_HEIGHT}px`
    const ds = mxUtils.makeDraggable(
      element,
      this.graph,
      dragCell(node),
      dragElt,
      0,
      0,
      true,
      true
    )

    ds.setGuidesEnabled(true)
  }

  private setToolbar = () => {
    _.forEach(toolbarMenu, menu => {
      const {actionName, label, icon, isTransparent} = menu
      this.addToolbarButton({
        editor: this.editor,
        toolbar: this.toolbar,
        action: actionName,
        label,
        icon,
        isTransparent,
      })
    })
  }

  private addToolbarButton = ({
    editor,
    toolbar,
    action,
    label,
    icon,
    isTransparent = false,
  }: {
    editor: mxEditorType
    toolbar: HTMLElement
    action: string
    label: string
    icon: string
    isTransparent?: boolean
  }) => {
    const button = document.createElement('button')
    button.style.fontSize = '10'
    button.classList.add('button')
    button.classList.add('button-sm')
    button.classList.add('button-default')
    button.classList.add('button-square')

    button.title = label

    if (icon !== null) {
      const span = document.createElement('span')
      span.classList.add('button-icon')
      span.classList.add('icon')
      span.classList.add(icon)
      button.appendChild(span)
    }

    if (isTransparent) {
      button.style.background = 'transparent'
      button.style.color = '#f58220'
      button.style.border = 'none'
    }

    mxEvent.addListener(button, 'click', () => {
      editor.execute(action)
    })

    toolbar.appendChild(button)
  }

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
    // xmlExport(sender)
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
                  <div id="statusContainer">
                    <FancyScrollbar autoHide={false}>
                      <div id="statusContainerRef" ref={this.statusRef}></div>
                    </FancyScrollbar>
                  </div>
                </div>
              </div>
            </>
          )
        },
      },
    ]
  }

  private get sidebarDivisions() {
    const {sidebarProportions} = this.state
    const [topSize, middleSize, bottomSize] = sidebarProportions

    return [
      {
        name: 'Detected Hosts',
        headerOrientation: HANDLE_HORIZONTAL,
        headerButtons: [],
        menuOptions: [],
        size: topSize,
        render: () => (
          <>
            <FancyScrollbar>
              <TableBody>{<div ref={this.sidebarHostsRef} />}</TableBody>
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
