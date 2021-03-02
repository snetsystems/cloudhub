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
import 'mxgraph/javascript/src/css/common.css'

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
  private mxUtils: typeof mxUtils = null
  private mxConstants: typeof mxConstants = null
  private mxGraphHandler: typeof mxGraphHandler = null
  private mxGuide: typeof mxGuide = null
  private mxEvent: typeof mxEvent = null
  private mxEdgeHandler: typeof mxEdgeHandler = null
  private mxClient: typeof mxClient = null
  private mxDivResizer: typeof mxDivResizer = null
  private graph: mxGraph = null
  private model: mxGraphModel = null

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
      screenProportions: [0.1, 0.9],
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

    // SVG내부에서 update를 감지하여 DB로 저장(갱신)
  }

  public componentWillUnmount() {
    this.graph.destroy()
    this.graph = null

    this.editor.destroy()
    this.editor = null

    this.mx.mxEvent.DESTROY
  }

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

  private draggable = () => {}

  //Creates the textfield for the given property.
  private createTextField = (
    graph: mxGraph,
    form: mxForm,
    cell: mxCell,
    attribute: any
  ) => {
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

    this.mxEvent.addListener(
      input,
      'keypress',
      (event: KeyboardEvent & MouseEvent) => {
        // Needs to take shift into account for textareas
        if (event.key === 'Enter' && !this.mxEvent.isShiftDown(event)) {
          input.blur()
        }
      }
    )

    if (this.mxClient.IS_IE) {
      this.mxEvent.addListener(input, 'focusout', applyHandler)
    } else {
      // Note: Known problem is the blurring of fields in
      // Firefox by changing the selection, in which case
      // no event is fired in FF and the change is lost.
      // As a workaround you should use a local variable
      // that stores the focused field and invoke blur
      // explicitely where we do the graph.focus above.
      this.mxEvent.addListener(input, 'blur', applyHandler)
    }
  }

  private addHostIcon(
    graph: mxGraph,
    hostsContainer: HTMLDivElement,
    host: any,
    image: string
  ) {
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
      const model = this.model
      let v1 = null
      model.beginUpdate()
      try {
        // NOTE: For non-HTML labels the image must be displayed via the style
        // rather than the label markup, so use 'image=' + image for the style.
        // as follows: v1 = graph.insertVertex(parent, null, label,
        // pt.x, pt.y, 120, 120, 'image=' + image);
        const doc = this.mxUtils.createXmlDocument()
        const userCell = doc.createElement('Node')
        userCell.setAttribute('name', host)

        v1 = graph.insertVertex(parent, null, userCell, x, y, 120, 120)
        v1.setConnectable(true)

        // Presets the collapsed size
        v1.geometry.alternateBounds = new this.mx.mxRectangle(0, 0, 120, 40)
      } finally {
        model.endUpdate()
      }

      graph.setSelectionCell(v1)
    }

    // Implements a properties panel that uses
    // mxCellAttributeChange to change properties
    graph
      .getSelectionModel() // @ts-ignore
      .addListener(this.mxEvent.CHANGE, (sender, evt) => {
        selectionChanged(graph)
      })

    const selectionChanged = (graph: mxGraph) => {
      const cell = graph.getSelectionCell()
      this.properties.innerHTML = ''

      if (cell != null) {
        const form = new this.mx.mxForm('inventory-topology--mxform')
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
    const ds = this.mxUtils.makeDraggable(
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
      this.addHostIcon(this.graph, this.hosts, host, './')
    })
  }

  private addSidebarIcon(
    graph: mxGraph,
    sidebar: HTMLDivElement,
    node: any,
    image: string
  ) {
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
      const model = this.model
      let v1 = null
      model.beginUpdate()
      try {
        // NOTE: For non-HTML labels the image must be displayed via the style
        // rather than the label markup, so use 'image=' + image for the style.
        // as follows: v1 = graph.insertVertex(parent, null, label,
        // pt.x, pt.y, 120, 120, 'image=' + image);
        const doc = this.mxUtils.createXmlDocument()
        const userCell = doc.createElement('Node')
        _.forEach(_.keys(node), n => {
          userCell.setAttribute(n, node[n])
        })

        v1 = graph.insertVertex(parent, null, userCell, x, y, 120, 120)
        v1.setConnectable(true)

        // Presets the collapsed size
        v1.geometry.alternateBounds = new this.mx.mxRectangle(0, 0, 120, 40)
      } finally {
        model.endUpdate()
      }

      graph.setSelectionCell(v1)
    }

    // Implements a properties panel that uses
    // mxCellAttributeChange to change properties
    graph
      .getSelectionModel() // @ts-ignore
      .addListener(this.mxEvent.CHANGE, (sender, evt) => {
        selectionChanged(graph)
      })

    const selectionChanged = (graph: mxGraph) => {
      const cell = graph.getSelectionCell()
      this.properties.innerHTML = ''

      if (cell) {
        const form = new this.mx.mxForm('inventory-topology--mxform')
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
    const img = document.createElement('img')
    img.setAttribute('src', image)
    img.style.width = '48px'
    img.style.height = '48px'
    img.title = 'Drag this to the diagram to create a new vertex'
    sidebar.appendChild(img)

    const dragElt = document.createElement('div')
    dragElt.style.border = 'dashed black 1px'
    dragElt.style.width = '120px'
    dragElt.style.height = '120px'

    // Creates the image which is used as the drag icon (preview)
    const ds = this.mxUtils.makeDraggable(
      img,
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

    this.mxEvent.addListener(button, 'click', function() {
      editor.execute(action)
    })

    toolbar.appendChild(button)
  }

  private addSidebarButton = () => {
    const tools = [
      {
        node: {
          id: '0',
          type: 'Storage',
          edge: 'edge',
        },
        imgSrc: './*.png',
      },
    ]

    _.forEach(tools, tool => {
      const {node, imgSrc} = tool
      this.addSidebarIcon(this.graph, this.sidebar, node, imgSrc)
    })
  }

  private topologyEditor = () => {
    const graph = this.graph
    this.configureStylesheet()
    this.addHostButton()
    this.addSidebarButton()
    this.addToolbarButton()

    // To show the images in the outline, uncomment the following code
    const outln = new this.mx.mxOutline(graph, this.outline)

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
              <TableBody>{<div ref={this.hostsRef}></div>}</TableBody>
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
        render: () => <div ref={this.sidebarRef}></div>,
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
                {<div ref={this.propertiesRef}></div>}
              </FancyScrollbar>
            </>
          )
          // return <Properties />
        },
      },
    ]
  }

  private get threesizerDivisions() {
    const {screenProportions} = this.state
    const [leftSize, rightSize] = screenProportions

    // 함수가 실행될 곳

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
    } = this.mx

    this.editor = new mxEditor()
    this.mxUtils = mxUtils
    this.mxConstants = mxConstants
    this.mxGraphHandler = mxGraphHandler
    this.mxGuide = mxGuide
    this.mxEvent = mxEvent
    this.mxEdgeHandler = mxEdgeHandler
    this.mxClient = mxClient
    this.mxDivResizer = mxDivResizer

    this.graph = this.editor.graph
    this.model = this.graph.getModel()

    this.addEditorAction(this.editor, this.graph)

    this.container = this.containerRef.current
    this.outline = this.outlineRef.current
    this.hosts = this.hostsRef.current
    this.sidebar = this.sidebarRef.current
    this.properties = this.propertiesRef.current
    this.toolbar = this.toolbarRef.current

    // Assigns some global constants for general behaviour, eg. minimum
    // size (in pixels) of the active region for triggering creation of
    // new connections, the portion (100%) of the cell area to be used
    // for triggering new connections, as well as some fading options for
    // windows and the rubberband selection.
    this.mxConstants.MIN_HOTSPOT_SIZE = 16
    this.mxConstants.DEFAULT_HOTSPOT = 1

    // Enables guides
    this.mxGraphHandler.prototype.guidesEnabled = true

    // Alt disables guides
    this.mxGuide.prototype.isEnabledForEvent = (evt: MouseEvent) => {
      return !this.mxEvent.isAltDown(evt)
    }

    // Enables snapping waypoints to terminals
    this.mxEdgeHandler.prototype.snapToTerminals = true

    // Workaround for Internet Explorer ignoring certain CSS directives
    if (this.mxClient.IS_QUIRKS) {
      document.body.style.overflow = 'hidden'
      new this.mxDivResizer(this.container)
      new this.mxDivResizer(this.outline)
      // new this.mxDivResizer(toolbar)
      new this.mxDivResizer(this.sidebar)
      // new this.mxDivResizer(status)
    }

    // Disable highlight of cells when dragging from toolbar
    this.graph.setDropEnabled(false)

    // Uses the port icon while connections are previewed
    this.graph.connectionHandler.getConnectImage = state => {
      return new this.mx.mxImage(
        state.style[this.mxConstants.STYLE_IMAGE],
        16,
        16
      )
    }

    // Centers the port icon on the target port
    this.graph.connectionHandler.targetConnectImage = true

    // Does not allow dangling edges
    this.graph.setAllowDanglingEdges(false)

    // Sets the graph container and configures the editor
    this.editor.setGraphContainer(this.container)
    // const config = this.mxUtils
    //   .load('/config/keyhandler-commons.xml')
    //   .getDocumentElement()
    // this.editor.configure(config)

    // Defines the default group to be used for grouping. The
    // default group is a field in the mxEditor instance that
    // is supposed to be a cell which is cloned for new cells.
    // The groupBorderSize is used to define the spacing between
    // the children of a group and the group bounds.
    const group = new this.mx.mxCell('Group', new this.mx.mxGeometry(), 'group')
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

    // Overrides method to provide a cell label in the display
    this.graph.convertValueToString = cell => {
      if (this.mx.mxUtils.isNode(cell.value, 'Node')) {
        if (cell.value.nodeName.toLowerCase() == 'node') {
          var firstName = cell.getAttribute('edge', '')
          var lastName = cell.getAttribute('type', '')

          if (lastName != null && lastName.length > 0) {
            return lastName + ', ' + firstName
          }

          return firstName
        } else if (cell.value.nodeName.toLowerCase() == 'knows') {
          return (
            cell.value.nodeName +
            ' (Since ' +
            cell.getAttribute('since', '') +
            ')'
          )
        }
      }

      return ''
    }
    // **********************************************
    // comment : cell label change logic ...
    // **********************************************
    // const _this = this
    // // Overrides method to store a cell label in the model
    // const cellLabelChanged = this.graph.cellLabelChanged
    // // @ts-ignore
    // this.graph.cellLabelChanged = function(cell, newValue, autoSize) {
    //   if (
    //     _this.mx.mxUtils.isNode(cell.value, 'Node') &&
    //     cell.value.nodeName.toLowerCase() == 'node'
    //   ) {
    //     var pos = newValue.indexOf(' ')

    //     var firstName = pos > 0 ? newValue.substring(0, pos) : newValue
    //     var lastName =
    //       pos > 0 ? newValue.substring(pos + 1, newValue.length) : ''

    //     // Clones the value for correct undo/redo
    //     var elt = cell.value.cloneNode(true)

    //     elt.setAttribute('edge', firstName)
    //     elt.setAttribute('type', lastName)

    //     newValue = elt
    //     autoSize = true
    //   }
    //   _this.graph.refresh()
    //   cellLabelChanged.apply(this, arguments)
    // }

    // // @ts-ignore. Overrides method to create the editing value
    // const _getEditingValue = this.graph.getEditingValue
    // this.graph.getEditingValue = function(cell) {
    //   if (
    //     _this.mx.mxUtils.isNode(cell.value, 'Node') &&
    //     cell.value.nodeName.toLowerCase() == 'node'
    //   ) {
    //     var firstName = cell.getAttribute('type', '')
    //     var lastName = cell.getAttribute('edge', '')

    //     return firstName + ' ' + lastName
    //   }
    // }
  }
  private configureStylesheet = () => {
    let style = new Object()
    const mxConstants = this.mxConstants
    style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_RECTANGLE
    style[mxConstants.STYLE_PERIMETER] = this.mx.mxPerimeter.RectanglePerimeter
    style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_CENTER
    style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_MIDDLE
    style[mxConstants.STYLE_GRADIENTCOLOR] = '#41B9F5'
    style[mxConstants.STYLE_FILLCOLOR] = '#8CCDF5'
    style[mxConstants.STYLE_STROKECOLOR] = '#1B78C8'
    style[mxConstants.STYLE_FONTCOLOR] = '#000000'
    style[mxConstants.STYLE_ROUNDED] = true
    style[mxConstants.STYLE_OPACITY] = '80'
    style[mxConstants.STYLE_FONTSIZE] = '12'
    style[mxConstants.STYLE_FONTSTYLE] = 0
    style[mxConstants.STYLE_IMAGE_WIDTH] = '48'
    style[mxConstants.STYLE_IMAGE_HEIGHT] = '48'
    this.graph.getStylesheet().putDefaultVertexStyle(style)

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
    style[mxConstants.STYLE_PERIMETER] = this.mx.mxPerimeter.RectanglePerimeter
    style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_CENTER
    style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_TOP
    style[mxConstants.STYLE_FILLCOLOR] = '#FF9103'
    style[mxConstants.STYLE_GRADIENTCOLOR] = '#F8C48B'
    style[mxConstants.STYLE_STROKECOLOR] = '#E86A00'
    style[mxConstants.STYLE_FONTCOLOR] = '#000000'
    style[mxConstants.STYLE_ROUNDED] = true
    style[mxConstants.STYLE_OPACITY] = '80'
    style[mxConstants.STYLE_STARTSIZE] = '30'
    style[mxConstants.STYLE_FONTSIZE] = '16'
    style[mxConstants.STYLE_FONTSTYLE] = 1
    this.graph.getStylesheet().putCellStyle('group', style)

    style = new Object()
    style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_IMAGE
    style[mxConstants.STYLE_FONTCOLOR] = '#774400'
    style[mxConstants.STYLE_PERIMETER] = this.mx.mxPerimeter.RectanglePerimeter
    style[mxConstants.STYLE_PERIMETER_SPACING] = '6'
    style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_LEFT
    style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_MIDDLE
    style[mxConstants.STYLE_FONTSIZE] = '10'
    style[mxConstants.STYLE_FONTSTYLE] = 2
    style[mxConstants.STYLE_IMAGE_WIDTH] = '16'
    style[mxConstants.STYLE_IMAGE_HEIGHT] = '16'
    this.graph.getStylesheet().putCellStyle('port', style)

    style = this.graph.getStylesheet().getDefaultEdgeStyle()
    style[mxConstants.STYLE_LABEL_BACKGROUNDCOLOR] = '#FFFFFF'
    style[mxConstants.STYLE_STROKEWIDTH] = '2'
    style[mxConstants.STYLE_ROUNDED] = true
    style[mxConstants.STYLE_EDGE] = this.mx.mxEdgeStyle.EntityRelation
  }

  private addEditorAction = (editor: mxEditor, graph?: mxGraph) => {
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

      const enc = new this.mx.mxCodec(this.mxUtils.createXmlDocument())
      const node = enc.encode(editor.graph.getModel())

      // @ts-ignore
      textarea.value = this.mxUtils.getPrettyXml(node)
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
    const background = document.createElement('div')
    background.style.position = 'absolute'
    background.style.left = '0px'
    background.style.top = '0px'
    background.style.right = '0px'
    background.style.bottom = '0px'
    background.style.background = 'black'
    this.mxUtils.setOpacity(background, 50)
    this.container.appendChild(background)

    if (this.mxClient.IS_IE) {
      new this.mxDivResizer(background)
    }

    const x = Math.max(0, document.body.scrollWidth / 2 - width / 2)
    const y = Math.max(
      10,
      (document.body.scrollHeight || document.documentElement.scrollHeight) /
        2 -
        (height * 2) / 3
    )
    const wnd = new this.mx.mxWindow(
      title,
      content,
      x,
      y,
      width,
      height,
      false,
      true
    )
    wnd.setClosable(true)

    // Fades the background out after after the window has been closed
    wnd.addListener(this.mx.mxEvent.DESTROY, () => {
      graph.setEnabled(true)
      this.mx.mxEffects.fadeOut(background, 50, true, 10, 30, true)
    })

    graph.setEnabled(false)
    graph.tooltipHandler.hide()
    wnd.setVisible(true)
  }
}

export default connect(null, null)(InventoryTopology)
