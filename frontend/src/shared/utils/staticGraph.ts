// Libraries
import _ from 'lodash'

// Types
import {Axes} from 'src/types'
import {CellType} from 'src/types/dashboards'
import {TimeSeriesSeries} from 'src/types/series'
import {
  Direction,
  StatisticalGraphDatasetConfigType,
  StatisticalGraphFieldOption,
  StatisticalGraphTableOptions,
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
    groupByIndex,
  }: {
    fields: string[]
    sortKey: string
    order?: Direction
    groupByIndex: number
  }
) => {
  const fieldIndex = fields.indexOf(sortKey)
  const hasGroupByTags = rawData[0].tags ? true : false
  const groupByTagIndex = hasGroupByTags
    ? fields.indexOf(_.keys(rawData[0].tags)[groupByIndex])
    : 0
  const sortKeyWithoutTags = hasGroupByTags
    ? _.filter(fields, field => _.keys(rawData[0].tags).indexOf(field) === -1)
    : fields

  const YAxisIndex = sortKeyWithoutTags.indexOf(sortKey)
  const XAxisIndex = fieldIndex === -1 ? groupByTagIndex : fieldIndex

  const isSortedWithXAxis =
    hasGroupByTags && _.keys(rawData[0].tags).indexOf(fields[XAxisIndex]) !== -1

  const YAxisData = fastMap(rawData, item =>
    item.values[0].slice(1).map((value: number) => value)
  )

  const getSortedLabelsAndDataWithYAxis = (
    currentData: number[][],
    sortedIndex: number
  ) => {
    const indexMap = currentData.reduce((acc, item, index) => {
      acc[item[sortedIndex]] = index
      return acc
    }, {})
    const sortedData = [...currentData].sort((current, next) =>
      order === ASCENDING
        ? current[sortedIndex] - next[sortedIndex]
        : next[sortedIndex] - current[sortedIndex]
    )
    const labels = fastMap(
      sortedData.map(item => indexMap[item[sortedIndex]]),
      index => _.values(rawData[index].tags).join('/')
    )

    return {labels, sortedData}
  }

  const getSortedLabelsAndDataWithXAxis = (sortedIndex: number) => {
    const XAxisData = fastMap(rawData, item => item.tags[fields[sortedIndex]])
    const sortedXAxisData = [...XAxisData].sort((current, next) =>
      order === ASCENDING
        ? current.localeCompare(next)
        : next.localeCompare(current)
    )
    const sortedIndexListWithXAxis = sortedXAxisData.map(data =>
      XAxisData.indexOf(data)
    )
    const sortedData = sortedIndexListWithXAxis.map(data => YAxisData[data])
    const labels = fastMap(sortedIndexListWithXAxis, index =>
      _.values(rawData[index].tags).join('/')
    )
    return {labels, sortedData}
  }

  const {labels, sortedData} =
    hasGroupByTags && isSortedWithXAxis
      ? getSortedLabelsAndDataWithXAxis(XAxisIndex)
      : getSortedLabelsAndDataWithYAxis(YAxisData, YAxisIndex)

  return {sortedData, labels}
}

const createScatterChartDatasets = ({
  rawData,
  colors,
}: StatisticalGraphDatasetConfigType) => {
  const convertData = rawData
  const getColors = getLineColorsHexes(colors, convertData.length)
  const scatterData = fastMap(convertData, (item, colIndex) => {
    return {
      label: _.values(item.tags).join('/'),
      data: _.reduce(
        item.values,
        (acc: any[], value: any) => {
          if (!(value[1] ?? false) && !(value[2] ?? false)) {
            return acc
          }

          acc.push({x: value[1], y: value[2]})
          return acc
        },
        []
      ),
      backgroundColor: changeColorsOpacity([getColors[colIndex]], 0.8)[0],
      borderColor: getColors[colIndex],
      borderWidth: 1,
    }
  })

  return {
    labels: fastMap(convertData, item => _.values(item.tags)[0]) as string[],
    datasets: scatterData,
  }
}

const getChartFields = (
  fieldOptions: StatisticalGraphFieldOption[],
  tableOptions: StatisticalGraphTableOptions,
  rawData: TimeSeriesSeries[]
) => {
  const filteredFields: StatisticalGraphFieldOption[] = fastReduce(
    fieldOptions,
    (acc, field) => {
      if (field.internalName != 'time') {
        acc.push(field)
      }
      return acc
    },
    []
  )
  const sortFields = {
    fields: fastMap(filteredFields, field => field.internalName),
    sortKey: tableOptions.sortBy.internalName,
    order: tableOptions.sortBy.direction,
    groupByIndex: _.findIndex(
      filteredFields,
      field => field.groupByTagOrder === 0
    ),
  }
  const hasGroupByTags = rawData[0].tags ? true : false
  const excludeTags = hasGroupByTags
    ? fastReduce(
        filteredFields,
        (acc, field) => {
          if (_.keys(rawData[0].tags).indexOf(field.internalName) === -1) {
            acc.push(field)
          }
          return acc
        },
        []
      )
    : filteredFields
  const excludeTagsFields = fastMap(excludeTags, field => field.internalName)
  const originOrder = rawData[0].columns
    .slice(1)
    .map(value => `${rawData[0].name}.${value}`)

  return {
    excludeTagsFields,
    excludeTags,
    sortFields,
    originOrder,
  }
}

const createPieChartDatasets = ({
  rawData,
  fieldOptions,
  tableOptions,
  colors,
}: StatisticalGraphDatasetConfigType) => {
  const {excludeTags, sortFields, originOrder} = getChartFields(
    fieldOptions,
    tableOptions,
    rawData
  )
  const {sortedData, labels} = sortedStaticGraphData(rawData, sortFields)
  const getColors = getLineColorsHexes(colors, labels.length)

  const datasets = fastReduce(
    excludeTags,
    (acc, col) => {
      if (col.visible) {
        acc.push({
          label: col.displayName !== '' ? col.displayName : col.internalName,
          data: fastMap(
            sortedData,
            item => item[originOrder.indexOf(col.internalName)]
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
  const {
    excludeTags,
    excludeTagsFields,
    sortFields,
    originOrder,
  } = getChartFields(fieldOptions, tableOptions, rawData)
  const {sortedData, labels} = sortedStaticGraphData(rawData, sortFields)
  const getcolors = getLineColorsHexes(colors, excludeTagsFields.length)

  const datasets = fastReduce(
    excludeTags,
    (acc, col, colIndex) => {
      if (col.visible) {
        acc.push({
          label: col.displayName !== '' ? col.displayName : col.internalName,
          data: fastMap(
            sortedData,
            item => item[originOrder.indexOf(col.internalName)]
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

export const staticGraphDatasets = (cellType: CellType) => {
  switch (cellType) {
    case CellType.StaticStackedBar:
    case CellType.StaticLineChart:
    case CellType.StaticBar: {
      return createBarChartDatasets
    }
    case CellType.StaticPie:
    case CellType.StaticDoughnut: {
      return createPieChartDatasets
    }
    case CellType.StaticScatter: {
      return createScatterChartDatasets
    }
    default:
      return null
  }
}
