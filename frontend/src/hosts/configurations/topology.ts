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
  mxMouseEvent,
} from 'mxgraph'

// Types
import {Host, IpmiCell, RemoteDataState} from 'src/types'
import {CloudServiceProvider, Instance} from 'src/hosts/types/cloud'

// Utils
import {
  dataStatusValue,
  getContainerElement,
  getContainerTitle,
  getNotAvailableTitle,
  getParseHTML,
  getSelectedHostKey,
  getStatusTitle,
  getTimeSeriesHostIndicator,
} from 'src/hosts/utils/topology'

// Constants
import {
  toolbarMenu,
  toolsMenu,
  tmpMenu,
  Menu,
  eachNodeTypeAttrs,
  orderMenu,
} from 'src/hosts/constants/tools'
import {
  CELL_SIZE_WIDTH,
  CELL_SIZE_HEIGHT,
  agentFilter,
  TOOLTIP_TYPE,
  objectKeyWithGatherType,
  TOOLTIP_OFFSET_X,
  TOOLTIP_WIDTH,
  DETECT_RATE,
  OUTLINE,
} from 'src/hosts/constants/topology'
import {IpmiSetPowerStatus} from 'src/shared/apis/saltStack'
import {COLLECTOR_SERVER} from 'src/shared/constants'
import {PreferenceType} from 'src/hosts/types'

import {notifyDecryptedBytesFailed} from 'src/shared/copy/notifications'

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
  style[mxConstants.STYLE_STROKECOLOR] = '#bec2cc'
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
  style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_RECTANGLE
  style[mxConstants.STYLE_PERIMETER] = mxPerimeter.RectanglePerimeter
  style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_MIDDLE
  style[mxConstants.STYLE_STROKECOLOR] = ''
  style[mxConstants.STYLE_FILLCOLOR] = ''
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
  if (
    this.graph &&
    this.graph.lastEvent &&
    this.graph.lastEvent instanceof PointerEvent &&
    this.graph.lastEvent.button === 2
  ) {
    return false
  }

  return !this.graph.isCellLocked(cell)
}

export const isCellMovable = function (cell: mxCellType) {
  if (
    this.graph &&
    this.graph.lastEvent &&
    this.graph.lastEvent instanceof PointerEvent &&
    this.graph.lastEvent.button === 2
  ) {
    return false
  }

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
    const model = graph.getModel()
    model.beginUpdate()
    try {
      const form = new mxForm('properties-table')
      const containerElement = getContainerElement(cell.value)

      let attrs = []

      const getNodeType =
        containerElement.hasAttribute('data-type') &&
        containerElement.getAttribute('data-type')

      const getNodeAttrs = eachNodeTypeAttrs?.[getNodeType]?.attrs
      const getNodeHideAttrs = _.map(
        eachNodeTypeAttrs?.[getNodeType]?.hideAttrs,
        hideAttr => {
          return hideAttr === 'class' ? hideAttr : `data-${hideAttr}`
        }
      )

      const getNodeDisableAttrs = _.map(
        eachNodeTypeAttrs?.[getNodeType]?.disableAttrs,
        disableAttr => {
          return `data-${disableAttr}`
        }
      )

      const getCellAttrsNodeName = _.map(
        containerElement.attributes,
        attr => attr.nodeName
      )

      const getNodeAttrsNodeName = _.map(
        _.keys(getNodeAttrs),
        key => `data-${key}`
      )

      const useAttrsNodeName = [...getNodeAttrsNodeName, ...getNodeHideAttrs]

      let addAttrs = _.difference(useAttrsNodeName, getCellAttrsNodeName)
      let removeAttrs = _.difference(getCellAttrsNodeName, useAttrsNodeName)

      _.forEach(addAttrs, addAttr => {
        containerElement.setAttribute(
          addAttr,
          getNodeAttrs[_.replace(addAttr, /data-/i, '')]
        )
      })

      _.forEach(removeAttrs, removeAttr => {
        containerElement.removeAttribute(removeAttr)
      })

      const hideAttrs = _.filter(
        containerElement.attributes,
        attr => !_.includes(getNodeHideAttrs, attr.nodeName)
      )

      attrs = _.sortBy([...hideAttrs], attr => {
        const order =
          orderMenu?.[_.replace(attr.nodeName, /data-/i, '')]?.order || 999

        return order
      })

      _.forEach(attrs, attr => {
        const isDisableAttr = _.includes(getNodeDisableAttrs, attr.nodeName)
        createTextField.bind(this)(graph, form, cell, attr, isDisableAttr)
      })

      properties.appendChild(form.getTable())
    } finally {
      model.endUpdate()
    }
  } else {
    mxUtils.writeln(properties, 'Nothing selected.')
  }
}

export const createTextField = function (
  graph: mxGraphType,
  form: mxFormType,
  cell: mxCellType,
  attribute: any,
  isDisable = false
) {
  const nodeName = _.upperCase(attribute.nodeName.replace('data-', ''))

  const ipmiTargets = _.filter(this.state.minionList, minion =>
    _.startsWith(minion, COLLECTOR_SERVER)
  )
  let input = null

  if (attribute.nodeName === 'data-using_minion') {
    input = form.addCombo(nodeName, false)
    input.style.padding = '0 9px'
    input.classList.add('form-select')

    form.addOption(input, 'NONE', '', false)
    _.map(ipmiTargets, ipmiTarget => {
      ipmiTarget === attribute.nodeValue
        ? form.addOption(input, ipmiTarget, ipmiTarget, true)
        : form.addOption(input, ipmiTarget, ipmiTarget, false)
    })
  } else if (attribute.nodeName === 'data-status') {
    input = form.addCombo(nodeName, false)
    input.style.padding = '0 9px'
    input.classList.add('form-select')

    form.addOption(
      input,
      'From Agent ',
      'agent',
      attribute.nodeValue === 'agent' ? true : false
    )
    form.addOption(
      input,
      'From IPMI',
      'ipmi',
      attribute.nodeValue === 'ipmi' ? true : false
    )
    form.addOption(
      input,
      'NONE',
      'none',
      attribute.nodeValue === 'none' ? true : false
    )
  } else if (attribute.nodeName === 'data-icon') {
    input = form.addCombo(nodeName, false)
    input.style.padding = '0 9px'
    input.classList.add('form-select')

    _.map(toolsMenu, tool => {
      tool.icon === attribute.nodeValue
        ? form.addOption(input, tool.icon, tool.icon, true)
        : form.addOption(input, tool.icon, tool.icon, false)
    })
  } else {
    const isPassword = _.includes(nodeName, 'PASS')
    input = form.addText(
      nodeName,
      attribute.nodeValue,
      isPassword ? 'password' : 'text'
    )
  }

  input.setAttribute('data-attribute', attribute.nodeName)

  input.classList.add('input-sm')
  input.classList.add('form-control')
  input.disabled = isDisable

  mxEvent.addListener(
    input,
    'keypress',
    (event: KeyboardEvent & MouseEvent) => {
      if (event.key === 'Enter' && !mxEvent.isShiftDown(event)) {
        input.blur()
      }
    }
  )

  const updateEvent = mxClient.IS_IE ? 'focusout' : 'blur'

  mxEvent.addListener(input, updateEvent, async () => {
    applyHandler.bind(this)(graph, cell, attribute, input.value)
  })
}

export const createIPMIStatusIcon = function (
  graph: mxGraphType,
  cell: mxCellType
) {
  if (!graph || !cell) {
    console.error('Invalid graph or cell provided.')
    return
  }

  if (!cell.children || cell.children.length === 0) {
    console.error('No children in the provided cell.')
    return
  }

  if (!cell.value.includes('data-type="Server"')) {
    return
  }

  const childrenCell = cell.getChildAt(0)
  if (!childrenCell || !childrenCell.style) {
    console.error('No valid children cell or missing style.')
    return
  }

  const sepCellStyle = _.split(childrenCell.style, ';')
  if (sepCellStyle.length === 0 || !sepCellStyle[0]) {
    console.error('Invalid or empty style string.')
    return
  }

  if (sepCellStyle[0] === 'ipmi') {
    graph.setCellStyles(mxConstants.STYLE_STROKECOLOR, 'white', [childrenCell])
    childrenCell.setVisible(true)
  }
}
export const applyHandler = async function (
  graph: mxGraphType,
  cell: mxCellType,
  attribute: any,
  newValue = ''
) {
  const containerElement = getContainerElement(cell.value)
  const oldValue = containerElement.getAttribute(attribute.nodeName) || ''
  let isInputPassword = false
  let shouldFetchData = false

  if (newValue !== oldValue) {
    try {
      if (attribute.nodeName === 'data-label') {
        const title = getContainerTitle(containerElement)
        title.textContent = newValue
      }

      if (attribute.nodeName === 'data-link') {
        if (cell.children) {
          const childrenCell = cell.getChildAt(1)
          if (childrenCell.style.includes('href')) {
            const childrenContainerElement = getContainerElement(
              childrenCell.value
            )

            const childrenLink = childrenContainerElement.querySelector('a')
            childrenLink.setAttribute('href', newValue)

            childrenCell.setValue(childrenContainerElement.outerHTML)
            childrenCell.setVisible(
              !!newValue && this.state.topologyOption.linkVisible
            )
          }
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

      if (attribute.nodeName === 'data-status') {
        const childrenCell = cell.getChildAt(2)

        if (childrenCell.style.includes('status')) {
          childrenCell.setVisible(
            (newValue !== 'none' ? true : false) &&
              this.state.topologyOption.hostStatusVisible
          )

          shouldFetchData = newValue !== 'none'
        }
      }

      if (attribute.nodeName === 'data-icon') {
        containerElement
          .querySelector('.mxgraph-cell--icon')
          .classList.replace(
            `mxgraph-cell--icon-${oldValue.replaceAll(`-`, '').toLowerCase()}`,
            `mxgraph-cell--icon-${newValue.replaceAll(`-`, '').toLowerCase()}`
          )
      }

      if (attribute.nodeName === 'data-name') shouldFetchData = true

      containerElement.setAttribute(attribute.nodeName, newValue)
      cell.setValue(containerElement.outerHTML)
      this.setState({fetchIntervalDataStatus: RemoteDataState.Loading})

      if (shouldFetchData) {
        await this.fetchIpmiStatus(cell.getId())
        await this.getDetectedHostStatus(cell.getId())
      }
    } finally {
      if (isInputPassword) {
        graph.setSelectionCell(cell)
      }
      this.graphUpdateSave(cell)
      this.setState({fetchIntervalDataStatus: RemoteDataState.Done})
    }
  }
}

export const applyMultiHandler = async function (
  cell: mxCellType,
  attribute: any,
  dataType: string
) {
  if (dataType === 'Server') {
    if (attribute === 'data-ipmi_host') {
      if (cell.children) {
        const childrenCell = cell.getChildAt(0)
        const childrenContainerElement = getContainerElement(childrenCell.value)

        if (childrenCell.value.includes('ipmi')) {
          childrenCell.setVisible(this.state.topologyOption.ipmiVisible)
          childrenCell.setValue(childrenContainerElement.outerHTML)
        }
      }
    }
    if (attribute === 'data-status') {
      if (cell.children) {
        const childrenCell = cell.getChildAt(2)
        const childrenContainerElement = getContainerElement(childrenCell.value)
        const dataStatus =
          cell.value.match(/data-status="([^"]+)"/)[1].trim() ?? true
        if (childrenCell?.style?.includes('status')) {
          childrenCell.setVisible(
            dataStatus !== 'none' && this.state.topologyOption.hostStatusVisible
          )
          childrenCell.setValue(childrenContainerElement.outerHTML)
        }
      }
    }
  }
  if (attribute === 'data-link') {
    if (cell.children) {
      const childrenCell = cell.getChildAt(1)
      const dataLink = cell.value.match(/data-link="([^"]+)"/)
      if (childrenCell?.style?.includes('href') && !!dataLink) {
        const childrenContainerElement = getContainerElement(childrenCell.value)
        const childrenLink = childrenContainerElement.querySelector('a')
        childrenLink.setAttribute('href', dataLink[1])
        childrenCell.setVisible(this.state.topologyOption.linkVisible)
        childrenCell.setValue(childrenContainerElement.outerHTML)
      }
    }
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

  if (style.includes('node')) {
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
}

export const dragCell = (node: Menu, self: any) => (
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
  const cell = createHTMLValue(node, 'node')
  const dataType = cell.getAttribute('data-type')

  try {
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

    const linkBox = document.createElement('div')
    linkBox.setAttribute('btn-type', 'href')
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

    const statusBox = document.createElement('div')
    statusBox.classList.add('vertex')
    statusBox.setAttribute(
      'data-status',
      dataType === 'Server' ? 'agent' : 'none'
    )
    statusBox.setAttribute('btn-type', 'status')
    statusBox.style.display = 'flex'
    statusBox.style.alignItems = 'center'
    statusBox.style.justifyContent = 'center'

    const tmpIcon = document.createElement('span')
    tmpIcon.setAttribute('data-status-kind', 'temperature')
    tmpIcon.style.marginRight = '5px'
    tmpIcon.classList.add('time-series-status')

    statusBox.appendChild(tmpIcon)

    const cpuIcon = document.createElement('span')
    cpuIcon.setAttribute('data-status-kind', 'cpu')
    cpuIcon.style.marginRight = '5px'
    cpuIcon.classList.add('time-series-status')

    statusBox.appendChild(cpuIcon)

    const memoryIcon = document.createElement('span')
    memoryIcon.setAttribute('data-status-kind', 'memory')
    memoryIcon.classList.add('time-series-status')

    statusBox.appendChild(memoryIcon)

    const diskIcon = document.createElement('span')
    diskIcon.setAttribute('data-status-kind', 'disk')
    diskIcon.style.marginLeft = '5px'
    diskIcon.classList.add('time-series-status')

    statusBox.appendChild(diskIcon)

    const statusCell = graph.insertVertex(
      v1,
      null,
      statusBox.outerHTML,
      0.5,
      1,
      48,
      12,
      `status`,
      true
    )

    statusCell.geometry.offset = new mxPoint(-24, 6)
    statusCell.setConnectable(false)

    if (dataType === 'Server') {
      ipmiStatus.setVisible(self.state.topologyOption.ipmiVisible)
      graph.setCellStyles(mxConstants.STYLE_STROKECOLOR, 'white', [ipmiStatus])
      statusCell.setVisible(self.state.topologyOption.hostStatusVisible)
    } else {
      ipmiStatus.setVisible(false)
      statusCell.setVisible(false)
    }
  } finally {
    model.endUpdate()
  }

  graph.setSelectionCell(v1)

  if (dataType === 'Server') {
    fetchIntervalData(graph, v1, self)
  }
}

const fetchIntervalData = async (graph, cell, self) => {
  await self.fetchIpmiStatus(cell.getId())
  await self.getDetectedHostStatus(cell.getId())
  graph.refresh(cell)
}

export const drawCellInGroup = (nodes: Menu[]) => (
  graph: mxGraphType,
  _event: any,
  _cell: mxCellType,
  x: number,
  y: number
) => {
  const parent = graph.getDefaultParent()
  const model = graph.getModel()
  let cells: mxCellType[] = null

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

      const statusBox = document.createElement('div')
      statusBox.classList.add('vertex')
      statusBox.setAttribute('btn-type', 'status')
      statusBox.setAttribute('data-status', 'agent')
      statusBox.style.display = 'flex'
      statusBox.style.alignItems = 'center'
      statusBox.style.justifyContent = 'center'

      const temperatureIcom = document.createElement('span')
      temperatureIcom.setAttribute('data-status-kind', 'temperature')
      temperatureIcom.style.marginRight = '5px'
      temperatureIcom.classList.add('time-series-status')

      statusBox.appendChild(temperatureIcom)

      const cpuIcon = document.createElement('span')
      cpuIcon.setAttribute('data-status-kind', 'cpu')
      cpuIcon.style.marginRight = '5px'
      cpuIcon.classList.add('time-series-status')

      statusBox.appendChild(cpuIcon)

      const memoryIcon = document.createElement('span')
      memoryIcon.setAttribute('data-status-kind', 'memory')
      memoryIcon.classList.add('time-series-status')

      statusBox.appendChild(memoryIcon)

      const diskIcon = document.createElement('span')
      diskIcon.setAttribute('data-status-kind', 'disk')
      diskIcon.style.marginLeft = '5px'
      diskIcon.classList.add('time-series-status')

      statusBox.appendChild(diskIcon)

      const statusCell = graph.insertVertex(
        vertex,
        null,
        statusBox.outerHTML,
        0.5,
        1,
        48,
        12,
        `status`,
        true
      )

      statusCell.geometry.offset = new mxPoint(-24, 6)
      statusCell.setConnectable(false)
      const statusCheck = _.get(node, 'status') ? true : false
      statusCell.setVisible(statusCheck)

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
    dragCell(node, this),
    dragElt,
    0,
    0,
    true,
    true
  )

  dragSource.setGuidesEnabled(true)
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
  if (cell.getStyle().includes('node')) {
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
  const evt = me.getProperty('event')
  if (evt?.button === 2 || evt?.buttons === 2) return

  const cell: mxCellType = me.getProperty('cell')

  if (!_.isEmpty(cell) && cell.style.includes('node')) {
    document.querySelector('#statusContainer').classList.remove('active')
    document.querySelector('#statusContainerRef').innerHTML = ``
    const containerElement = getContainerElement(cell.value)

    if (containerElement.hasAttribute('data-ipmi_host')) {
      const target = containerElement.getAttribute('data-using_minion')
      const ipmiHost = containerElement.getAttribute('data-ipmi_host')
      const ipmiUser = containerElement.getAttribute('data-ipmi_user')
      const ipmiPass = containerElement.getAttribute('data-ipmi_pass')

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

function getAbsoluteGeometry(cell: mxCellType) {
  let accumulatedX = 0
  let accumulatedY = 0

  const {x, y, width, height} = cell.getGeometry()

  let currentCell = cell.getParent()
  while (currentCell) {
    const parentGeometry = currentCell.getGeometry()

    if (parentGeometry) {
      accumulatedX += parentGeometry.x
      accumulatedY += parentGeometry.y
    }
    currentCell = currentCell.getParent()
  }

  return {x: accumulatedX + x, y: accumulatedY + y, width, height}
}

export const onMouseMovexGraph = function (
  _graph: mxGraphType,
  me: mxMouseEvent
) {
  const cell: mxCellType = me.getCell()
  if (_.isEmpty(cell)) {
    return
  }
  if (!_.isEmpty(cell) && cell.style.includes('node')) {
    const focusedCell = getContainerElement(
      this.graph.getModel().getValue(cell)
    )
    const dataType = focusedCell.getAttribute('data-type')

    if (dataType === 'Server') {
      const graphContainer = _graph.container
      const cellId = cell.getId()
      const containerRect = graphContainer.getBoundingClientRect()

      const currentScale = _graph.view.getScale()

      const {x, y, width} = getAbsoluteGeometry(cell)
      const {x: translateX, y: translateY} = _graph.view.getTranslate()

      const scaledX = (x + translateX) * currentScale
      const scaledY = (y + translateY) * currentScale
      const scaledWidth = width * currentScale
      const scaleOffset = TOOLTIP_OFFSET_X
      const compareY = scaledY + containerRect.y
      const compareX = scaledX + containerRect.x + scaledWidth + scaleOffset
      const isUnderContainerHeight = compareY < containerRect.y * DETECT_RATE
      const isOverContainerHeight =
        compareY > containerRect.height * DETECT_RATE
      const isOverContainerWidth = compareX > containerRect.width * DETECT_RATE

      const maxRenderY = compareY - (compareY - containerRect.height) - OUTLINE
      const minRenderX =
        compareX - (TOOLTIP_WIDTH + scaleOffset) - scaledWidth - scaleOffset

      let renderY = compareY
      let renderX = compareX

      if (isUnderContainerHeight) {
        renderY = containerRect.y
      }
      if (isOverContainerHeight) {
        renderY = maxRenderY
      }

      const geometry = {
        x: isOverContainerWidth ? minRenderX : renderX,
        y: renderY,
      }

      return {cell, geometry, isOverContainerHeight, cellId}
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
          label: '',
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
        if (ipmiHost && ipmiUser && ipmiPass && ipmiTarget) {
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

      if (containerElement.getAttribute('btn-type') === 'href') {
        this.graph.setSelectionCell(cell.parent)
      }
    }
  }

export const filteredIpmiPowerStatus = function (cells: mxCellType[]) {
  let ipmiCells: IpmiCell[] = []

  _.forEach(cells, cell => {
    if (cell.getStyle().includes('node')) {
      const containerElement = getContainerElement(cell.value)

      const ipmiTarget = containerElement.getAttribute('data-using_minion')
      const ipmiHost = containerElement.getAttribute('data-ipmi_host')
      const ipmiUser = containerElement.getAttribute('data-ipmi_user')
      const ipmiPass = containerElement.getAttribute('data-ipmi_pass')
      const hostname = containerElement.getAttribute('data-name')

      if (
        !_.isEmpty(ipmiTarget) &&
        !_.isEmpty(ipmiHost) &&
        !_.isEmpty(ipmiUser) &&
        !_.isEmpty(ipmiPass)
      ) {
        try {
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
            hostname: hostname,
          }

          ipmiCells = [...ipmiCells, ipmiCell]
        } catch (error) {
          this.props.notify(
            notifyDecryptedBytesFailed(
              `incorrect IPMI Password for ${hostname} : ${ipmiHost}`
            )
          )
        }
      } else {
        const emptyIpmiCell: IpmiCell = {
          target: '',
          host: '',
          user: '',
          pass: '',
          powerStatus: '',
          cell: cell,
          hostname: hostname,
        }
        ipmiCells = [...ipmiCells, emptyIpmiCell]
      }
    }
  })

  return ipmiCells
}

export const ipmiPowerIndicator = function (ipmiCellsStatus: IpmiCell[]) {
  if (!this.graph) return

  if (!ipmiCellsStatus || ipmiCellsStatus.length === 0) {
    return
  }

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
  } catch (err) {
    console.error('ipmiPowerIndicator Err: ', err)
  }
}

const notAvailableData = (childElement: any) => {
  childElement.removeAttribute('data-status-value')
  childElement.removeAttribute('data-status-value')
  childElement.removeAttribute('class')
  childElement.classList.add('time-series-status')
}

const renderHostState = (
  dataGatherType: string,
  statusKind: string,
  childElement: any,
  findHost: Host,
  selectedTemperatureValue: string = 'type:inside,active:1,min:38,max:55'
) => {
  const selectedTmpType = selectedTemperatureType(selectedTemperatureValue)

  const findKey = getSelectedHostKey({
    dataGatherType,
    statusKind,
    selectedTmpType,
  })

  const statusTitle = getStatusTitle({dataGatherType, findKey})

  if (!statusTitle) {
    notAvailableData(childElement)
    return
  }
  const hostValue = findHost[findKey]
  const statusValue = dataStatusValue(
    statusKind,
    hostValue,
    findHost,
    dataGatherType
  )

  childElement.setAttribute('data-status-value', _.toString(hostValue))
  childElement.removeAttribute('class')
  childElement.classList.add(
    'time-series-status',
    getTimeSeriesHostIndicator(
      findHost,
      findKey,
      statusKind,
      statusValue,
      selectedTemperatureValue
    )
  )
}

export const selectedTemperatureType = (
  preferenceTemperatureValue: string
): PreferenceType['temperatureType'] => {
  const selectedTemperatureType = preferenceTemperatureValue.match(
    /type:(\w+),/
  )

  return selectedTemperatureType[1] as PreferenceType['temperatureType']
}
export const getFocusedCell = (cells: mxCellType[], focusedCell: string) => {
  const findCells = cells.filter(
    cell => cell.getStyle().includes('node') && cell.getId() === focusedCell
  )

  return findCells
}

export const detectedHostsStatus = function (
  cells: mxCellType[],
  hostsObject: {[x: string]: Host},
  selectedTemperatureValue: string = 'type:inside,active:1,min:38,max:55'
) {
  if (!this.graph) return [0, new Error('Graph object is missing or null')]
  const {cpu, memory, disk, temperature} = TOOLTIP_TYPE

  if (!cells || cells.length === 0) {
    return [0, null]
  }

  let nodeCount = 0
  let error = null
  try {
    _.forEach(cells, cell => {
      if (cell.getStyle().includes('node')) {
        nodeCount++
        const containerElement = getContainerElement(cell.value)
        const name = containerElement.getAttribute('data-name')
        const findHost = _.find(hostsObject, host => host.name === name)

        if (!_.isEmpty(findHost)) {
          const childCells = this.graph.getChildCells(cell)
          this.graph.setCellStyles(
            mxConstants.STYLE_STROKECOLOR,
            Math.max(findHost.deltaUptime || 0, findHost.winDeltaUptime || 0) >
              0
              ? '#f58220'
              : '#bec2cc',
            [cell]
          )

          if (!_.isEmpty(childCells)) {
            _.forEach(childCells, childCell => {
              const childCellElement = getParseHTML(
                childCell.value
              ).querySelector('div')
              const dataGatherType = containerElement.getAttribute(
                'data-status'
              )

              if (childCellElement.getAttribute('data-status')) {
                const statusElement = childCellElement.querySelectorAll(
                  'span[data-status-kind]'
                )

                statusElement.forEach(childElement => {
                  const statusKind = childElement.getAttribute(
                    'data-status-kind'
                  )

                  renderHostState(
                    dataGatherType,
                    statusKind,
                    childElement,
                    findHost,
                    selectedTemperatureValue
                  )
                })

                childCell.setValue(childCellElement.outerHTML)
              }
            })
          }
        } else {
          const childCells = this.graph.getChildCells(cell)

          if (!_.isEmpty(childCells)) {
            _.forEach(childCells, childCell => {
              const childCellElement = getParseHTML(
                childCell.value
              ).querySelector('div')

              const statusElement = childCellElement.querySelectorAll(
                'span[data-status-kind]'
              )

              statusElement.forEach(childElement => {
                const statusKind = childElement.getAttribute('data-status-kind')

                if (
                  statusKind === cpu ||
                  statusKind === disk ||
                  statusKind === memory ||
                  statusKind === temperature
                ) {
                  childElement.removeAttribute('data-status-value')
                  childElement.removeAttribute('class')
                  childElement.classList.add('time-series-status')
                }
              })
              this.graph.setCellStyles(
                mxConstants.STYLE_STROKECOLOR,
                '#bec2cc',
                [cell]
              )
              childCell.setValue(childCellElement.outerHTML)
            })
          }
        }
      }
    })
  } catch (err) {
    error = err
  }

  return [nodeCount, error]
}

export const getFromOptions = (focusedInstance: Instance) => {
  switch (_.get(focusedInstance, 'provider')) {
    case CloudServiceProvider.AWS: {
      return agentFilter[CloudServiceProvider.AWS]
    }

    case CloudServiceProvider.GCP: {
      return agentFilter[CloudServiceProvider.GCP]
    }
    default: {
      return ['Agent', 'IPMI']
    }
  }
}

export const mouseOverTooltipStatus = (
  hostsObject: {[x: string]: Host},
  hostName: string,
  unsavedPreferenceTemperatureValues: string[],
  dataGatherType: string
) => {
  const focusedHost = _.find(hostsObject, host => host.name === hostName)

  const selectedTemperatureValue = _.find(
    unsavedPreferenceTemperatureValues,
    temperatureValue => temperatureValue.includes('active:1')
  )
  const selectedTmpType = selectedTemperatureType(selectedTemperatureValue)

  const findKeys = _.map(TOOLTIP_TYPE, statusKind =>
    getSelectedHostKey({
      dataGatherType,
      statusKind,
      selectedTmpType,
    })
  )
  const tooltipStatus = _.reduce(
    findKeys,
    (result, findKey) => {
      const statusKind = objectKeyWithGatherType[dataGatherType][findKey]
      const value = dataStatusValue(
        statusKind,
        focusedHost?.[findKey],
        focusedHost,
        dataGatherType
      )
      result[statusKind] = {
        title:
          getStatusTitle({dataGatherType, findKey}) ??
          getNotAvailableTitle({
            statusKind,
            selectedTmpType,
          }),
        status: getTimeSeriesHostIndicator(
          focusedHost,
          findKey,
          statusKind,
          value,
          selectedTemperatureValue
        ),
        value,
      }
      return result
    },
    {}
  )
  return tooltipStatus
}

export function refreshGraph(
  nodeCount: number | null,
  graph: any,
  cell: mxCellType
) {
  if (nodeCount && nodeCount > 1) {
    graph.refresh()
  } else if (nodeCount && nodeCount === 1) {
    graph.refresh(cell)
  }
}
