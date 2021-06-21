import _ from 'lodash'

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
  console.log('getLabel: ', this, arguments[0])

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
  console.log('convertValueToString: ', this)
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
      this.createTextField(graph, form, cell, attr, isDisableName)
    })
    properties.appendChild(form.getTable())
  } else {
    mxUtils.writeln(properties, 'Nothing selected.')
  }
}
