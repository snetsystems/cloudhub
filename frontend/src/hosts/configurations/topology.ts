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
  mxGraphSelectionModel as mxGraphSelectionModeltype,
  mxEventObject as mxEventObjectType,
  mxGraphExportObject,
} from 'mxgraph'

// Utils
import {
  getContainerElement,
  getContainerTitle,
  getIsDisableName,
  getIsHasString,
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

const mx = mxgraph()
const {
  mxClient,
  mxGraph,
  mxEvent,
  mxCodec,
  mxUtils,
  mxOutline,
  mxConstants,
  mxPerimeter,
  mxEdgeStyle,
  mxImage,
  mxForm,
  mxPoint,
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

export const setOutline = function () {
  const outln = new mxOutline(this.graph, this.outline)
  outln.outline.labelsVisible = true
  outln.outline.setHtmlLabels(true)
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

export const createForm = function (graph, properties) {
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

              childrenCell.setVisible(getIsHasString(newValue))
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
  } finally {
    model.endUpdate()
  }

  graph.setSelectionCell(v1)
}
