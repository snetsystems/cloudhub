import React, {createRef, PureComponent} from 'react'
import {connect} from 'react-redux'
import {
  default as mxgraph,
  mxEditor as mxEditorType,
  mxCell as mxCellType,
  mxCellState as mxCellStateType,
  mxForm as mxFormType,
  mxGraph as mxGraphType,
  mxGraphModel as mxGraphModelType,
} from 'mxgraph'

import _ from 'lodash'

// component
// import {Button, ButtonShape, IconFont} from 'src/reusable_ui'
// import HostList from 'src/hosts/components/HostList'
import {TableBody} from 'src/addon/128t/reusable/layout'
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
import {toolbarMenu, toolsMenu, hostMenu, Menu} from 'src/hosts/constants/tools'

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
} = mx

const linkImg = require('../../../assets/images/stencils/link.png')

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

  public componentWillUnmount() {}

  private createEditor = () => {
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
    model = model ? model : graph.getModel()

    model.beginUpdate()
    try {
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]
        const isEdge = model.isEdge(cell)
        if (isEdge) {
          const edge = document.createElement('div')
          edge.classList.add('vertex')
          edge.setAttribute('data-name', 'Edge')
          edge.setAttribute('data-label', 'Edge')
          edge.setAttribute('data-type', 'Edge')

          const edgeTitle = document.createElement('strong')
          edgeTitle.textContent = 'Edge'

          edge.appendChild(edgeTitle)
          cell.setValue(edge.outerHTML)
          cell.setStyle('edge')
        }
      }
    } finally {
      model.endUpdate()
    }
  }

  private configureEditor = () => {
    new mxRubberband(graph)

    mxConstants.MIN_HOTSPOT_SIZE = 16
    mxConstants.DEFAULT_HOTSPOT = 1

    mxGraphHandler.prototype.guidesEnabled = true

    mxGuide.prototype.isEnabledForEvent = (evt: MouseEvent) => {
      return !mxEvent.isAltDown(evt)
    }

    mxEdgeHandler.prototype.snapToTerminals = true

    graph.connectionHandler.addListener(mxEvent.CONNECT, (_sender, evt) => {
      const cells = [evt.getProperty('cell')]

      if (evt.getProperty('terminalInserted')) {
        cells.push(evt.getProperty('terminal'))
      }

      this.insertHandler(cells)
    })

    graph.connectionHandler.createEdgeState = () => {
      const edge = graph.createEdge(null, null, null, null, null)

      return new mxCellState(graph.view, edge, graph.getCellStyle(edge))
    }

    if (mxClient.IS_QUIRKS) {
      document.body.style.overflow = 'hidden'
      new mxDivResizer(this.container)
      new mxDivResizer(this.outline)
      new mxDivResizer(this.toolbar)
      new mxDivResizer(this.tools)
    }

    graph.setDropEnabled(false)

    graph.connectionHandler.getConnectImage = (state: mxCellStateType) => {
      return new mxImage(state.style[mxConstants.STYLE_IMAGE], 16, 16)
    }

    graph.connectionHandler.targetConnectImage = true

    graph.setAllowDanglingEdges(false)

    editor.setGraphContainer(this.container)
    const config = mxUtils.load(keyhandlerCommons).getDocumentElement()
    editor.configure(config)

    // @ts-ignore
    const getFoldingImage = mxGraph.prototype.getFoldingImage
    graph.getFoldingImage = () => {
      return null
    }

    graph.createGroupCell = (cells: mxCellType[]) => {
      const group = mxGraph.prototype.createGroupCell.apply(graph, cells)
      const groupCell = document.createElement('div')

      groupCell.classList.add('vertex')
      groupCell.setAttribute('data-name', 'Group')
      groupCell.setAttribute('data-label', 'Group')
      groupCell.setAttribute('data-type', 'Group')

      const groupTitle = document.createElement('strong')
      groupTitle.textContent = 'Group'

      groupCell.appendChild(groupTitle)
      group.setValue(groupCell.outerHTML)
      group.setVertex(true)
      group.setConnectable(false)

      group.setStyle('group')

      return group
    }

    // @ts-ignore
    graph.isTable = (cell: mxCell) => {
      const style = graph.getCellStyle(cell)

      return style != null && style['childLayout'] == 'tableLayout'
    }

    // @ts-ignore
    graph.isTableRow = (cell: mxCellType) => {
      return (
        // @ts-ignore
        graph.model.isVertex(cell) && graph.isTable(graph.model.getParent(cell))
      )
    }

    // @ts-ignore
    graph.isTableCell = (cell: mxCell) => {
      return (
        graph.model.isVertex(cell) && // @ts-ignore
        graph.isTableRow(graph.model.getParent(cell))
      )
    }

    graph.isCellSelectable = (cell: mxCellType) => {
      return !graph.isCellLocked(cell)
    }

    graph.setConnectable(true)

    graph.getLabel = cell => {
      let tmp = mxGraph.prototype.getLabel.apply(graph, [cell])

      const isCellCollapsed = graph.isCellCollapsed(cell)
      if (cell.style !== 'group') {
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

    graph.isHtmlLabel = (cell: mxCellType) => {
      return !graph.isSwimlane(cell)
    }

    graph.convertValueToString = (cell: mxCellType) => {
      if (cell) {
        if (cell.style === 'group' || cell.style === 'edge') {
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

    graph.getSelectionModel().addListener(mxEvent.CHANGE, () => {
      this.selectionChanged(graph)
    })

    graph.dblClick = evt => {
      mxEvent.consume(evt)
    }
  }

  private selectionChanged = (graph: mxGraphType) => {
    const properties = this.properties
    properties.innerHTML = ''

    graph.container.focus()

    const cell = graph.getSelectionCell()

    if (cell) {
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

      const isDisableName =
        vertex.attributes['data-name--disabled']?.nodeValue === 'true'

      if (attrs) {
        for (let i = 0; i < attrs.length; i++) {
          this.createTextField(graph, form, cell, attrs[i], isDisableName)
        }
      }

      properties.appendChild(form.getTable())
    } else {
      mxUtils.writeln(properties, 'Nothing selected.')
    }
  }

  private setActionInEditor = () => {
    editor.addAction('group', () => {
      if (graph.isEnabled()) {
        let cells = mxUtils.sortCells(graph.getSelectionCells(), true)

        if (
          cells.length === 1 && // @ts-ignore
          !graph.isTable(cells[0]) && // @ts-ignore
          !graph.isTableRow(cells[0]) &&
          graph.isSwimlane(cells[0])
        ) {
          return
        } else {
          cells = graph.getCellsForGroup(cells)
          if (cells.length > 1) {
            graph.setSelectionCell(graph.groupCells(null, 30, cells))
          }
        }
      }
    })

    editor.addAction('ungroup', () => {
      if (graph.isEnabled()) {
        const cells = graph.getSelectionCells()
        const groupCells = _.filter(cells, cell => graph.isSwimlane(cell))

        graph.model.beginUpdate()
        try {
          const temp = graph.ungroupCells(groupCells)

          if (cells != null) {
            for (let i = 0; i < cells.length; i++) {
              if (graph.model.contains(cells[i])) {
                if (
                  graph.model.getChildCount(cells[i]) == 0 &&
                  graph.model.isVertex(cells[i])
                ) {
                  graph.setCellStyles('group', '0', [cells[i]])
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

    editor.addAction('export', (editor: mxEditorType) => {
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
    style[mxConstants.STYLE_ENDARROW] = null
    style[mxConstants.STYLE_STARTARROW] = null
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
    const {hostsObject} = this.props
    const hostList = _.keys(hostsObject)
    let menus = []

    _.reduce(
      hostList,
      (_acc, cur) => {
        const host = {
          ...hostMenu,
          name: cur,
          label: cur,
        }
        menus.push(host)

        return cur
      },
      {}
    )

    _.forEach(menus, menu => {
      const rowElement = document.createElement('div')
      rowElement.classList.add('hosts-table--tr')

      const hostElement = document.createElement('div')
      hostElement.classList.add('hosts-table--td')

      const span = document.createElement('span')
      span.style.fontSize = '14px'
      span.textContent = menu.label

      hostElement.appendChild(span)
      rowElement.appendChild(hostElement)

      this.addSidebarButton({
        graph,
        sideBarArea: this.hosts,
        node: menu,
        icon: rowElement,
        isDisableName: true,
      })
    })
  }

  private addToolsButton = () => {
    _.forEach(toolsMenu, menu => {
      const icon = document.createElement('div')
      icon.classList.add('tool-instance')
      icon.classList.add(`mxgraph-cell--icon`)
      icon.classList.add(`mxgraph-cell--icon-${menu.type.toLowerCase()}`)

      this.addSidebarButton({
        graph,
        sideBarArea: this.tools,
        node: menu,
        icon,
        iconClassName: `mxgraph-cell--icon-${menu.type.toLowerCase()}`,
      })
    })
  }

  private addSidebarButton({
    graph,
    sideBarArea,
    node,
    icon,
    iconClassName = 'mxgraph-cell--icon-server',
    isDisableName = false,
  }: {
    graph: mxGraphType
    sideBarArea: HTMLElement
    node: Menu
    icon: HTMLDivElement
    iconClassName?: string
    isDisableName?: boolean
  }) {
    sideBarArea.appendChild(icon)

    const dragElt = document.createElement('div')
    dragElt.style.border = 'dashed white 1px'
    dragElt.style.width = `${CELL_SIZE_WIDTH}px`
    dragElt.style.height = `${CELL_SIZE_HEIGHT}px`

    const ds = mxUtils.makeDraggable(
      icon,
      graph,
      this.dragCell(node, iconClassName, isDisableName),
      dragElt,
      0,
      0,
      true,
      true
    )

    ds.setGuidesEnabled(true)
  }

  private dragCell = (
    node: Menu,
    iconClassName: string,
    isDisableName: boolean
  ) => (
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
      const vertex = document.createElement('div')
      vertex.classList.add('vertex')
      vertex.setAttribute('data-name', node.name)
      vertex.setAttribute('data-name--disabled', isDisableName.toString())
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
        CELL_SIZE_HEIGHT,
        'node'
      )

      v1.setConnectable(true)

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

    mxEvent.addListener(button, 'click', () => {
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

    wnd.addListener(mxEvent.DESTROY, () => {
      graph.setEnabled(true)
      mxEffects.fadeOut(background, 50, true, 10, 30, true)
    })

    graph.setEnabled(false)
    graph.tooltipHandler.hide()
    wnd.setVisible(true)
  }

  private graphUpdate = () => {
    graph.getModel().beginUpdate()
    try {
    } finally {
      graph.getModel().endUpdate()
      graph.refresh()
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

    const input = form.addText(nodeName + ':', attribute.nodeValue, 'text')

    if (attribute.nodeName === 'data-name') {
      input.disabled = isDisableName
    }

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

            vertex.setAttribute(attribute.nodeName, newValue)

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
    const {sidebarProportions} = this.state
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
