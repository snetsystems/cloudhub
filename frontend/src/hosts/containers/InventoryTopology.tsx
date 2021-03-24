import React, {createRef, PureComponent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import {getDeep} from 'src/utils/wrappers'

import {
  default as mxgraph,
  mxEditor as mxEditorType,
  mxCell as mxCellType,
  mxCellState as mxCellStateType,
  mxForm as mxFormType,
  mxGraph as mxGraphType,
  mxGraphModel as mxGraphModelType,
  mxRectangle as mxRectangleType,
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

// Types
import {Source, Links, Host, RemoteDataState} from 'src/types'

// Actions
import {
  loadInventoryTopologyAsync,
  createInventoryTopologyAsync,
  updateInventoryTopologyAsync,
} from 'src/hosts/actions'

// APIs
import {getCpuAndLoadForHosts} from 'src/hosts/apis'

import {getEnv} from 'src/shared/apis/env'

// Utils
import {generateForHosts} from 'src/utils/tempVars'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

// error
import {ErrorHandling} from 'src/shared/decorators/errors'

// css
import 'mxgraph/javascript/src/css/common.css'

import {Controlled as ReactCodeMirror} from 'react-codemirror2'

// Config
const keyhandlerCommons = require('src/hosts/config/keyhandler-commons.xml')

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
  onManualRefresh: () => void
  handleGetInventoryTopology: () => Promise<any>
  handleCreateInventoryTopology: (topology: string) => Promise<any>
  handleUpdateInventoryTopology: (
    topologyId: string,
    topology: string
  ) => Promise<any>
}

interface State {
  screenProportions: number[]
  sidebarProportions: number[]
  hostsObject: {[x: string]: Host}
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
      screenProportions: [0.3, 0.7],
      sidebarProportions: [0.333, 0.333, 0.333],
      hostsObject: {},
      topology: null,
      topologyId: null,
      isModalVisible: false,
      topologyStatus: RemoteDataState.Loading,
    }
  }

  public intervalID: number

  private containerRef = createRef<HTMLDivElement>()
  private outlineRef = createRef<HTMLDivElement>()
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

  private OUTPUT_INPUT_FIELD = [
    'data-label',
    'data-link',
    // 'data-name',
    'data-idrac',
  ]

  private CELL_SIZE_WIDTH = 90
  private CELL_SIZE_HEIGHT = 90

  public async componentDidMount() {
    this.createEditor()
    this.configureEditor()
    this.setActionInEditor()
    this.configureStylesheet()
    this.setOutline()
    this.setSidebar()
    this.setToolbar()

    await this.getHostData()

    if (this.props.autoRefresh) {
      this.intervalID = window.setInterval(
        () => this.getHostData(),
        this.props.autoRefresh
      )
    }

    GlobalAutoRefresher.poll(this.props.autoRefresh)

    const hostList = _.keys(this.state.hostsObject)
    const topology = await this.props.handleGetInventoryTopology()

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

      this.setCellsWarning(hostList)

      this.setState({
        topology: _.get(topology, 'diagram'),
        topologyId: _.get(topology, 'id'),
        topologyStatus: RemoteDataState.Done,
      })
    } else {
      this.setState({
        topologyStatus: RemoteDataState.Done,
      })
    }

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
        this.state.topologyId,
        this.state.topology
      )
    }

    if (prevProps.autoRefresh !== this.props.autoRefresh) {
      clearInterval(this.intervalID)
      GlobalAutoRefresher.poll(this.props.autoRefresh)

      if (this.props.autoRefresh) {
        this.intervalID = window.setInterval(() => {
          this.getHostData()
        }, this.props.autoRefresh)
      }
    }

    if (prevProps.manualRefresh !== this.props.manualRefresh) {
      this.getHostData()
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

  private async getHostData() {
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

          const edge = this.createHTMLValue(edgeObj, 'edge')

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

    this.graph.connectionHandler.getConnectImage = (state: mxCellStateType) => {
      return new mxImage(state.style[mxConstants.STYLE_IMAGE], 16, 16)
    }

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

      const groupCell = this.createHTMLValue(groupObj, 'group')
      group.setValue(groupCell.outerHTML)
      group.setVertex(true)
      group.setConnectable(true)

      group.setStyle('group')

      return group
    }

    this.graph.isCellSelectable = (cell: mxCellType) => {
      return !this.graph.isCellLocked(cell)
    }

    this.graph.setConnectable(true)

    this.graph.getLabel = cell => {
      let tmp = mxGraph.prototype.getLabel.apply(this.graph, [cell])

      const isCellCollapsed = this.graph.isCellCollapsed(cell)
      if (cell.style !== 'group') {
        if (isCellCollapsed) {
          const containerElement = this.getContainerElement(tmp)
          const title = this.getContainerTitle(containerElement)

          tmp = title.outerHTML
        }
      }

      return tmp
    }

    this.graph.isHtmlLabel = (cell: mxCellType) => {
      return !this.graph.isSwimlane(cell)
    }

    this.graph.convertValueToString = (cell: mxCellType) => {
      if (cell) {
        if (cell.style === 'group' || cell.style === 'edge') {
          const constainerElement = this.getContainerElement(cell.value)
          const label = constainerElement.getAttribute('data-label')

          return label
        } else {
          return cell.value
        }
      }

      return ''
    }

    this.graph.getSelectionModel().addListener(mxEvent.CHANGE, () => {
      this.selectionChanged(this.graph)
    })

    this.graph.dblClick = evt => {
      mxEvent.consume(evt)
    }

    this.graph.constrainChildren = false

    this.graph.resizeCell = (
      cell: mxCellType,
      bounds: mxRectangleType,
      recurse?: boolean
    ) => {
      if (cell.getStyle() === 'node') {
        const containerElement = this.getContainerElement(cell.value)
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
    const config = mxUtils.load(keyhandlerCommons).getDocumentElement()
    this.editor.configure(config)

    // @ts-ignore
    const getFoldingImage = mxGraph.prototype.getFoldingImage
    this.graph.getFoldingImage = () => {
      return null
    }
  }

  private selectionChanged = (graph: mxGraphType) => {
    const properties = this.properties
    properties.innerHTML = ''

    graph.container.focus()

    const cell = graph.getSelectionCell()

    if (cell) {
      const form = new mxForm('properties-table')

      const containerElement = this.getContainerElement(cell.value)
      const attrs = _.filter(containerElement.attributes, attr => {
        let isSame = false
        _.forEach(this.OUTPUT_INPUT_FIELD, INPUT_FIELD => {
          if (attr.nodeName === INPUT_FIELD) {
            isSame = true
            return
          }
        })
        return isSame
      })

      const isDisableName = this.getIsDisableName(containerElement)

      _.forEach(attrs, attr => {
        this.createTextField(graph, form, cell, attr, isDisableName)
      })
      properties.appendChild(form.getTable())
    } else {
      mxUtils.writeln(properties, 'Nothing selected.')
    }
  }

  private getParseHTML = (
    targer: string,
    type: DOMParserSupportedType = 'text/html'
  ) => {
    const parser = new DOMParser()
    const parseHTML = parser.parseFromString(targer, type)

    return parseHTML
  }

  private getContainerElement = (target: string): Element => {
    const doc = this.getParseHTML(target)
    const containerElement = doc.querySelector('.vertex')

    return containerElement
  }

  private getContainerTitle = (element: Element) => {
    const title = element.querySelector('.mxgraph-cell--title > strong')
    return title
  }

  private getIsDisableName = (containerElement: Element): boolean => {
    let isDisableName = false

    if (containerElement) {
      isDisableName =
        containerElement.getAttribute('data-isdisablename') === 'true'
    }

    return isDisableName
  }

  private getIsHasString = (value: string): boolean => {
    return value !== ''
  }

  private setActionInEditor = () => {
    this.editor.addAction('group', () => {
      if (this.graph.isEnabled()) {
        let cells = mxUtils.sortCells(this.graph.getSelectionCells(), true)
        cells = _.filter(cells, cell => cell.style !== 'edge')

        if (cells.length === 1 && this.graph.isSwimlane(cells[0])) {
          return
        } else {
          cells = this.graph.getCellsForGroup(cells)
          if (cells.length > 1) {
            this.graph.setSelectionCell(this.graph.groupCells(null, 30, cells))
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

          if (cells !== null) {
            _.forEach(cells, cell => {
              if (this.graph.model.contains(cell)) {
                if (
                  this.graph.model.getChildCount(cell) == 0 &&
                  this.graph.model.isVertex(cell)
                ) {
                  this.graph.setCellStyles('group', '0', [cell])
                }
                temp.push(cell)
              }
            })
          }

          this.graph.setSelectionCells(temp)
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

  private configureStylesheet = () => {
    let style = new Object()
    style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_RECTANGLE
    style[mxConstants.STYLE_PERIMETER] = mxPerimeter.RectanglePerimeter
    style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_CENTER
    style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_MIDDLE
    style[mxConstants.STYLE_FILLCOLOR] = '#383846'
    style[mxConstants.STYLE_STROKECOLOR] = '#ffffff'
    style[mxConstants.STYLE_STROKECOLOR] = '#f58220'
    style[mxConstants.STYLE_FONTCOLOR] = '#bec2cc'
    style[mxConstants.STYLE_ROUNDED] = true
    style[mxConstants.STYLE_ABSOLUTE_ARCSIZE] = true
    style[mxConstants.STYLE_ARCSIZE] = '10'
    style[mxConstants.STYLE_OPACITY] = '100'
    style[mxConstants.STYLE_FONTSIZE] = '12'
    style[mxConstants.STYLE_FONTSTYLE] = 0
    style[mxConstants.STYLE_IMAGE_WIDTH] = '48'
    style[mxConstants.STYLE_IMAGE_HEIGHT] = '48'
    this.graph.getStylesheet().putDefaultVertexStyle(style)

    style = new Object()
    style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_SWIMLANE
    style[mxConstants.STYLE_PERIMETER] = mxPerimeter.RectanglePerimeter
    style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_CENTER
    style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_TOP
    style[mxConstants.STYLE_FILLCOLOR] = '#E86A00'
    style[mxConstants.STYLE_GRADIENTCOLOR] = '#E86A00'
    style[mxConstants.STYLE_STROKECOLOR] = '#E86A00'
    style[mxConstants.STYLE_FONTCOLOR] = '#ffffff'
    style[mxConstants.STYLE_ROUNDED] = true
    style[mxConstants.STYLE_OPACITY] = '80'
    style[mxConstants.STYLE_STARTSIZE] = '30'
    style[mxConstants.STYLE_FONTSIZE] = '16'
    style[mxConstants.STYLE_FONTSTYLE] = 1
    this.graph.getStylesheet().putCellStyle('group', style)

    style = new Object()
    style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_RECTANGLE
    style[mxConstants.STYLE_PERIMETER] = mxPerimeter.RectanglePerimeter
    style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_LEFT
    style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_MIDDLE
    style[mxConstants.STYLE_STROKECOLOR] = '#F58220'
    this.graph.getStylesheet().putCellStyle('href', style)

    style = this.graph.getStylesheet().getDefaultEdgeStyle()
    style[mxConstants.STYLE_LABEL_BACKGROUNDCOLOR] = '#000000'
    style[mxConstants.STYLE_FONTCOLOR] = '#FFFFFF'
    style[mxConstants.STYLE_STROKEWIDTH] = '2'
    style[mxConstants.STYLE_ROUNDED] = true
    style[mxConstants.STYLE_EDGE] = mxEdgeStyle.OrthConnector
    style[mxConstants.STYLE_ENDARROW] = null
    style[mxConstants.STYLE_STARTARROW] = null
  }

  private setOutline = () => {
    const outln = new mxOutline(this.graph, this.outline)
    outln.outline.labelsVisible = true
    outln.outline.setHtmlLabels(true)
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
    dragElt.style.width = `${this.CELL_SIZE_WIDTH}px`
    dragElt.style.height = `${this.CELL_SIZE_HEIGHT}px`

    const ds = mxUtils.makeDraggable(
      element,
      this.graph,
      this.dragCell(node),
      dragElt,
      0,
      0,
      true,
      true
    )

    ds.setGuidesEnabled(true)
  }

  private createHTMLValue = (node: Menu, style: string) => {
    const cell = document.createElement('div')
    cell.classList.add('vertex')

    const cellTitleBox = document.createElement('div')
    cellTitleBox.classList.add('mxgraph-cell--title')
    cellTitleBox.setAttribute('style', `width: ${this.CELL_SIZE_WIDTH}px;`)

    const cellTitle = document.createElement('strong')
    cellTitle.textContent = node.label

    cellTitleBox.appendChild(cellTitle)

    _.forEach(_.keys(node), attr => {
      cell.setAttribute(`data-${attr}`, node[attr])
    })

    cell.appendChild(cellTitleBox)

    if (style === 'node') {
      const cellIconBox = document.createElement('div')
      const cellIcon = document.createElement('div')

      cellIcon.classList.add('mxgraph-cell--icon')
      cellIcon.classList.add('mxgraph-cell--icon-box')
      cellIcon.classList.add(`mxgraph-cell--icon-${_.toLower(node.type)}`)
      cellIconBox.appendChild(cellIcon)

      cell.appendChild(cellIconBox)
    }

    return cell
  }

  private dragCell = (node: Menu) => (
    graph: mxGraphType,
    _event: any,
    _cell: mxCellType,
    x: number,
    y: number
  ) => {
    const parent = graph.getDefaultParent()
    const model = graph.getModel()
    let v1 = null

    model.beginUpdate()
    try {
      const cell = this.createHTMLValue(node, 'node')

      v1 = graph.insertVertex(
        parent,
        null,
        cell.outerHTML,
        x,
        y,
        this.CELL_SIZE_WIDTH,
        this.CELL_SIZE_HEIGHT,
        'node'
      )

      v1.setConnectable(true)

      const linkBox = document.createElement('div')
      linkBox.classList.add('vertex')
      linkBox.style.display = 'flex'
      linkBox.style.alignItems = 'center'
      linkBox.style.justifyContent = 'center'
      linkBox.style.width = '25px'
      linkBox.style.height = '25px'
      linkBox.style.marginLeft = '-2px'

      const link = document.createElement('a')
      link.setAttribute('href', '')
      link.setAttribute('target', '_blank')

      const linkIcon = document.createElement('span')
      linkIcon.classList.add('mxgraph-cell--link-btn')
      linkIcon.classList.add('icon')
      linkIcon.classList.add('dash-j')

      link.appendChild(linkIcon)
      linkBox.appendChild(link)

      const href = graph.insertVertex(
        v1,
        null,
        linkBox.outerHTML,
        1,
        0,
        24,
        24,
        `href`,
        true
      )

      href.geometry.offset = new mxPoint(-18, -12)
      href.setConnectable(false)
      href.setVisible(false)
    } finally {
      model.endUpdate()
    }

    graph.setSelectionCell(v1)
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

  private createTextField = (
    graph: mxGraphType,
    form: mxFormType,
    cell: mxCellType,
    attribute: any,
    isDisableName = false
  ) => {
    const nodeName = _.upperFirst(attribute.nodeName.replace('data-', ''))
    const input = form.addText(nodeName, attribute.nodeValue, 'text')
    input.classList.add('input-sm')
    input.classList.add('form-control')

    if (attribute.nodeName === 'data-name') {
      input.disabled = isDisableName
    }

    const applyHandler = () => {
      const containerElement = this.getContainerElement(cell.value)

      const newValue = input.value || ''
      const oldValue = containerElement.getAttribute(attribute.nodeName) || ''

      if (newValue !== oldValue) {
        graph.getModel().beginUpdate()

        try {
          if (attribute.nodeName === 'data-label') {
            const title = this.getContainerTitle(containerElement)
            title.textContent = newValue
          }

          if (attribute.nodeName === 'data-link') {
            if (cell.children) {
              const childrenCell = cell.getChildAt(0)
              if (childrenCell.style === 'href') {
                const childrenContainerElement = this.getContainerElement(
                  childrenCell.value
                )

                const childrenLink = childrenContainerElement.querySelector('a')
                childrenLink.setAttribute('href', newValue)

                childrenCell.setValue(childrenContainerElement.outerHTML)
                childrenCell.setVisible(this.getIsHasString(newValue))
              }
            }
          }

          containerElement.setAttribute(attribute.nodeName, newValue)
          cell.setValue(containerElement.outerHTML)
        } finally {
          graph.getModel().endUpdate()
          this.graphUpdate()
        }
      }
    }

    mxEvent.addListener(
      input,
      'keypress',
      (event: KeyboardEvent & MouseEvent) => {
        if (event.key === 'Enter' && !mxEvent.isShiftDown(event)) {
          input.blur()
        }
      }
    )

    if (mxClient.IS_IE) {
      mxEvent.addListener(input, 'focusout', applyHandler)
    } else {
      mxEvent.addListener(input, 'blur', applyHandler)
    }
  }

  private setCellsWarning = (hostList: string[]) => {
    const graph = this.graph
    const parent = graph.getDefaultParent()

    graph.selectAll(parent, true)

    const cells = graph.getSelectionCells()

    graph.removeSelectionCells(cells)

    _.forEach(cells, cell => {
      if (cell.getStyle() === 'node') {
        const containerElement = this.getContainerElement(cell.value)
        const isDisableName = this.getIsDisableName(containerElement)
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
                    autoFocus={true}
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
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null
)(InventoryTopology)
