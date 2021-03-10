import React, {createRef, PureComponent} from 'react'
import {connect} from 'react-redux'
import {
  default as mx,
  mxGraph,
  mxEditor,
  mxCell,
  mxForm,
  mxMouseEvent,
  mxGraphModel,
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

  // Creates a wrapper editor with a graph inside the given container.
  // The editor is used to create certain functionality for the
  // graph, such as the rubberband selection, but most parts
  // of the UI are custom in this example.
  private mx = mx()
  private editor: mxEditor = null
  private graph: mxGraph = null

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
    const {mxEditor, mxGraph} = this.mx

    this.editor = new mxEditor()
    this.graph = this.editor.graph

    this.container = this.containerRef.current
    this.outline = this.outlineRef.current
    this.hosts = this.sidebarHostsRef.current
    this.tools = this.sidebarToolsRef.current
    this.properties = this.sidebarPropertiesRef.current
    this.toolbar = this.toolbarRef.current
  }

  // Implements a global current style for edges and vertices that is applied to new cells
  private insertHandler = (
    cells: mxCell[],
    asText?: string,
    model?: mxGraphModel
  ) => {
    const {mxUtils} = this.mx
    const graph = this.graph
    model = model ? model : graph.getModel()

    model.beginUpdate()
    try {
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]

        // Applies the current style to the cell
        const isEdge = model.isEdge(cell)
        if (isEdge) {
          const doc = mxUtils.createXmlDocument()
          const edge = doc.createElement('Edge')

          edge.setAttribute('label', 'edge')
          cell.setValue(edge)
        }
      }
    } finally {
      model.endUpdate()
    }
  }

  private configureEditor = () => {
    const {
      mxGuide,
      mxDivResizer,
      mxEdgeHandler,
      mxEvent,
      mxGraphHandler,
      mxConstants,
      mxUtils,
      mxClient,
      mxImage,
      mxCell,
      mxGeometry,
      mxCellState,
      mxRubberband,
      mxForm,
      mxGraph,
    } = this.mx

    const editor = this.editor
    const graph = this.graph
    const _this = this

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
    graph.connectionHandler.getConnectImage = state => {
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

    // Overrides method to store a cell label in the model
    const cellLabelChanged = graph.cellLabelChanged
    graph.cellLabelChanged = (cell, newValue, autoSize) => {
      if (mxUtils.isNode(cell.value, cell.value.nodeName)) {
        // Clones the value for correct undo/redo
        const elt = cell.value.cloneNode(true)
        elt.setAttribute('label', newValue)

        newValue = elt

        cellLabelChanged.apply(graph, [cell, newValue, autoSize])
      }
    }

    // @ts-ignore Overrides method to create the editing value
    const getEditingValue = graph.getEditingValue
    graph.getEditingValue = cell => {
      if (mxUtils.isNode(cell.value, cell.value.nodeName)) {
        const label = cell.getAttribute('label', '')

        return label
      }
    }

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
      const doc = mxUtils.createXmlDocument()
      const groupCell = doc.createElement('Group')

      groupCell.setAttribute('label', 'Group')

      // const group = new mxCell(groupCell, new mxGeometry(), 'group')

      group.setValue(groupCell)
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
    graph.isTableRow = function(cell: mxCell) {
      return (
        this.model.isVertex(cell) && this.isTable(this.model.getParent(cell))
      )
    }

    // Disables drag-and-drop into non-swimlanes.
    graph.isValidDropTarget = function(cell) {
      return this.isSwimlane(cell)
    }

    // Disables drilling into non-swimlanes.
    graph.isValidRoot = function(cell) {
      return this.isValidDropTarget(cell)
    }

    // Does not allow selection of locked cells
    graph.isCellSelectable = function(cell) {
      return !this.isCellLocked(cell)
    }

    // Enables new connections
    graph.setConnectable(true)

    // Returns a shorter label if the cell is collapsed and no
    // label for expanded groups
    graph.getLabel = function(cell) {
      let tmp = _this.mx.mxGraph.prototype.getLabel.apply(this, arguments) // "supercall"

      if (this.isCellLocked(cell)) {
        // Returns an empty label but makes sure an HTML
        // element is created for the label (for event
        // processing wrt the parent label)
        return ''
      } else if (this.isCellCollapsed(cell)) {
        const index = tmp.indexOf('</div>')
        if (index > 0) {
          tmp = tmp.substring(0, index + 5)
        }
      }
      return tmp
    }

    //   return new mxCellState(graph.view, edge, graph.getCellStyle(edge))
    // }

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
        const labelValue = cell.getAttribute('label', '')
        return labelValue
      }

      return ''
    }

    // Implements a properties panel that uses
    // mxCellAttributeChange to change properties
    graph.getSelectionModel().addListener(mxEvent.CHANGE, () => {
      this.selectionChanged(graph)
    })
  }

  private selectionChanged = (graph: mxGraph) => {
    const {mxForm} = this.mx
    const cell = graph.getSelectionCell()
    const form = new mxForm('inventory-topology--mxform')

    if (cell) {
      const attrs = cell.value?.attributes

      this.properties.innerHTML = ''

      if (attrs) {
        for (let i = 0; i < attrs.length; i++) {
          this.createTextField(graph, form, cell, attrs[i])
        }
      }

      this.properties.appendChild(form.getTable())
    }
  }

  // Register an action in the editor
  private setActionInEditor = () => {
    const {mxCodec, mxUtils} = this.mx
    const editor = this.editor
    const graph = this.graph

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
    editor.addAction('export', (editor: mxEditor) => {
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
    const {mxConstants, mxPerimeter, mxEdgeStyle} = this.mx
    const graph = this.graph

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
    style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_IMAGE
    style[mxConstants.STYLE_FONTCOLOR] = '#774400'
    style[mxConstants.STYLE_PERIMETER] = mxPerimeter.RectanglePerimeter
    style[mxConstants.STYLE_PERIMETER_SPACING] = '6'
    style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_LEFT
    style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_MIDDLE
    style[mxConstants.STYLE_FONTSIZE] = '10'
    style[mxConstants.STYLE_FONTSTYLE] = 2
    style[mxConstants.STYLE_IMAGE_WIDTH] = '16'
    style[mxConstants.STYLE_IMAGE_HEIGHT] = '16'
    graph.getStylesheet().putCellStyle('port', style)

    style = graph.getStylesheet().getDefaultEdgeStyle()
    style[mxConstants.STYLE_LABEL_BACKGROUNDCOLOR] = '#FFFFFF'
    style[mxConstants.STYLE_STROKEWIDTH] = '2'
    style[mxConstants.STYLE_ROUNDED] = true
    style[mxConstants.STYLE_EDGE] = mxEdgeStyle.OrthConnector
  }

  private setOutline = () => {
    const {mxOutline} = this.mx

    const outln = new mxOutline(this.graph, this.outline)
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

      this.addSidebarButton(this.graph, this.hosts, menu, rowElement)
    })
  }

  private addToolsButton = () => {
    _.forEach(toolsMenu, menu => {
      // Creates the image which is used as the sidebar icon (drag source)
      const icon = document.createElement('div')
      icon.classList.add('tool-instance')
      icon.classList.add(`mxgraph-cell--icon`)
      icon.classList.add(`mxgraph-cell--icon-${menu.type.toLowerCase()}`)

      this.addSidebarButton(this.graph, this.tools, menu, icon)
    })
  }

  private addSidebarButton(
    graph: mxGraph,
    sideBarArea: HTMLDivElement,
    node: any,
    icon: HTMLDivElement
  ) {
    const {mxUtils} = this.mx

    sideBarArea.appendChild(icon)

    const dragElt = document.createElement('div')
    dragElt.style.border = 'dashed white 1px'
    dragElt.style.width = `${CELL_SIZE_WIDTH}px`
    dragElt.style.height = `${CELL_SIZE_HEIGHT}px`

    // Creates the image which is used as the drag icon (preview)
    const ds = mxUtils.makeDraggable(
      icon,
      graph,
      this.dragCell(node),
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
  private dragCell = (node: Node) => (
    graph: mxGraph,
    _event: Event,
    _cell: mxCell,
    x: number,
    y: number
  ) => {
    const {mxUtils, mxRectangle, mxPoint} = this.mx

    const parent = graph.getDefaultParent()
    const model = graph.getModel()
    let v1 = null

    model.beginUpdate()
    try {
      // NOTE: For non-HTML labels the image must be displayed via the style
      // rather than the label markup, so use 'image=' + image for the style.
      // as follows: v1 = graph.insertVertex(parent, null, label,
      // pt.x, pt.y, 120, 120, 'image=' + image);
      const doc = mxUtils.createXmlDocument()
      const userCell = doc.createElement(node.type)

      userCell.setAttribute('name', node.name)
      userCell.setAttribute('label', node.label)
      userCell.setAttribute('type', node.type)

      v1 = graph.insertVertex(
        parent,
        null,
        userCell,
        x,
        y,
        CELL_SIZE_WIDTH,
        CELL_SIZE_HEIGHT
      )
      // // Adds the ports at various relative locations
      // var port = graph.insertVertex(
      //   v1,
      //   null,
      //   'Trigger',
      //   0,
      //   0.25,
      //   16,
      //   16,
      //   'port;image=editors/images/overlays/flash.png;align=right;imageAlign=right;spacingRight=18',
      //   true
      // )
      // port.geometry.offset = new mxPoint(1, 0)

      v1.setConnectable(true)

      // Presets the collapsed size
      v1.geometry.alternateBounds = new mxRectangle(0, 0, CELL_SIZE_WIDTH, 40)
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
    editor: mxEditor
    toolbar: HTMLElement
    action: string
    label: string
    icon: string
    isTransparent?: boolean
  }) => {
    const {mxEvent} = this.mx

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
    graph: mxGraph,
    title: string,
    content: HTMLTextAreaElement,
    width: number,
    height: number
  ) => {
    const {
      mxUtils,
      mxClient,
      mxDivResizer,
      mxWindow,
      mxEffects,
      mxEvent,
    } = this.mx

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
    this.graph.getModel().beginUpdate()
    try {
    } finally {
      this.graph.getModel().endUpdate()
      this.graph.refresh()
    }
  }

  // Creates the textfield for the given property.
  private createTextField = (
    graph: mxGraph,
    form: mxForm,
    cell: mxCell,
    attribute: any
  ) => {
    const {mxEvent, mxClient} = this.mx

    const input = form.addText(
      attribute.nodeName + ':',
      attribute.nodeValue,
      'text'
    )

    const applyHandler = () => {
      const newValue = input.value || ''
      const oldValue = cell.getAttribute(attribute.nodeName, '')

      if (newValue != oldValue) {
        graph.getModel().beginUpdate()

        try {
          cell.setAttribute(attribute.nodeName, newValue)
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
        {!this.mx.mxClient.isBrowserSupported() ? (
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
