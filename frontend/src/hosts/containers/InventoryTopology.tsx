import React, {Children, createRef, PureComponent} from 'react'
import {connect} from 'react-redux'
import {
  default as mxgraph,
  mxEditor as mxEditorType,
  // mxGuide as mxGuideType,
  // mxDivResizer as mxDivResizerType,
  // mxEdgeHandler as mxEdgeHandlerType,
  // mxEvent as mxEventType,
  // mxGraphHandler as mxGraphHandlerType,
  // mxConstants as mxConstantsType,
  // mxUtils as mxUtilsType,
  // mxClient as mxClientType,
  // mxImage as mxImageType,
  mxCell as mxCellType,
  // mxGeometry as mxGeometryType,
  mxCellState as mxCellStateType,
  // mxRubberband as mxRubberbandType,
  mxForm as mxFormType,
  mxGraph as mxGraphType,
  // mxCodec as mxCodecType,
  // mxPerimeter as mxPerimeterType,
  // mxEdgeStyle as mxEdgeStyleType,
  // mxOutline as mxOutlineType,
  // mxRectangle as mxRectangleType,
  // mxPoint as mxPointType,
  // mxWindow as mxWindowType,
  // mxEffects as mxEffectsType,
  mxGraphModel as mxGraphModelType,
} from 'mxgraph'

import _ from 'lodash'

// component
// import {Button, ButtonShape, IconFont} from 'src/reusable_ui'
// import HostList from 'src/hosts/components/HostList'
import {TableBody, TableBodyRowItem} from 'src/addon/128t/reusable/layout'
// import uuid from 'uuid'
// import Tools from 'src/hosts/components/Tools'
// import Properties from 'src/hosts/components/Properties'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import Threesizer from 'src/shared/components/threesizer/Threesizer'

// constants
import {
  HANDLE_NONE,
  HANDLE_HORIZONTAL,
  HANDLE_VERTICAL,
} from 'src/shared/constants/'
import {
  toolbarMenu,
  toolsMenu,
  hostsMenu,
  Node,
} from 'src/hosts/constants/tools'

// Types
import {Host} from 'src/types'

// error
import {ErrorHandling} from 'src/shared/decorators/errors'

// css
import 'mxgraph/javascript/src/css/common.css'

// Config
const keyhandlerCommons = require('src/hosts/config/keyhandler-commons.xml')

const CELL_SIZE_WIDTH = 120
const CELL_SIZE_HEIGHT = 120

const mx = mxgraph({
  mxImageBasePath: '../../../assets/images/stencils/',
})

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
  // mxCell,
  // mxGeometry,
  mxCellState,
  mxRubberband,
  mxForm,
  mxGraph,
  mxCodec,
  mxPerimeter,
  mxEdgeStyle,
  mxOutline,
  mxRectangle,
  mxPoint,
  mxWindow,
  mxEffects,
} = mx

const collapsedImg = require('../../../assets/images/stencils/collapsed.gif')
const expandedImg = require('../../../assets/images/stencils/expanded.gif')
const linkImg = require('../../../assets/images/stencils/link.png')
mxGraph.prototype.collapsedImage = new mxImage(collapsedImg, 9, 9)
mxGraph.prototype.expandedImage = new mxImage(expandedImg, 9, 9)

const imgExpanded = require('../../../assets/images/stencils/expanded.gif')

// Creates a wrapper editor with a graph inside the given container.
// The editor is used to create certain functionality for the
// graph, such as the rubberband selection, but most parts
// of the UI are custom in this example.
const editor = new mxEditor()
const graph = editor.graph

interface Props {
  hostsObject: {[x: string]: Host}
  autoRefresh: number
  manualRefresh: number
  onManualRefresh: () => void
}

interface State {
  screenProportions: number[]
  sidebarProportions: number[]
  hostList: string[]
}

@ErrorHandling
class InventoryTopology extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      screenProportions: [0.3, 0.7],
      sidebarProportions: [0.333, 0.333, 0.333],
      hostList: null,
    }
  }

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

  public componentDidMount() {
    this.createEditor()
    this.configureEditor()
    this.setActionInEditor()
    this.configureStylesheet()
    this.setOutline()
    this.setSidebar()
    this.setToolbar()

    const hostList = _.keys(this.props.hostsObject)
    this.setState({hostList})
  }

  public componentDidUpdate(prevProps: Props) {
    const {hostsObject} = this.props
    if (prevProps.hostsObject !== hostsObject) {
      // this.addHostButton()
      // const hostList = _.keys(hostsObject)
      // this.setState({hostList})
    }
  }

  public componentWillUnmount() {}

  private createEditor = () => {
    this.container = this.containerRef.current
    this.outline = this.outlineRef.current
    this.hosts = this.sidebarHostsRef.current
    this.tools = this.sidebarToolsRef.current
    this.properties = this.sidebarPropertiesRef.current
    this.toolbar = this.toolbarRef.current
  }

  // Implements a global current style for edges and vertices that is applied to new cells
  private insertHandler = (
    cells: mxCellType[],
    _asText?: string,
    model?: mxGraphModelType
  ) => {
    model = model ? model : graph.getModel()

    model.beginUpdate()
    try {
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]

        // Applies the current style to the cell
        const isEdge = model.isEdge(cell)
        if (isEdge) {
          const edge = document.createElement('div')

          edge.classList.add('vertex')
          edge.setAttribute('data-name', 'Edge')
          edge.setAttribute('data-label', 'Edge')
          edge.setAttribute('data-type', 'Edge')
          cell.setValue(edge.outerHTML)
          cell.setStyle('edge')
        }
      }
    } finally {
      model.endUpdate()
    }
  }

  private configureEditor = () => {
    // Enables rubberband selection
    new mxRubberband(graph)

    // Assigns some global constants for general behaviour, eg. minimum
    // size (in pixels) of the active region for triggering creation of
    // new connections, the portion (100%) of the cell area to be used
    // for triggering new connections, as well as some fading options for
    // windows and the rubberband selection.
    mxConstants.MIN_HOTSPOT_SIZE = 16
    mxConstants.DEFAULT_HOTSPOT = 1

    // Enables guides
    mxGraphHandler.prototype.guidesEnabled = true

    // Alt disables guides
    mxGuide.prototype.isEnabledForEvent = (evt: MouseEvent) => {
      return !mxEvent.isAltDown(evt)
    }

    // Enables snapping waypoints to terminals
    mxEdgeHandler.prototype.snapToTerminals = true

    // connect handler
    graph.connectionHandler.addListener(mxEvent.CONNECT, (_sender, evt) => {
      const cells = [evt.getProperty('cell')]

      if (evt.getProperty('terminalInserted')) {
        cells.push(evt.getProperty('terminal'))
      }

      this.insertHandler(cells)
    })

    // Enables connect preview for the default edge style
    graph.connectionHandler.createEdgeState = function() {
      const edge = graph.createEdge(null, null, null, null, null)

      return new mxCellState(
        this.graph.view,
        edge,
        this.graph.getCellStyle(edge)
      )
    }

    // Workaround for Internet Explorer ignoring certain CSS directives
    if (mxClient.IS_QUIRKS) {
      document.body.style.overflow = 'hidden'
      new mxDivResizer(this.container)
      new mxDivResizer(this.outline)
      new mxDivResizer(this.toolbar)
      new mxDivResizer(this.tools)
    }

    // Disable highlight of cells when dragging from toolbar
    graph.setDropEnabled(false)

    // Uses the port icon while connections are previewed
    graph.connectionHandler.getConnectImage = (state: mxCellStateType) => {
      return new mxImage(state.style[mxConstants.STYLE_IMAGE], 16, 16)
    }

    // Centers the port icon on the target port
    graph.connectionHandler.targetConnectImage = true

    // Does not allow dangling edges
    graph.setAllowDanglingEdges(false)

    // Sets the graph container and configures the editor
    editor.setGraphContainer(this.container)
    const config = mxUtils.load(keyhandlerCommons).getDocumentElement()
    editor.configure(config)

    // // Overrides method to store a cell label in the model
    // const cellLabelChanged = graph.cellLabelChanged
    // graph.cellLabelChanged = (
    //   cell: mxCellType,
    //   newValue: any,
    //   autoSize: boolean
    // ) => {
    //   if (mxUtils.isNode(cell.value, cell.value.nodeName)) {
    //     // Clones the value for correct undo/redo
    //     const elt = cell.value.cloneNode(true)
    //     elt.setAttribute('label', newValue)

    //     newValue = elt

    //     cellLabelChanged.apply(graph, [cell, newValue, autoSize])
    //   }
    // }

    // // @ts-ignore Overrides method to create the editing value
    // const getEditingValue = graph.getEditingValue
    // graph.getEditingValue = cell => {
    //   if (mxUtils.isNode(cell.value, cell.value.nodeName)) {
    //     const label = cell.getAttribute('label', '')

    //     return label
    //   }
    // }

    /**
     * Disables drill-down for non-swimlanes.
     */
    // @ts-ignore
    graph.isContainer = function(cell: mxCell) {
      const style = this.getCurrentCellStyle(cell)

      if (this.isSwimlane(cell)) {
        return style['container'] != '0'
      } else {
        return style['container'] == '1'
      }
    }

    /**
     * Overrides createGroupCell to set the group style for new groups to 'group'.
     */
    graph.createGroupCell = function() {
      const group = mxGraph.prototype.createGroupCell.apply(this, arguments)

      // Defines the default group to be used for grouping. The
      // default group is a field in the mxEditor instance that
      // is supposed to be a cell which is cloned for new cells.
      // The groupBorderSize is used to define the spacing between
      // the children of a group and the group bounds.

      const groupCell = document.createElement('div')

      groupCell.classList.add('vertex')
      groupCell.setAttribute('data-name', 'Group')
      groupCell.setAttribute('data-label', 'Group')
      groupCell.setAttribute('data-type', 'Group')

      group.setValue(groupCell.outerHTML)
      group.setVertex(true)
      group.setConnectable(false)

      group.setStyle('group')

      return group
    }

    /**
     * Returns true if the given cell is a table.
     */
    // @ts-ignore
    graph.isTable = function(cell: mxCell) {
      const style = this.getCellStyle(cell)

      return style != null && style['childLayout'] == 'tableLayout'
    }

    /**
     * Returns true if the given cell is a table cell.
     */
    // @ts-ignore
    graph.isTableCell = function(cell: mxCell) {
      return (
        this.model.isVertex(cell) && this.isTableRow(this.model.getParent(cell))
      )
    }

    /**
     * Returns true if the given cell is a table row.
     */
    // @ts-ignore
    graph.isTableRow = function(cell: mxCellType) {
      return (
        this.model.isVertex(cell) && this.isTable(this.model.getParent(cell))
      )
    }

    // Disables drag-and-drop into non-swimlanes.
    graph.isValidDropTarget = function(cell: mxCellType) {
      return this.isSwimlane(cell)
    }

    // Disables drilling into non-swimlanes.
    graph.isValidRoot = function(cell: mxCellType) {
      return this.isValidDropTarget(cell)
    }

    // Does not allow selection of locked cells
    graph.isCellSelectable = function(cell: mxCellType) {
      return !this.isCellLocked(cell)
    }

    // Enables new connections
    graph.setConnectable(true)

    // Returns a shorter label if the cell is collapsed and no
    // label for expanded groups
    graph.getLabel = function(cell) {
      let tmp = mxGraph.prototype.getLabel.apply(this, arguments) // "supercall"

      const isCellCollapsed = this.isCellCollapsed(cell)
      if (cell.style === 'group') {
        if (isCellCollapsed) {
        }
      } else {
        if (isCellCollapsed) {
          const parser = new DOMParser()
          const doc = parser.parseFromString(tmp, 'text/html')
          const vertex = doc.querySelector('.vertex')
          const strong = vertex.querySelector('strong')

          tmp = strong.outerHTML
        }
      }

      return tmp
    }

    // Disables HTML labels for swimlanes to avoid conflict
    // for the event processing on the child cells. HTML
    // labels consume events before underlying cells get the
    // chance to process those events.
    //
    // NOTE: Use of HTML labels is only recommended if the specific
    // features of such labels are required, such as special label
    // styles or interactive form fields. Otherwise non-HTML labels
    // should be used by not overidding the following function.
    // See also: configureStylesheet.
    graph.isHtmlLabel = function(cell) {
      return !this.isSwimlane(cell)
    }

    // Overrides method to provide a cell label in the display
    graph.convertValueToString = cell => {
      if (cell) {
        if (cell.style === 'group') {
          const parser = new DOMParser()
          const doc = parser.parseFromString(cell.value, 'text/html')
          const vertex = doc.querySelector('.vertex')
          const label = vertex.getAttribute('data-label')

          return label
        }
        if (cell.style === 'edge') {
          const parser = new DOMParser()
          const doc = parser.parseFromString(cell.value, 'text/html')
          const vertex = doc.querySelector('.vertex')
          const label = vertex.getAttribute('data-label')

          return label
        } else {
          return cell.value
        }
      }

      return ''
    }

    // Implements a properties panel that uses
    // mxCellAttributeChange to change properties
    graph.getSelectionModel().addListener(mxEvent.CHANGE, () => {
      this.selectionChanged(graph)
    })

    graph.dblClick = function(evt) {
      // Disables any default behaviour for the double click
      mxEvent.consume(evt)
    }
  }

  private selectionChanged = (graph: mxGraphType) => {
    const properties = this.properties

    // Forces focusout in IE
    graph.container.focus()

    // Clears the DIV the non-DOM way
    properties.innerHTML = ''

    // Gets the selection cell
    const cell = graph.getSelectionCell()

    if (cell) {
      // Creates the form from the attributes of the user object
      const form = new mxForm('inventory-topology--mxform')

      const parser = new DOMParser()
      const doc = parser.parseFromString(cell.value, 'text/html')
      const vertex = doc.querySelector('.vertex')
      const attrNames = ['data-label', 'data-href', 'data-name']
      const attrs = _.filter(vertex.attributes, attr => {
        let isSame = false
        _.forEach(attrNames, attrName => {
          if (attr.nodeName === attrName) {
            isSame = true
            return
          }
        })
        return isSame
      })

      if (attrs) {
        for (let i = 0; i < attrs.length; i++) {
          this.createTextField(graph, form, cell, attrs[i])
        }
      }

      properties.appendChild(form.getTable())
    } else {
      mxUtils.writeln(properties, 'Nothing selected.')
    }
  }

  // Register an action in the editor
  private setActionInEditor = () => {
    // Group
    editor.addAction('group', () => {
      if (graph.isEnabled()) {
        let cells = mxUtils.sortCells(graph.getSelectionCells(), true)

        if (
          cells.length == 1 && // @ts-ignore
          !graph.isTable(cells[0]) && // @ts-ignore
          !graph.isTableRow(cells[0])
        ) {
          graph.setCellStyles('container', '1')
        } else {
          cells = graph.getCellsForGroup(cells)
          if (cells.length > 1) {
            graph.setSelectionCell(graph.groupCells(null, 30, cells))
          }
        }
      }
    })

    // Ungroup
    editor.addAction('ungroup', function() {
      if (graph.isEnabled()) {
        const cells = graph.getSelectionCells()

        graph.model.beginUpdate()
        try {
          const temp = graph.ungroupCells(cells)

          // Clears container flag for remaining cells
          if (cells != null) {
            for (let i = 0; i < cells.length; i++) {
              if (graph.model.contains(cells[i])) {
                if (
                  graph.model.getChildCount(cells[i]) == 0 &&
                  graph.model.isVertex(cells[i])
                ) {
                  graph.setCellStyles('container', '0', [cells[i]])
                }

                temp.push(cells[i])
              }
            }
          }

          graph.setSelectionCells(temp)
        } finally {
          graph.model.endUpdate()
        }
      }
    })

    // Defines a new export action
    editor.addAction('export', editor => {
      const textarea = document.createElement('textarea')
      textarea.style.width = '400px'
      textarea.style.height = '400px'

      const enc = new mxCodec(mxUtils.createXmlDocument())
      const node = enc.encode(editor.graph.getModel())

      // @ts-ignore
      textarea.value = mxUtils.getPrettyXml(node)
      this.showModalWindow(graph, 'XML', textarea, 410, 440)
    })
  }

  private configureStylesheet = () => {
    let style = new Object()
    style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_RECTANGLE
    style[mxConstants.STYLE_PERIMETER] = mxPerimeter.RectanglePerimeter
    style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_CENTER
    style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_MIDDLE
    style[mxConstants.STYLE_GRADIENTCOLOR] = '#e7e8eb'
    style[mxConstants.STYLE_FILLCOLOR] = '#f6f6f8'
    style[mxConstants.STYLE_STROKECOLOR] = '#ffffff'
    style[mxConstants.STYLE_FONTCOLOR] = '#000000'
    style[mxConstants.STYLE_ROUNDED] = true
    style[mxConstants.STYLE_OPACITY] = '100'
    style[mxConstants.STYLE_FONTSIZE] = '12'
    style[mxConstants.STYLE_FONTSTYLE] = 0
    style[mxConstants.STYLE_IMAGE_WIDTH] = '48'
    style[mxConstants.STYLE_IMAGE_HEIGHT] = '48'
    graph.getStylesheet().putDefaultVertexStyle(style)

    // // NOTE: Alternative vertex style for non-HTML labels should be as
    // // follows. This repaces the above style for HTML labels.
    // let style = new Object()
    // style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_LABEL
    // style[mxConstants.STYLE_PERIMETER] = mxPerimeter.RectanglePerimeter
    // style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_TOP
    // style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_CENTER
    // style[mxConstants.STYLE_IMAGE_ALIGN] = mxConstants.ALIGN_CENTER
    // style[mxConstants.STYLE_IMAGE_VERTICAL_ALIGN] = mxConstants.ALIGN_TOP
    // style[mxConstants.STYLE_SPACING_TOP] = '56'
    // style[mxConstants.STYLE_GRADIENTCOLOR] = '#7d85df'
    // style[mxConstants.STYLE_STROKECOLOR] = '#5d65df'
    // style[mxConstants.STYLE_FILLCOLOR] = '#adc5ff'
    // style[mxConstants.STYLE_FONTCOLOR] = '#1d258f'
    // style[mxConstants.STYLE_FONTFAMILY] = 'Verdana'
    // style[mxConstants.STYLE_FONTSIZE] = '12'
    // style[mxConstants.STYLE_FONTSTYLE] = '1'
    // style[mxConstants.STYLE_ROUNDED] = '1'
    // style[mxConstants.STYLE_IMAGE_WIDTH] = '48'
    // style[mxConstants.STYLE_IMAGE_HEIGHT] = '48'
    // style[mxConstants.STYLE_OPACITY] = '80'
    // graph.getStylesheet().putDefaultVertexStyle(style)

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
    graph.getStylesheet().putCellStyle('group', style)

    style = new Object()
    style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_RECTANGLE

    style[mxConstants.STYLE_PERIMETER] = mxPerimeter.RectanglePerimeter
    style[mxConstants.STYLE_PERIMETER_SPACING] = '6'
    style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_LEFT
    style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_MIDDLE
    style[mxConstants.STYLE_FONTSIZE] = '10'
    style[mxConstants.STYLE_FONTSTYLE] = 2
    style[mxConstants.STYLE_STROKECOLOR] = '#000000'

    graph.getStylesheet().putCellStyle('href', style)

    style = graph.getStylesheet().getDefaultEdgeStyle()
    style[mxConstants.STYLE_LABEL_BACKGROUNDCOLOR] = '#FFFFFF'
    style[mxConstants.STYLE_STROKEWIDTH] = '2'
    style[mxConstants.STYLE_ROUNDED] = true
    style[mxConstants.STYLE_EDGE] = mxEdgeStyle.OrthConnector
  }

  private setOutline = () => {
    const outln = new mxOutline(graph, this.outline)
    outln.outline.labelsVisible = true
    outln.outline.setHtmlLabels(true)
  }

  private setSidebar = () => {
    this.addHostsButton()
    this.addToolsButton()
  }

  private addHostsButton = () => {
    _.forEach(hostsMenu, menu => {
      // Creates the image which is used as the hostsContainer icon (drag source)
      const rowElement = document.createElement('div')
      rowElement.classList.add('hosts-table--tr')

      const hostElement = document.createElement('div')
      hostElement.classList.add('hosts-table--td')

      const span = document.createElement('span')
      span.style.fontSize = '14px'
      span.textContent = menu.name

      hostElement.appendChild(span)
      rowElement.appendChild(hostElement)

      this.addSidebarButton(graph, this.hosts, menu, rowElement)
    })
  }

  private addToolsButton = () => {
    _.forEach(toolsMenu, menu => {
      // Creates the image which is used as the sidebar icon (drag source)
      const icon = document.createElement('div')
      icon.classList.add('tool-instance')
      icon.classList.add(`mxgraph-cell--icon`)
      icon.classList.add(`mxgraph-cell--icon-${menu.type.toLowerCase()}`)

      this.addSidebarButton(
        graph,
        this.tools,
        menu,
        icon,
        `mxgraph-cell--icon-${menu.type.toLowerCase()}`
      )
    })
  }

  private addSidebarButton(
    graph: mxGraphType,
    sideBarArea: HTMLElement,
    node: Node,
    icon: HTMLDivElement,
    iconClassName = 'mxgraph-cell--icon-server'
  ) {
    sideBarArea.appendChild(icon)

    const dragElt = document.createElement('div')
    dragElt.style.border = 'dashed white 1px'
    dragElt.style.width = `${CELL_SIZE_WIDTH}px`
    dragElt.style.height = `${CELL_SIZE_HEIGHT}px`

    // Creates the image which is used as the drag icon (preview)
    const ds = mxUtils.makeDraggable(
      icon,
      graph,
      this.dragCell(node, iconClassName),
      dragElt,
      0,
      0,
      true,
      true
    )

    ds.setGuidesEnabled(true)
  }

  // Function that is executed when the image is dropped on
  // the graph. The cell argument points to the cell under
  private dragCell = (node: Node, iconClassName: string) => (
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
      // NOTE: For non-HTML labels the image must be displayed via the style
      // rather than the label markup, so use 'image=' + image for the style.
      // as follows: v1 = graph.insertVertex(parent, null, label,
      // pt.x, pt.y, 120, 120, 'image=' + image);
      const vertex = document.createElement('div')
      vertex.classList.add('vertex')
      vertex.setAttribute('data-name', node.name)
      vertex.setAttribute('data-label', node.label)
      vertex.setAttribute('data-href', node.href)
      vertex.setAttribute('data-type', node.type)

      const vertexLabelBox = document.createElement('div')
      vertexLabelBox.classList.add('mxgraph-cell--title')

      const vertexLabel = document.createElement('strong')
      vertexLabel.textContent = node.label

      vertexLabelBox.appendChild(vertexLabel)

      const vertexIconBox = document.createElement('div')
      const vertexIcon = document.createElement('div')
      vertexIcon.classList.add('mxgraph-cell--icon')
      vertexIcon.classList.add('mxgraph-cell--icon-box')
      vertexIcon.classList.add(iconClassName)

      vertexIconBox.appendChild(vertexIcon)

      vertex.appendChild(vertexLabelBox)
      vertex.appendChild(vertexIconBox)

      v1 = graph.insertVertex(
        parent,
        null,
        vertex.outerHTML,
        x,
        y,
        CELL_SIZE_WIDTH,
        CELL_SIZE_HEIGHT
      )

      v1.setConnectable(true)

      // Presets the collapsed size
      v1.geometry.alternateBounds = new mxRectangle(0, 0, CELL_SIZE_WIDTH, 40)

      // Adds the ports at various relative locations
      const linkBox = document.createElement('div')
      linkBox.classList.add('vertex')
      linkBox.style.display = 'flex'
      linkBox.style.alignItems = 'center'
      linkBox.style.justifyContent = 'center'
      linkBox.style.width = '24px'
      linkBox.style.height = '24px'
      linkBox.style.marginLeft = '-2px'

      const link = document.createElement('a')
      link.setAttribute('href', '')
      link.setAttribute('target', '_blank')

      const img = document.createElement('img')
      img.setAttribute('src', linkImg)
      img.style.width = '16px'
      img.style.height = '16px'

      link.appendChild(img)
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
      href.geometry.offset = new mxPoint(-16, -8)
      href.setConnectable(false)
    } finally {
      model.endUpdate()
    }

    graph.setSelectionCell(v1)
  }

  private setToolbar = () => {
    _.forEach(toolbarMenu, menu => {
      const {actionName, label, icon, isTransparent} = menu
      this.addToolbarButton({
        editor: editor,
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

    if (icon != null) {
      const span = document.createElement('span')
      span.classList.add('button-icon')
      span.classList.add('icon')
      span.classList.add(icon)
      button.appendChild(span)
    }

    if (isTransparent) {
      button.style.background = 'transparent'
      button.style.color = '#FFFFFF'
      button.style.border = 'none'
    }

    mxEvent.addListener(button, 'click', function() {
      editor.execute(action)
    })

    toolbar.appendChild(button)
  }

  private showModalWindow = (
    graph: mxGraphType,
    title: string,
    content: HTMLTextAreaElement,
    width: number,
    height: number
  ) => {
    const background = document.createElement('div')
    background.style.position = 'absolute'
    background.style.left = '0px'
    background.style.top = '0px'
    background.style.right = '0px'
    background.style.bottom = '0px'
    background.style.background = 'black'

    mxUtils.setOpacity(background, 50)
    this.container.appendChild(background)

    if (mxClient.IS_IE) {
      new mxDivResizer(background)
    }

    const x = Math.max(0, document.body.scrollWidth / 2 - width / 2)
    const y = Math.max(
      10,
      (document.body.scrollHeight || document.documentElement.scrollHeight) /
        2 -
        (height * 2) / 3
    )
    const wnd = new mxWindow(title, content, x, y, width, height, false, true)
    wnd.setClosable(true)

    // Fades the background out after after the window has been closed
    wnd.addListener(mxEvent.DESTROY, () => {
      graph.setEnabled(true)
      mxEffects.fadeOut(background, 50, true, 10, 30, true)
    })

    graph.setEnabled(false)
    graph.tooltipHandler.hide()
    wnd.setVisible(true)
  }

  // Trigger graph refresh when mxgraph's model update
  private graphUpdate = () => {
    graph.getModel().beginUpdate()
    try {
    } finally {
      graph.getModel().endUpdate()
      graph.refresh()
    }
  }

  // Creates the textfield for the given property.
  private createTextField = (
    graph: mxGraphType,
    form: mxFormType,
    cell: mxCellType,
    attribute: any
  ) => {
    const nodeName = _.upperFirst(attribute.nodeName.replace('data-', ''))

    const input = form.addText(nodeName + ':', attribute.nodeValue, 'text')

    const applyHandler = () => {
      const parser = new DOMParser()
      const doc = parser.parseFromString(cell.value, 'text/html')
      const vertex = doc.querySelector('.vertex')

      const newValue = input.value || ''
      const oldValue = vertex.getAttribute(attribute.nodeName) || ''

      if (newValue != oldValue) {
        graph.getModel().beginUpdate()

        try {
          const strong = vertex.querySelector('strong')
          if (strong && attribute.nodeName === 'data-label') {
            strong.textContent = newValue
            cell.setValue(vertex.outerHTML)
            return
          }

          if (attribute.nodeName === 'data-name') {
            vertex.setAttribute(attribute.nodeName, newValue)
            cell.setValue(vertex.outerHTML)
            return
          }

          if (attribute.nodeName === 'data-href') {
            if (cell.children) {
              const childrenCell = cell.getChildAt(0)
              if (childrenCell.style === 'href') {
                const parser = new DOMParser()
                const cellDoc = parser.parseFromString(cell.value, 'text/html')
                const childrenDoc = parser.parseFromString(
                  childrenCell.value,
                  'text/html'
                )

                const cellVertex = cellDoc.querySelector('.vertex')
                cellVertex.setAttribute('data-href', newValue)
                cell.setValue(cellVertex.outerHTML)

                const childrenVertex = childrenDoc.querySelector('.vertex')
                const childrenlink = childrenVertex.querySelector('a')

                childrenlink.setAttribute('href', newValue)
                childrenCell.setValue(childrenVertex.outerHTML)
                return
              }
            }
          }
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
        // Needs to take shift into account for textareas
        if (event.key === 'Enter' && !mxEvent.isShiftDown(event)) {
          input.blur()
        }
      }
    )

    if (mxClient.IS_IE) {
      mxEvent.addListener(input, 'focusout', applyHandler)
    } else {
      // Note: Known problem is the blurring of fields in
      // Firefox by changing the selection, in which case
      // no event is fired in FF and the change is lost.
      // As a workaround you should use a local variable
      // that stores the focused field and invoke blur
      // explicitely where we do the graph.focus above.
      mxEvent.addListener(input, 'blur', applyHandler)
    }
  }

  // ThreeSizer's divide handler
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
    const {sidebarProportions, hostList} = this.state
    const [topSize, middleSize, bottomSize] = sidebarProportions

    return [
      {
        name: 'Host',
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
    return (
      <div id="containerWrapper">
        {!mxClient.isBrowserSupported() ? (
          <>this Browser Not Supported</>
        ) : (
          <Threesizer
            orientation={HANDLE_VERTICAL}
            divisions={this.threesizerDivisions}
            onResize={this.handleResize('screenProportions')}
          />
        )}
      </div>
    )
  }
}

export default connect(null, null)(InventoryTopology)
