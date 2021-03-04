import React, {createRef, PureComponent} from 'react'
import {connect} from 'react-redux'
import {
  default as mx,
  mxGraph,
  mxEditor,
  mxCell,
  mxUtils,
  mxGraphHandler,
  mxGuide,
  mxEvent,
  mxEdgeHandler,
  mxClient,
  mxDivResizer,
  mxConstants,
  mxForm,
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
import {toolbarCommandObject} from 'src/hosts/constants/tools'

// Types
import {Host} from 'src/types'

// error
import {ErrorHandling} from 'src/shared/decorators/errors'

// css
// import 'mxgraph/javascript/src/css/common.css'

// Config
const keyhandlerCommons = require('src/hosts/config/keyhandler-commons.xml')

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

  private hostsRef = createRef<HTMLDivElement>()
  private sidebarRef = createRef<HTMLDivElement>()
  private propertiesRef = createRef<HTMLDivElement>()

  private container: HTMLDivElement = null
  private outline: HTMLDivElement = null
  private toolbar: HTMLDivElement = null

  private hosts: HTMLDivElement = null
  private sidebar: HTMLDivElement = null
  private properties: HTMLDivElement = null

  constructor(props: Props) {
    super(props)

    this.state = {
      screenProportions: [0.3, 0.7],
      sidebarProportions: [0.333, 0.333, 0.333],
      hostList: null,
    }
  }

  public handleResize = (fieldName: string) => (proportions: number[]) => {
    this.setState((prevState: State) => ({
      ...prevState,
      [fieldName]: proportions,
    }))
  }

  public componentDidMount() {
    this.setting()
    this.topologyEditor()

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

  render() {
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

  private graphUpdate = () => {
    this.graph.getModel().beginUpdate()
    try {
    } finally {
      this.graph.getModel().endUpdate()
      this.graph.refresh()
    }
  }

  //Creates the textfield for the given property.
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

  private addHostIcon(
    graph: mxGraph,
    hostsContainer: HTMLDivElement,
    host: any
  ) {
    const {mxUtils, mxEvent, mxForm, mxRectangle} = this.mx

    // Function that is executed when the image is dropped on
    // the graph. The cell argument points to the cell under
    const funct = (
      graph: mxGraph,
      _event: Event,
      _cell: mxCell,
      x: number,
      y: number
    ) => {
      // the mousepointer if there is one.
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
        const userCell = doc.createElement('Node')
        userCell.setAttribute('name', host)
        userCell.setAttribute('type', 'server')

        v1 = graph.insertVertex(parent, null, userCell, x, y, 120, 120)
        v1.setConnectable(true)

        // Presets the collapsed size
        v1.geometry.alternateBounds = new mxRectangle(0, 0, 120, 40)
      } finally {
        model.endUpdate()
      }

      graph.setSelectionCell(v1)
    }

    // Implements a properties panel that uses
    // mxCellAttributeChange to change properties
    graph
      .getSelectionModel() // @ts-ignore
      .addListener(mxEvent.CHANGE, (sender, evt) => {
        selectionChanged(graph)
      })

    const selectionChanged = (graph: mxGraph) => {
      const cell = graph.getSelectionCell()
      this.properties.innerHTML = ''

      if (cell != null) {
        const form = new mxForm('inventory-topology--mxform')
        const attrs = cell.value.attributes
        if (attrs) {
          for (let i = 0; i < attrs.length; i++) {
            this.createTextField(graph, form, cell, attrs[i])
          }
        }

        this.properties.appendChild(form.getTable())
        // this.mxUtils.br(this.properties, 0)
      }
    }

    // create div

    const rowElement = document.createElement('div')
    rowElement.classList.add('hosts-table--tr')

    const hostElement = document.createElement('div')
    hostElement.classList.add('hosts-table--td')

    // Creates the image which is used as the hostsContainer icon (drag source)
    const span = document.createElement('span')
    span.textContent = host
    span.style.fontSize = '14px'
    rowElement.appendChild(hostElement)
    rowElement.appendChild(span)
    hostsContainer.appendChild(rowElement)

    const dragElt = document.createElement('div')
    dragElt.style.border = 'dashed black 1px'
    dragElt.style.width = '120px'
    dragElt.style.height = '120px'

    // Creates the image which is used as the drag icon (preview)
    const ds = mxUtils.makeDraggable(
      rowElement,
      graph,
      funct,
      dragElt,
      0,
      0,
      true,
      true
    )
    ds.setGuidesEnabled(true)
  }

  private addHostButton() {
    const hosts = ['a', 'b', 'c', 'd', 'e']
    _.forEach(hosts, host => {
      this.addHostIcon(this.graph, this.hosts, host)
    })
  }

  private addSidebarIcon(graph: mxGraph, sidebar: HTMLDivElement, node: any) {
    const {mxUtils, mxRectangle, mxForm, mxEvent} = this.mx

    // Function that is executed when the image is dropped on
    // the graph. The cell argument points to the cell under
    const funct = (
      graph: mxGraph,
      _event: Event,
      _cell: mxCell,
      x: number,
      y: number
    ) => {
      // the mousepointer if there is one.
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

        _.forEach(_.keys(node), n => {
          userCell.setAttribute(n, node[n])
        })

        v1 = graph.insertVertex(parent, null, userCell, x, y, 120, 120)
        v1.setConnectable(true)

        // Presets the collapsed size
        v1.geometry.alternateBounds = new mxRectangle(0, 0, 120, 40)
      } finally {
        model.endUpdate()
      }

      graph.setSelectionCell(v1)
    }

    // Implements a properties panel that uses
    // mxCellAttributeChange to change properties
    graph
      .getSelectionModel() // @ts-ignore
      .addListener(mxEvent.CHANGE, (sender, evt) => {
        selectionChanged(graph)
      })

    const selectionChanged = (graph: mxGraph) => {
      const cell = graph.getSelectionCell()
      this.properties.innerHTML = ''

      if (cell) {
        const form = new mxForm('inventory-topology--mxform')
        const attrs = cell.value.attributes
        if (attrs) {
          for (let i = 0; i < attrs.length; i++) {
            this.createTextField(graph, form, cell, attrs[i])
          }
        }

        this.properties.appendChild(form.getTable())
      }
    }

    // Creates the image which is used as the sidebar icon (drag source)

    const div = document.createElement('div')
    div.classList.add('tool-instance')
    div.classList.add(`mxgraph--icon`)
    div.classList.add(`mxgraph--icon-${node.type.toLowerCase()}`)

    sidebar.appendChild(div)

    const dragElt = document.createElement('div')
    dragElt.style.border = 'dashed black 1px'
    dragElt.style.width = '120px'
    dragElt.style.height = '120px'

    // Creates the image which is used as the drag icon (preview)
    const ds = mxUtils.makeDraggable(
      div,
      graph,
      funct,
      dragElt,
      0,
      0,
      true,
      true
    )
    ds.setGuidesEnabled(true)
  }

  private addToolbarButton = () => {
    const toolbarIcons = toolbarCommandObject

    _.forEach(toolbarIcons, item => {
      const {actionName, label, icon, isTransparent} = item
      this.addToolbarIcon({
        editor: this.editor,
        toolbar: this.toolbar,
        action: actionName,
        label,
        icon,
        isTransparent,
      })
    })
  }

  private addToolbarIcon = ({
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

  private addSidebarButton = () => {
    const tools = [
      {
        node: {
          type: 'Server',
        },
      },
      {
        node: {
          type: 'Database',
        },
      },
      {
        node: {
          type: 'Internet',
        },
      },
      {
        node: {
          type: 'Workstation',
        },
      },
      {
        node: {
          type: 'VirtualMachine',
        },
      },
      {
        node: {
          type: 'Email',
        },
      },
      {
        node: {
          type: 'Firewall',
        },
      },
      {
        node: {
          type: 'Router',
        },
      },
      {
        node: {
          type: 'WirelessRouter',
        },
      },
    ]

    _.forEach(tools, tool => {
      const {node} = tool
      this.addSidebarIcon(this.graph, this.sidebar, node)
    })
  }

  private topologyEditor = () => {
    const graph = this.graph

    const {mxOutline} = this.mx

    this.addEditorAction()
    this.configureStylesheet()
    this.addHostButton()
    this.addSidebarButton()
    this.addToolbarButton()

    // To show the images in the outline, uncomment the following code
    const outln = new mxOutline(graph, this.outline)

    // To show the images in the outline, uncomment the following code
    outln.outline.labelsVisible = true
    outln.outline.setHtmlLabels(true)
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
              <TableBody>{<div ref={this.hostsRef} />}</TableBody>
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
            <div ref={this.sidebarRef} className={'tool-box'} />
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
                {<div ref={this.propertiesRef} />}
              </FancyScrollbar>
            </>
          )
        },
      },
    ]
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

  // Initialize
  private setting = () => {
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
      mxCell,
      mxGeometry,
    } = this.mx

    this.editor = new mxEditor()
    this.graph = this.editor.graph

    this.container = this.containerRef.current
    this.outline = this.outlineRef.current
    this.hosts = this.hostsRef.current
    this.sidebar = this.sidebarRef.current
    this.properties = this.propertiesRef.current
    this.toolbar = this.toolbarRef.current

    const _this = this

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

    // Workaround for Internet Explorer ignoring certain CSS directives
    if (mxClient.IS_QUIRKS) {
      document.body.style.overflow = 'hidden'
      new mxDivResizer(this.container)
      new mxDivResizer(this.outline)
      new mxDivResizer(this.toolbar)
      new mxDivResizer(this.sidebar)
    }

    // Disable highlight of cells when dragging from toolbar
    this.graph.setDropEnabled(false)

    // Uses the port icon while connections are previewed
    this.graph.connectionHandler.getConnectImage = state => {
      return new mxImage(state.style[mxConstants.STYLE_IMAGE], 16, 16)
    }

    // Centers the port icon on the target port
    this.graph.connectionHandler.targetConnectImage = true

    // Does not allow dangling edges
    this.graph.setAllowDanglingEdges(false)

    // Sets the graph container and configures the editor
    this.editor.setGraphContainer(this.container)
    const config = mxUtils.load(keyhandlerCommons).getDocumentElement()
    this.editor.configure(config)

    // Defines the default group to be used for grouping. The
    // default group is a field in the mxEditor instance that
    // is supposed to be a cell which is cloned for new cells.
    // The groupBorderSize is used to define the spacing between
    // the children of a group and the group bounds.
    const group = new mxCell('Group', new mxGeometry(), 'group')
    group.setVertex(true)
    group.setConnectable(false)
    this.editor.defaultGroup = group
    this.editor.groupBorderSize = 20

    // Disables drag-and-drop into non-swimlanes.
    this.graph.isValidDropTarget = function(cell) {
      return this.isSwimlane(cell)
    }

    // Disables drilling into non-swimlanes.
    this.graph.isValidRoot = function(cell) {
      return this.isValidDropTarget(cell)
    }

    // Does not allow selection of locked cells
    this.graph.isCellSelectable = function(cell) {
      return !this.isCellLocked(cell)
    }

    // Enables new connections
    this.graph.setConnectable(true)

    // Returns a shorter label if the cell is collapsed and no
    // label for expanded groups

    this.graph.getLabel = function(cell) {
      var tmp = _this.mx.mxGraph.prototype.getLabel.apply(this, arguments) // "supercall"

      if (this.isCellLocked(cell)) {
        // Returns an empty label but makes sure an HTML
        // element is created for the label (for event
        // processing wrt the parent label)
        return ''
      } else if (this.isCellCollapsed(cell)) {
        var index = tmp.indexOf('</h1>')

        if (index > 0) {
          tmp = tmp.substring(0, index + 5)
        }
      }

      return tmp
    }

    // Connect Preview
    this.graph.connectionHandler.createEdgeState = function() {
      var edge = this.graph.createEdge(
        null,
        null,
        null,
        null,
        null,
        'edgeStyle=orthogonalEdgeStyle'
      )

      return new _this.mx.mxCellState(
        this.graph.view,
        edge,
        this.graph.getCellStyle(edge)
      )
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
    this.graph.isHtmlLabel = function(cell) {
      return !this.isSwimlane(cell)
    }

    // Overrides method to provide a cell label in the display
    this.graph.convertValueToString = cell => {
      if (cell) {
        const type: string = cell.getAttribute('type', '')
        if (type) {
          const htmlDiv = document.createElement('div')
          htmlDiv.classList.add('graph-instance')
          htmlDiv.classList.add('mxgraph--icon')
          htmlDiv.classList.add(`mxgraph--icon-${type.toLowerCase()}`)

          return htmlDiv.outerHTML
        }
      }

      return ''
    }
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

    // NOTE: Alternative vertex style for non-HTML labels should be as
    // follows. This repaces the above style for HTML labels.
    /*var style = new Object();
			style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_LABEL;
			style[mxConstants.STYLE_PERIMETER] = mxPerimeter.RectanglePerimeter;
			style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_TOP;
			style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_CENTER;
			style[mxConstants.STYLE_IMAGE_ALIGN] = mxConstants.ALIGN_CENTER;
			style[mxConstants.STYLE_IMAGE_VERTICAL_ALIGN] = mxConstants.ALIGN_TOP;
			style[mxConstants.STYLE_SPACING_TOP] = '56';
			style[mxConstants.STYLE_GRADIENTCOLOR] = '#7d85df';
			style[mxConstants.STYLE_STROKECOLOR] = '#5d65df';
			style[mxConstants.STYLE_FILLCOLOR] = '#adc5ff';
			style[mxConstants.STYLE_FONTCOLOR] = '#1d258f';
			style[mxConstants.STYLE_FONTFAMILY] = 'Verdana';
			style[mxConstants.STYLE_FONTSIZE] = '12';
			style[mxConstants.STYLE_FONTSTYLE] = '1';
			style[mxConstants.STYLE_ROUNDED] = '1';
			style[mxConstants.STYLE_IMAGE_WIDTH] = '48';
			style[mxConstants.STYLE_IMAGE_HEIGHT] = '48';
			style[mxConstants.STYLE_OPACITY] = '80';
			graph.getStylesheet().putDefaultVertexStyle(style);*/

    style = new Object()
    style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_SWIMLANE
    style[mxConstants.STYLE_PERIMETER] = mxPerimeter.RectanglePerimeter
    style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_CENTER
    style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_TOP
    // style[mxConstants.STYLE_FILLCOLOR] = '#FF9103'
    // style[mxConstants.STYLE_GRADIENTCOLOR] = '#F8C48B'
    style[mxConstants.STYLE_STROKECOLOR] = '#E86A00'
    style[mxConstants.STYLE_FONTCOLOR] = '#000000'
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

  // Add Editor Action
  private addEditorAction = () => {
    const editor = this.editor
    const graph = this.graph
    const {mxCodec, mxUtils} = this.mx

    // Defines a new action for deleting or ungrouping
    editor.addAction('groupOrUngroup', function(
      editor: mxEditor,
      cell: mxCell
    ) {
      cell = cell || editor.graph.getSelectionCell()
      if (cell != null && editor.graph.isSwimlane(cell)) {
        editor.execute('ungroup', cell)
      } else {
        editor.execute('group')
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
}

export default connect(null, null)(InventoryTopology)
