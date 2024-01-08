// Libraries
import _ from 'lodash'

// Types
import {Axes} from 'src/types'
import {CellType} from 'src/types/dashboards'
import {TimeSeriesSeries} from 'src/types/series'
import {
  Direction,
  RenamableField,
  StatisticalGraphDatasetConfigType,
} from 'src/types/statisticalgraph'

// Constants
import {
  LEGEND_FONT_SIZE_FONT_FAMILY,
  LEGEND_MIN_MARGIN_WIDTH,
} from 'src/shared/constants/staticGraph'

import {getLineColorsHexes} from 'src/shared/constants/graphColorPalettes'
import {ASCENDING} from 'src/shared/constants/tableGraph'

// Utilities
import {fastMap, fastReduce} from 'src/utils/fast'
import {changeColorsOpacity} from 'src/shared/graphs/helpers'

export const convertToStaticGraphMinMaxValue = (value: string) => {
  return /^-?\d+(\.\d+)?$/.test(value) && _.isFinite(_.toNumber(value))
    ? _.toNumber(value)
    : undefined
}

export const formatStaticGraphValue = (axes: Axes, value: number) => {
  let formattedValue

  switch (axes?.y?.base) {
    case 'raw':
      if (value >= 1e5) {
        formattedValue = value.toExponential(2)
      } else {
        formattedValue = value
      }
      break
    case '10':
      if (value >= 1e9) {
        formattedValue = (value / 1e9).toFixed(2) + ' B'
      } else if (value >= 1e6) {
        formattedValue = (value / 1e6).toFixed(2) + ' M'
      } else if (value >= 1e3) {
        formattedValue = (value / 1e3).toFixed(2) + ' K'
      } else {
        formattedValue = value
      }
      break
    case '2':
    default:
      if (value >= 1024 * 1024 * 1024) {
        formattedValue = (value / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
      } else if (value >= 1024 * 1024) {
        formattedValue = (value / (1024 * 1024)).toFixed(2) + ' MB'
      } else if (value >= 1024) {
        formattedValue = (value / 1024).toFixed(2) + ' KB'
      } else {
        formattedValue = value + ' B'
      }
      break
  }

  const prefix = axes?.y?.prefix ? axes.y.prefix : ''
  const suffix = axes?.y?.suffix ? axes.y.suffix : ''
  return prefix + formattedValue + suffix
}

export const findLongestString = (arr: any[], findKey?: string) => {
  if (!findKey) {
    return _.reduce(
      arr,
      (longest, current) => {
        return current.length > longest.length ? current : longest
      },
      ''
    )
  }

  return _.reduce(
    arr,
    (longest, current) => {
      const compareText = _.isArray(current[findKey])
        ? {[findKey]: _.join(current[findKey], '/')}
        : current

      return compareText[findKey].length > longest[findKey].length
        ? compareText
        : longest
    },
    {[findKey]: ''}
  )
}

export const measureTextWidthCanvas = (text: string, font: string): number => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (context) {
    context.font = font
    const metrics = context.measureText(text)
    return metrics.width
  }

  return 0
}

export const getMaxContentLength = (arr: any[], findKey?: string) => {
  const maxLengthLegend = findLongestString(arr, findKey)
  const textWidthCanvas = measureTextWidthCanvas(
    findKey ? maxLengthLegend[findKey] : maxLengthLegend,
    LEGEND_FONT_SIZE_FONT_FAMILY
  )

  return textWidthCanvas + LEGEND_MIN_MARGIN_WIDTH
}

export const sortedStaticGraphData = (
  rawData: TimeSeriesSeries[],
  {
    fields,
    sortKey,
    order,
  }: {fields: string[]; sortKey: string; order?: Direction}
) => {
  const fieldIndex = fields.indexOf(sortKey)
  const sortedIndex = fieldIndex === -1 ? 0 : fieldIndex

  const findChangedIndices = (
    current: number[][],
    next: number[][],
    sortedIndex
  ) => {
    const indexMap = next.reduce((acc, item, index) => {
      acc[item[sortedIndex]] = index
      return acc
    }, {})

    return current.map(item => indexMap[item[sortedIndex]])
  }

  const data = fastMap(rawData, item =>
    item.values[0].slice(1).map((value: number) => value)
  )
  const sortedData = [...data].sort((current, next) =>
    order === ASCENDING
      ? current[sortedIndex] - next[sortedIndex]
      : next[sortedIndex] - current[sortedIndex]
  )

  const sortedLabelsIndexList = findChangedIndices(
    sortedData,
    data,

    sortedIndex
  )
  const labels = fastMap(sortedLabelsIndexList, index =>
    _.values(rawData[index].tags)
  )
  return {sortedData, labels}
}

export const staticGraphDatasets = (cellType: CellType) => {
  switch (cellType) {
    case CellType.StaticStackedChart:
    case CellType.StaticLineChart:
    case CellType.Histogram: {
      return createBarChartDatasets
    }
    case CellType.StaticPie:
    case CellType.StaticDoughnut: {
      return createPieChartDatasets
    }
    default:
      return null
  }
}
const createPieChartDatasets = ({
  rawData,
  fieldOptions,
  tableOptions,
  colors,
}) => {
  const [{columns, name}] = rawData
  const sort = {
    fields: _.map(columns.slice(1), colum => `${name}.${colum}`),
    sortKey: tableOptions.sortBy.internalName,
    order: tableOptions.sortBy.direction,
  }
  const filteredFields: RenamableField[] = _.filter(
    fieldOptions,
    field => sort.fields.indexOf(field.internalName) !== -1
  )

  const {sortedData, labels} = sortedStaticGraphData(rawData, sort)
  const getColors = getLineColorsHexes(colors, labels.length)

  const datasets = fastReduce(
    filteredFields,
    (acc, col) => {
      if (col.visible) {
        acc.push({
          label: col.displayName !== '' ? col.displayName : col.internalName,
          data: fastMap(
            sortedData,
            item => item[sort.fields.indexOf(col.internalName)]
          ),
          backgroundColor: changeColorsOpacity(getColors, 0.5),
          borderColor: getColors,
          borderWidth: 1,
        })
      }
      return acc
    },
    []
  )
  return {
    labels,
    datasets,
  }
}

const createBarChartDatasets = ({
  rawData,
  fieldOptions,
  tableOptions,
  colors,
}: StatisticalGraphDatasetConfigType) => {
  const [{columns, name}] = rawData
  const sort = {
    fields: _.map(columns.slice(1), colum => `${name}.${colum}`),
    sortKey: tableOptions.sortBy.internalName,
    order: tableOptions.sortBy.direction,
  }
  const filteredFields: RenamableField[] = _.filter(
    fieldOptions,
    field => sort.fields.indexOf(field.internalName) !== -1
  )
  const getcolors = getLineColorsHexes(colors, filteredFields.length)
  const {sortedData, labels} = sortedStaticGraphData(rawData, sort)

  const datasets = fastReduce(
    filteredFields,
    (acc, col, colIndex) => {
      if (col.visible) {
        acc.push({
          label: col.displayName !== '' ? col.displayName : col.internalName,
          data: fastMap(
            sortedData,
            item => item[sort.fields.indexOf(col.internalName)]
          ),
          backgroundColor: changeColorsOpacity(getcolors, 0.7)[colIndex],
          borderColor: getcolors[colIndex],
          borderWidth: 1,
        })
      }
      return acc
    },
    []
  )
  return {
    labels,
    datasets,
  }
}
