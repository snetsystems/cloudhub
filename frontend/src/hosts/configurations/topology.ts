import _ from 'lodash'
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
  mxConnectionHandler as mxConnectionHandlerType,
  mxEventObject as mxEventObjectType,
  mxGraphExportObject,
} from 'mxgraph'

// Types
import {Host, IpmiCell} from 'src/types'

// Utils
import {
  getContainerElement,
  getContainerTitle,
  getIsDisableName,
  getIsHasString,
  getParseHTML,
} from 'src/hosts/utils/topology'

// Constants
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

import {IpmiSetPowerStatus} from 'src/shared/apis/saltStack'

const mx = mxgraph()
const {
  mxClient,
  mxGraph,
  mxEvent,
  mxUtils,
  mxConstants,
  mxImage,
  mxForm,
  mxPoint,
  mxCellState,
} = mx

export const configureStylesheet = function (mx: mxGraphExportObject) {
  const {mxConstants, mxPerimeter, mxEdgeStyle} = mx

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

  style = new Object()
  style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_RECTANGLE
  style[mxConstants.STYLE_PERIMETER] = mxPerimeter.RectanglePerimeter
  style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_LEFT
  style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_MIDDLE
  style[mxConstants.STYLE_STROKECOLOR] = '#f58220'
  this.graph.getStylesheet().putCellStyle('ipmi', style)

  style = new Object()
  style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_ELLIPSE
  style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_LEFT
  style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_MIDDLE
  style[mxConstants.STYLE_STROKECOLOR] = ''
  style[mxConstants.STYLE_FILLCOLOR] = '#4ed8a0'
  this.graph.getStylesheet().putCellStyle('status', style)

  style = this.graph.getStylesheet().getDefaultEdgeStyle()
  style[mxConstants.STYLE_LABEL_BACKGROUNDCOLOR] = '#000000'
  style[mxConstants.STYLE_FONTCOLOR] = '#FFFFFF'
  style[mxConstants.STYLE_STROKEWIDTH] = '2'
  style[mxConstants.STYLE_ROUNDED] = true
  style[mxConstants.STYLE_EDGE] = mxEdgeStyle.OrthConnector
  style[mxConstants.STYLE_ENDARROW] = null
  style[mxConstants.STYLE_STARTARROW] = null
}

export const getLabel = function (cell: mxCellType) {
  let tmp = mxGraph.prototype.getLabel.apply(this.graph, [cell])

  const isCellCollapsed = this.graph.isCellCollapsed(cell)
  if (cell.style !== 'group') {
    if (isCellCollapsed) {
      const containerElement = getContainerElement(tmp)
      const title = getContainerTitle(containerElement)

      tmp = title.outerHTML
    }
  }

  return tmp
}

export const isHtmlLabel = function (cell: mxCellType) {
  return !this.graph.isSwimlane(cell)
}

export const convertValueToString = function (cell: mxCellType) {
  if (cell) {
    if (cell.style === 'group' || cell.style === 'edge') {
      const constainerElement = getContainerElement(cell.value)
      const label = constainerElement.getAttribute('data-label')

      return label
    } else {
      return cell.value
    }
  }

  return ''
}

export const dblClick = function (evt: Event) {
  mxEvent.consume(evt)
}

export const getAllCells = function (parent: mxCellType, descendants: boolean) {
  const cells = descendants
    ? this.graph.getModel().filterDescendants(
        mxUtils.bind(this, function (cell) {
          return cell != parent && this.graph.view.getState(cell) != null
        }),
        parent
      )
    : this.graph.getModel().getChildren(parent)

  return cells
}

export const getConnectImage = function (state: mxCellStateType) {
  return new mxImage(state.style[mxConstants.STYLE_IMAGE], 16, 16)
}

export const isCellSelectable = function (cell: mxCellType) {
  return !this.graph.isCellLocked(cell)
}

export const createForm = function (
  graph: mxGraphType,
  properties: HTMLDivElement
) {
  graph.container.focus()
  properties.innerHTML = ''

  const cell = graph.getSelectionCell()

  if (cell) {
    const form = new mxForm('properties-table')
    const containerElement = getContainerElement(cell.value)
    const attrs = _.filter(containerElement.attributes, attr => {
      let isSame = false
      _.forEach(OUTPUT_INPUT_FIELD, INPUT_FIELD => {
        if (attr.nodeName === INPUT_FIELD) {
          isSame = true
          return
        }
      })
      return isSame
    })

    const isDisableName = getIsDisableName(containerElement)

    _.forEach(attrs, attr => {
      createTextField.bind(this)(graph, form, cell, attr, isDisableName)
    })
    properties.appendChild(form.getTable())
  } else {
    mxUtils.writeln(properties, 'Nothing selected.')
  }
}

export const createTextField = function (
  graph: mxGraphType,
  form: mxFormType,
  cell: mxCellType,
  attribute: any,
  isDisableName = false
) {
  const nodeName = _.upperCase(attribute.nodeName.replace('data-', ''))
  const ipmiTargets = this.state.minionList
  let input = null

  if (attribute.nodeName === 'data-using_minion') {
    input = form.addCombo(nodeName, false)
    input.style.padding = '0 9px'

    form.addOption(input, 'NONE', '', false)
    _.map(ipmiTargets, ipmiTarget => {
      ipmiTarget === attribute.nodeValue
        ? form.addOption(input, ipmiTarget, ipmiTarget, true)
        : form.addOption(input, ipmiTarget, ipmiTarget, false)
    })
  } else {
    const isPassword = _.includes(nodeName, 'PASS')
    input = form.addText(
      nodeName,
      attribute.nodeValue,
      isPassword ? 'password' : 'text'
    )
  }

  input.classList.add('input-sm')
  input.classList.add('form-control')

  if (attribute.nodeName === 'data-name') {
    input.disabled = isDisableName
  }

  const applyHandler = () => {
    const containerElement = getContainerElement(cell.value)

    let newValue = input.value || ''
    let isInputPassword = false
    const oldValue = containerElement.getAttribute(attribute.nodeName) || ''

    if (newValue !== oldValue) {
      graph.getModel().beginUpdate()

      try {
        if (attribute.nodeName === 'data-label') {
          const title = getContainerTitle(containerElement)
          title.textContent = newValue
        }

        if (attribute.nodeName === 'data-link') {
          if (cell.children) {
            const childrenCell = cell.getChildAt(1)
            if (childrenCell.style === 'href') {
              const childrenContainerElement = getContainerElement(
                childrenCell.value
              )

              const childrenLink = childrenContainerElement.querySelector('a')
              childrenLink.setAttribute('href', newValue)

              childrenCell.setValue(childrenContainerElement.outerHTML)
              childrenCell.setVisible(getIsHasString(newValue))
            }
          }
        }

        if (attribute.nodeName === 'data-ipmi_host') {
          if (cell.children) {
            const childrenCell = cell.getChildAt(0)
            if (childrenCell.style === 'ipmi') {
              graph.setCellStyles(mxConstants.STYLE_STROKECOLOR, 'white', [
                cell.getChildAt(0),
              ])
            }
            childrenCell.setVisible(getIsHasString(newValue))
          }
        }

        if (attribute.nodeName === 'data-ipmi_pass') {
          if (newValue.length > 0) {
            newValue = CryptoJS.AES.encrypt(
              newValue,
              this.secretKey.url
            ).toString()

            isInputPassword = true
          }
        }

        containerElement.setAttribute(attribute.nodeName, newValue)
        cell.setValue(containerElement.outerHTML)
      } finally {
        if (isInputPassword) {
          graph.setSelectionCell(cell)
        }
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

export const createHTMLValue = function (node: Menu, style: string) {
  const cell = document.createElement('div')
  cell.classList.add('vertex')

  const cellTitleBox = document.createElement('div')
  cellTitleBox.classList.add('mxgraph-cell--title')
  cellTitleBox.setAttribute('style', `width: ${CELL_SIZE_WIDTH}px;`)

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

export const openSensorData = function (data: Promise<any>) {
  if (!data) return
  const statusWindow = document.createElement('div')
  const statusTable = document.createElement('table')
  const rootItem = _.keys(data)

  _.forEach(rootItem, key => {
    const current: any = data[key]
    _.forEach(_.keys(current), c => {
      const statusTableRow = document.createElement('tr')
      let statusTableValue = document.createElement('td')

      const kindStatus = current[c]
      const isUnavailable = kindStatus?.unavailable === 1

      if (!isUnavailable) {
        const statusTableKind = document.createElement('th')
        statusTableKind.textContent = c

        const {value, units, states} = kindStatus

        let kindValue = ''

        if (_.isNumber(value) || _.isString(value)) {
          kindValue += value
          if (units) {
            kindValue += ' ' + units
          }
        } else {
          if (_.isEmpty(states)) {
            kindValue += '-'
          } else {
            kindValue += states[0]
          }
        }

        statusTableValue.textContent = kindValue
        statusTableRow.appendChild(statusTableKind)
        statusTableRow.appendChild(statusTableValue)
        statusTable.appendChild(statusTableRow)
      }
    })
  })

  statusWindow.appendChild(statusTable)

  this.statusRef.current.appendChild(statusWindow)
  document.querySelector('#statusContainer').classList.add('active')
}

export const drawCellInGroup = (parentElement: HTMLElement, nodes: Menu[]) => (
  graph: mxGraphType,
  _event: any,
  _cell: mxCellType,
  x: number,
  y: number
) => {
  const parent = graph.getDefaultParent()
  const model = graph.getModel()
  let cells: mxCellType[] = null

  // const groupName =
  //   parentElement.getAttribute('data-parent') +
  //   '(' +
  //   parentElement.getAttribute('data-label') +
  //   ')'

  model.beginUpdate()
  try {
    cells = _.map(nodes, (node, index) => {
      const cell = createHTMLValue(node, 'node')

      const vertex = graph.insertVertex(
        parent,
        null,
        cell.outerHTML,
        x + index * 20,
        y,
        CELL_SIZE_WIDTH,
        CELL_SIZE_HEIGHT,
        'node'
      )

      vertex.setConnectable(true)

      const ipmiBox = document.createElement('div')
      ipmiBox.classList.add('vertex')
      ipmiBox.setAttribute('btn-type', 'ipmi')

      const ipmiIcon = document.createElement('span')
      ipmiIcon.classList.add('mxgraph-cell--ipmi-btn')
      ipmiIcon.classList.add('icon')
      ipmiIcon.classList.add('switch')

      ipmiBox.appendChild(ipmiIcon)
      ipmiBox.appendChild(ipmiIcon)
      ipmiBox.setAttribute('btn-type', 'ipmi')
      ipmiBox.setAttribute('ipmi-power-status', 'disconnected')

      const ipmiStatus = graph.insertVertex(
        vertex,
        null,
        ipmiBox.outerHTML,
        0,
        0,
        24,
        24,
        `ipmi`,
        true
      )

      ipmiStatus.geometry.offset = new mxPoint(-12, -12)
      ipmiStatus.setConnectable(false)
      ipmiStatus.setVisible(false)

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
        vertex,
        null,
        linkBox.outerHTML,
        1,
        0,
        24,
        24,
        `href`,
        true
      )

      href.geometry.offset = new mxPoint(-12, -12)
      href.setConnectable(false)
      href.setVisible(false)

      return vertex
    })
  } finally {
    model.endUpdate()
  }

  // graph.setSelectionCells(cells)

  const getParent = model.getParent(cells[0])
  const isVertexSwimlane = graph.isSwimlane(getParent)

  if (!isVertexSwimlane) {
    const groupCell = graph.groupCells(null, 30, cells)
    graph.setSelectionCell(groupCell)
  } else {
    const getParent = model.getParent(cells[0])
    const getChildCells = graph.getChildCells(getParent)
    const isSameLength = getChildCells.length !== cells.length

    if (isSameLength) {
      const groupCell = graph.groupCells(null, 30, cells)
      graph.setSelectionCell(groupCell)
    }
  }
}

export const dragCell = (node: Menu) => (
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
    const cell = createHTMLValue(node, 'node')

    v1 = graph.insertVertex(
      parent,
      null,
      cell.outerHTML,
      x,
      y,
      CELL_SIZE_WIDTH,
      CELL_SIZE_HEIGHT,
      'node'
    )

    v1.setConnectable(true)

    const ipmiBox = document.createElement('div')
    ipmiBox.classList.add('vertex')
    ipmiBox.setAttribute('btn-type', 'ipmi')

    const ipmiIcon = document.createElement('span')
    ipmiIcon.classList.add('mxgraph-cell--ipmi-btn')
    ipmiIcon.classList.add('icon')
    ipmiIcon.classList.add('switch')

    ipmiBox.appendChild(ipmiIcon)
    ipmiBox.appendChild(ipmiIcon)
    ipmiBox.setAttribute('btn-type', 'ipmi')
    ipmiBox.setAttribute('ipmi-power-status', 'disconnected')

    const ipmiStatus = graph.insertVertex(
      v1,
      null,
      ipmiBox.outerHTML,
      0,
      0,
      24,
      24,
      `ipmi`,
      true
    )

    ipmiStatus.geometry.offset = new mxPoint(-12, -12)
    ipmiStatus.setConnectable(false)
    ipmiStatus.setVisible(false)

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

    href.geometry.offset = new mxPoint(-12, -12)
    href.setConnectable(false)
    href.setVisible(false)

    const statusCPUBox = document.createElement('div')
    statusCPUBox.setAttribute('data-status-kind', 'cpu')
    statusCPUBox.style.display = 'flex'
    statusCPUBox.style.alignItems = 'center'
    statusCPUBox.style.justifyContent = 'center'
    // statusCPUBox.style.width = '25px'
    // statusCPUBox.style.height = '25px'
    // statusCPUBox.style.marginLeft = '-2px'

    // const statusCPU = document.createElement('a')
    // statusCPU.setAttribute('href', '')
    // statusCPU.setAttribute('target', '_blank')

    // const statusCPUIcon = document.createElement('span')
    // statusCPUIcon.classList.add('mxgraph-cell--link-btn')
    // statusCPUIcon.classList.add('icon')
    // statusCPUIcon.classList.add('dash-j')

    // statusCPU.appendChild(statusCPUIcon)
    // statusCPUBox.appendChild(statusCPU)

    const statusCPUCell = graph.insertVertex(
      v1,
      null,
      statusCPUBox.outerHTML,
      0.25,
      1,
      12,
      12,
      `status`,
      true
    )

    statusCPUCell.geometry.offset = new mxPoint(0, 6)
    statusCPUCell.setConnectable(false)
    statusCPUCell.setVisible(true)

    const statusMemoryBox = document.createElement('div')
    statusMemoryBox.setAttribute('data-status-kind', 'memory')
    statusMemoryBox.style.display = 'flex'
    statusMemoryBox.style.alignItems = 'center'
    statusMemoryBox.style.justifyContent = 'center'

    const statusMemoryCell = graph.insertVertex(
      v1,
      null,
      statusMemoryBox.outerHTML,
      0.5,
      1,
      12,
      12,
      `status`,
      true
    )

    statusMemoryCell.geometry.offset = new mxPoint(-6, 6)
    statusMemoryCell.setConnectable(false)
    statusMemoryCell.setVisible(true)

    const statusDiskBox = document.createElement('div')
    statusDiskBox.setAttribute('data-status-kind', 'disk')
    statusDiskBox.style.display = 'flex'
    statusDiskBox.style.alignItems = 'center'
    statusDiskBox.style.justifyContent = 'center'

    const statusDiskCell = graph.insertVertex(
      v1,
      null,
      statusDiskBox.outerHTML,
      0.75,
      1,
      12,
      12,
      `status`,
      true
    )

    statusDiskCell.geometry.offset = new mxPoint(-12, 6)
    statusDiskCell.setConnectable(false)
    statusDiskCell.setVisible(true)

    // const statusMemoryBox = document.createElement('div')
    // statusMemoryBox.classList.add('vertex')
    // statusMemoryBox.style.display = 'flex'
    // statusMemoryBox.style.alignItems = 'center'
    // statusMemoryBox.style.justifyContent = 'center'
    // statusMemoryBox.style.width = '25px'
    // statusMemoryBox.style.height = '25px'
    // statusMemoryBox.style.marginLeft = '-2px'

    // const statusMemory = document.createElement('a')
    // statusMemory.setAttribute('href', '')
    // statusMemory.setAttribute('target', '_blank')

    // const statusMemoryIcon = document.createElement('span')
    // statusMemoryIcon.classList.add('mxgraph-cell--link-btn')
    // statusMemoryIcon.classList.add('icon')
    // statusMemoryIcon.classList.add('dash-j')

    // statusMemory.appendChild(statusMemoryIcon)
    // statusMemoryBox.appendChild(statusMemory)

    // const statusMemoryCell = graph.insertVertex(
    //   v1,
    //   null,
    //   statusMemoryBox.outerHTML,
    //   0.5,
    //   1,
    //   24,
    //   24,
    //   `memory`,
    //   true
    // )

    // statusMemoryCell.geometry.offset = new mxPoint(-12, 6)
    // statusMemoryCell.setConnectable(false)
    // statusMemoryCell.setVisible(true)

    // const statusDiskBox = document.createElement('div')
    // statusDiskBox.classList.add('vertex')
    // statusDiskBox.style.display = 'flex'
    // statusDiskBox.style.alignItems = 'center'
    // statusDiskBox.style.justifyContent = 'center'
    // statusDiskBox.style.width = '25px'
    // statusDiskBox.style.height = '25px'
    // statusDiskBox.style.marginLeft = '-2px'

    // const statusDisk = document.createElement('a')
    // statusDisk.setAttribute('href', '')
    // statusDisk.setAttribute('target', '_blank')

    // const statusDiskIcon = document.createElement('span')
    // statusDiskIcon.classList.add('mxgraph-cell--link-btn')
    // statusDiskIcon.classList.add('icon')
    // statusDiskIcon.classList.add('dash-j')

    // statusDisk.appendChild(statusDiskIcon)
    // statusDiskBox.appendChild(statusDisk)

    // const statusDiskCell = graph.insertVertex(
    //   v1,
    //   null,
    //   statusDiskBox.outerHTML,
    //   1,
    //   1,
    //   24,
    //   24,
    //   `disk`,
    //   true
    // )

    // statusDiskCell.geometry.offset = new mxPoint(-24, 6)
    // statusDiskCell.setConnectable(false)
    // statusDiskCell.setVisible(true)
  } finally {
    model.endUpdate()
  }

  graph.setSelectionCell(v1)
}

export const addSidebarButton = function ({
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

  const dragSource = mxUtils.makeDraggable(
    element,
    this.graph,
    dragCell(node),
    dragElt,
    0,
    0,
    true,
    true
  )

  dragSource.setGuidesEnabled(true)
}

export const addHostsButton = function (
  hostsObject: {[x: string]: Host},
  hostsArea: HTMLDivElement
) {
  const hostList = _.keys(hostsObject)
  let menus: Menu[] = []

  hostsArea.innerHTML = ''

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

    addSidebarButton.bind(this)({
      sideBarArea: hostsArea,
      node: menu,
      element: rowElement,
    })
  })
}

export const addToolsButton = function (toolsArea: HTMLDivElement) {
  _.forEach(toolsMenu, menu => {
    const iconBox = document.createElement('div')
    iconBox.classList.add('tool-instance')

    const icon = document.createElement('div')
    icon.classList.add(`mxgraph-cell--icon`)
    icon.classList.add(`mxgraph-cell--icon-${menu.type.toLowerCase()}`)

    iconBox.appendChild(icon)

    addSidebarButton.bind(this)({
      sideBarArea: toolsArea,
      node: menu,
      element: iconBox,
    })
  })
}

export const setToolbar = function (
  editor: mxEditorType,
  toolbarArea: HTMLDivElement
) {
  _.forEach(toolbarMenu, menu => {
    const {actionName, label, icon, isTransparent} = menu
    addToolbarButton({
      editor,
      toolbar: toolbarArea,
      action: actionName,
      label,
      icon,
      isTransparent,
    })
  })
}

export const addToolbarButton = ({
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

// @ts-ignore
const _getFoldingImage = mxGraph.prototype.getFoldingImage
export const getFoldingImage = function () {
  return null
}

export const resizeCell = function (
  cell: mxCellType,
  bounds: mxRectangleType,
  recurse?: boolean
) {
  if (cell.getStyle() === 'node') {
    const containerElement = getContainerElement(cell.value)
    const title = containerElement.querySelector('.mxgraph-cell--title')
    title.setAttribute('style', `width: ${bounds.width}px;`)

    cell.setValue(containerElement.outerHTML)
  }

  return mxGraph.prototype.resizeCell.apply(this.graph, [cell, bounds, recurse])
}

export const onClickMxGraph = function (
  _graph: mxGraphType,
  me: mxEventObjectType
) {
  const cell: mxCellType = me.getProperty('cell')

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
}

export const createEdgeState = function () {
  const edge = this.graph.createEdge(null, null, null, null, null)

  return new mxCellState(this.graph.view, edge, this.graph.getCellStyle(edge))
}

export const onConnectMxGraph = function (
  _sender: mxConnectionHandlerType,
  evt: mxEventObjectType
) {
  const cells = [evt.getProperty('cell')]

  if (evt.getProperty('terminalInserted')) {
    cells.push(evt.getProperty('terminal'))
  }

  insertHandler.bind(this)(cells)
}

export const insertHandler = function (
  cells: mxCellType[],
  _asText?: string,
  model?: mxGraphModelType
) {
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

export const factoryMethod = (
  saltIpmiSetPowerAsync: (
    target: string,
    ipmiHost: string,
    ipmiUser: string,
    ipmiPass: string,
    state: IpmiSetPowerStatus,
    popupText: string
  ) => Promise<void>,
  saltIpmiGetSensorDataAsync: (
    target: string,
    ipmiHost: string,
    ipmiUser: string,
    ipmiPass: string,
    cell: mxCellType
  ) => Promise<void>
) =>
  function (menu, cell, evt) {
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
            saltIpmiSetPowerAsync(
              ipmiTarget,
              ipmiHost,
              ipmiUser,
              ipmiPass,
              IpmiSetPowerStatus.PowerOff,
              'Power Off System'
            )
          })

          menu.addItem('Graceful Shutdown', null, () => {
            saltIpmiSetPowerAsync(
              ipmiTarget,
              ipmiHost,
              ipmiUser,
              ipmiPass,
              IpmiSetPowerStatus.Shutdown,
              'Graceful Shutdown'
            )
          })

          menu.addItem('Force Reset System', null, () => {
            saltIpmiSetPowerAsync(
              ipmiTarget,
              ipmiHost,
              ipmiUser,
              ipmiPass,
              IpmiSetPowerStatus.Reset,
              'Force Reset System'
            )
          })
        } else if (ipmiPowerstate === 'off') {
          menu.addItem('Power On', null, () => {
            saltIpmiSetPowerAsync(
              ipmiTarget,
              ipmiHost,
              ipmiUser,
              ipmiPass,
              IpmiSetPowerStatus.PowerOn,
              'Power On'
            )
          })
        }
        if (ipmiHost && ipmiUser && ipmiPass) {
          saltIpmiGetSensorDataAsync(
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

export const filteredIpmiPowerStatus = function (cells: mxCellType[]) {
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

  return ipmiCells
}

export const ipmiPowerIndicator = function (ipmiCellsStatus: IpmiCell[]) {
  if (!this.graph) return

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

export const detectedHostsStatus = function (
  cells: mxCellType[],
  hostsObject: {[x: string]: Host}
) {
  console.log('detectedHostsStatus', cells, hostsObject)

  // _.forEach(cells, cell => {
  //   if (cell.getStyle() === 'node') {
  //     const containerElement = getContainerElement(cell.value)
  //     const isDisableName = getIsDisableName(containerElement)
  //     const name = containerElement.getAttribute('data-name')

  //     if (isDisableName) {
  //       graph.removeCellOverlays(cell)
  //       if (!_.find(hostList, host => host === name)) {
  //         graph.setCellWarning(cell, 'Warning', warningImage)
  //       }
  //     }
  //   }
  // })

  if (!this.graph) return

  const model = this.graph.getModel()

  model.beginUpdate()
  try {
    _.forEach(cells, cell => {
      if (cell.getStyle() === 'node') {
        const containerElement = getContainerElement(cell.value)
        const name = containerElement.getAttribute('data-label')

        const findHost = _.find(hostsObject, host => host.name === name)

        if (!_.isEmpty(findHost)) {
          console.log(this.graph.getChildCells(cell))
          const childCells = this.graph.getChildCells(cell)

          if (!_.isEmpty(childCells)) {
            _.forEach(childCells, childCell => {
              const childCellElement = getParseHTML(
                childCell.value
              ).querySelector('div')
              const statusKind = childCellElement.getAttribute(
                'data-status-kind'
              )

              console.log('statusKind')

              if (statusKind === 'cpu') {
                console.log(findHost.cpu)
                childCellElement.setAttribute(
                  'data-status-value',
                  _.toString(findHost.cpu)
                )
                childCell.setValue(childCellElement.outerHTML)
              } else if (statusKind === 'memory') {
                console.log(findHost.memory)
                childCellElement.setAttribute(
                  'data-status-value',
                  _.toString(findHost.memory)
                )
                childCell.setValue(childCellElement.outerHTML)
              } else if (statusKind === 'disk') {
                console.log(findHost.disk)
                childCellElement.setAttribute(
                  'data-status-value',
                  _.toString(findHost.disk)
                )
                childCell.setValue(childCellElement.outerHTML)
              }
            })
          }
        }
        // const statusKind = containerElement.getAttribute('data-status-kind')
      }
    })
  } finally {
    model.endUpdate()
    this.graphUpdate()
  }

  // _.map(hostsObject, host => {
  //   console.log(host)
  // })

  return null
}

// export const addDropImage = function () {

//   // Enables rubberband selection
//   new mxRubberband(this.graph)

//   mxEvent.addListener(this.graph.container, 'dragover', function(evt)
//   {
//     if (this.graph.isEnabled())
//     {
//       evt.stopPropagation();
//       evt.preventDefault();
//     }
//   });

//   mxEvent.addListener(this.graph.container, 'drop', function(evt)
//   {
//     if (this.graph.isEnabled())
//     {
//       evt.stopPropagation();
//       evt.preventDefault();

//       // Gets drop location point for vertex
//       var pt = mxUtils.convertPoint(this.graph.container, mxEvent.getClientX(evt), mxEvent.getClientY(evt));
//       var tr = this.graph.view.translate;
//       var scale = this.graph.view.scale;
//       var x = pt.x / scale - tr.x;
//       var y = pt.y / scale - tr.y;

//       // Converts local images to data urls
//       var filesArray = event.dataTransfer.files;

//               for (var i = 0; i < filesArray.length; i++)
//               {
//           handleDrop(this.graph, filesArray[i], x + i * 10, y + i * 10);
//               }
//     }
//   });
// }

// function handleDrop(graph, file, x, y) {
//   if (file.type.substring(0, 5) == 'image') {
//     var reader = new FileReader()

//     reader.onload = function (e) {
//       // Gets size of image for vertex
//       var data = e.target.result

//       // SVG needs special handling to add viewbox if missing and
//       // find initial size from SVG attributes (only for IE11)
//       if (file.type.substring(0, 9) == 'image/svg') {
//         var comma = data.indexOf(',')
//         var svgText = atob(data.substring(comma + 1))
//         var root = mxUtils.parseXml(svgText)

//         // Parses SVG to find width and height
//         if (root != null) {
//           var svgs = root.getElementsByTagName('svg')

//           if (svgs.length > 0) {
//             var svgRoot = svgs[0]
//             var w = parseFloat(svgRoot.getAttribute('width'))
//             var h = parseFloat(svgRoot.getAttribute('height'))

//             // Check if viewBox attribute already exists
//             var vb = svgRoot.getAttribute('viewBox')

//             if (vb == null || vb.length == 0) {
//               svgRoot.setAttribute('viewBox', '0 0 ' + w + ' ' + h)
//             }
//             // Uses width and height from viewbox for
//             // missing width and height attributes
//             else if (isNaN(w) || isNaN(h)) {
//               var tokens = vb.split(' ')

//               if (tokens.length > 3) {
//                 w = parseFloat(tokens[2])
//                 h = parseFloat(tokens[3])
//               }
//             }

//             w = Math.max(1, Math.round(w))
//             h = Math.max(1, Math.round(h))

//             data = 'data:image/svg+xml,' + btoa(mxUtils.getXml(svgs[0], '\n'))
//             graph.insertVertex(
//               null,
//               null,
//               '',
//               x,
//               y,
//               w,
//               h,
//               'shape=image;image=' + data + ';'
//             )
//           }
//         }
//       } else {
//         var img = new Image()

//         img.onload = function () {
//           var w = Math.max(1, img.width)
//           var h = Math.max(1, img.height)

//           // Converts format of data url to cell style value for use in vertex
//           var semi = data.indexOf(';')

//           if (semi > 0) {
//             data =
//               data.substring(0, semi) +
//               data.substring(data.indexOf(',', semi + 1))
//           }

//           graph.insertVertex(
//             null,
//             null,
//             '',
//             x,
//             y,
//             w,
//             h,
//             'shape=image;image=' + data + ';'
//           )
//         }

//         img.src = data
//       }
//     }

//     reader.readAsDataURL(file)
//   }
// }
