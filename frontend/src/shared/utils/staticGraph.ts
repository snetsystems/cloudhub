// Libraries
import _ from 'lodash'

// Types
import {Axes} from 'src/types'
import {CellType} from 'src/types/dashboards'
import {TimeSeriesSeries} from 'src/types/series'
import {
  Direction,
  StatisticalGraphBoundsType,
  StatisticalGraphDatasetConfigType,
  StatisticalGraphFieldOption,
  StatisticalGraphMinMaxValueType,
  StatisticalGraphScaleType,
  StatisticalGraphTableOptions,
} from 'src/types/statisticalgraph'

// Constants
import {
  LEGEND_FONT_SIZE_FONT_FAMILY,
  LEGEND_MIN_MARGIN_WIDTH,
  STATIC_GRAPH_OPTIONS,
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

export const formatStaticGraphValue = (
  axes: Axes,
  value: number,
  axesType = 'y'
) => {
  let formattedValue

  let axesBase = axesType === 'x' ? axes?.x?.base : axes?.y?.base
  switch (axesBase) {
    case 'raw':
      if (value >= 1e5) {
        formattedValue = value.toExponential(2)
      } else {
        formattedValue = formatNumberForGraphWithPrecision(value)
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
        formattedValue = formatNumberForGraphWithPrecision(value)
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
        formattedValue = formatNumberForGraphWithPrecision(value) + ' B'
      }
      break
  }

  switch (axesType) {
    case 'x': {
      const prefix = axes?.x?.prefix ? axes.x.prefix : ''
      const suffix = axes?.x?.suffix ? axes.x.suffix : ''
      return prefix + formattedValue + suffix
    }

    case 'y':
    default: {
      const prefix = axes?.y?.prefix ? axes.y.prefix : ''
      const suffix = axes?.y?.suffix ? axes.y.suffix : ''
      return prefix + formattedValue + suffix
    }
  }
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

const sortObjectByKey = (
  obj: {[key: string]: string},
  selectedKey: string
): string => {
  const selectedValue = obj[selectedKey]
  const sortedKeys = Object.keys(obj)
    .filter(key => key !== selectedKey)
    .sort()

  return [selectedValue, ...sortedKeys.map(key => obj[key])].join('.')
}

export const truncateLabelsWithEllipsis = (str: string) => {
  const strLength = str.length
  return strLength < 10
    ? str
    : str.slice(0, 3) + '...' + str.slice(strLength - 3, strLength)
}

export const formatNumberForGraphWithPrecision = (
  value: number,
  decimalPlaces: number = 2,
  minValueForExponential: number = 0.01
): string => {
  if (Math.abs(value) === 0) {
    return value.toString()
  }
  return Math.abs(value) < minValueForExponential
    ? value.toExponential(decimalPlaces)
    : value.toFixed(decimalPlaces)
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
  },
  sortingBasisField: string[]
) => {
  const fieldIndex = fields.indexOf(sortKey)
  const isFoundSortKey = fieldIndex !== -1

  const hasGroupByTags = rawData[0].tags ? true : false
  const groupByTagIndex = hasGroupByTags ? groupByIndex : 0

  const YAxisIndex = sortingBasisField.indexOf(sortKey)

  const XAxisIndex =
    !isFoundSortKey || sortingBasisField[fieldIndex] ? groupByTagIndex : 0

  const isSortedWithXAxis =
    !isFoundSortKey || _.keys(rawData[0].tags).indexOf(sortKey) !== -1

  const YAxisData = fastMap(rawData, item =>
    item.values[0].slice(1).map((value: number) => value)
  )

  const getSortedLabelsAndDataWithYAxis = (
    currentData: number[][],
    sortedIndex: number
  ) => {
    const indexMap = currentData.reduce((acc, item, index) => {
      const key = item[sortedIndex]
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(index)
      return acc
    }, {} as Record<number, number[]>)

    const sortedData = [...currentData].sort((current, next) =>
      order === ASCENDING
        ? current[sortedIndex] - next[sortedIndex]
        : next[sortedIndex] - current[sortedIndex]
    )
    const labels = sortedData.map(item => {
      const indexes = indexMap[item[sortedIndex]]
      const index = indexes.shift()
      return _.values(rawData[index].tags).join('/')
    })

    return {labels, sortedData}
  }

  const getSortedLabelsAndDataWithXAxis = (sortedIndex: number) => {
    const XAxisData = fastMap(rawData, item =>
      sortObjectByKey(item.tags, fields[sortedIndex])
    )

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
  const sortingBasisField = rawData[0].columns
    .slice(1)
    .map(value => `${rawData[0].name}.${value}`)

  return {
    excludeTagsFields,
    excludeTags,
    sortFields,
    sortingBasisField,
  }
}

const createPieChartDatasets = ({
  rawData,
  fieldOptions,
  tableOptions,
  colors,
}: StatisticalGraphDatasetConfigType) => {
  const {excludeTags, sortFields, sortingBasisField} = getChartFields(
    fieldOptions,
    tableOptions,
    rawData
  )
  const {sortedData, labels} = sortedStaticGraphData(
    rawData,
    sortFields,
    sortingBasisField
  )
  const getColors = getLineColorsHexes(colors, labels.length)

  const datasets = fastReduce(
    excludeTags,
    (acc, col) => {
      if (col.visible) {
        acc.push({
          label: col.displayName !== '' ? col.displayName : col.internalName,
          data: fastMap(
            sortedData,
            item => item[sortingBasisField.indexOf(col.internalName)]
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
    sortingBasisField,
  } = getChartFields(fieldOptions, tableOptions, rawData)

  const {sortedData, labels} = sortedStaticGraphData(
    rawData,
    sortFields,
    sortingBasisField
  )
  const getcolors = getLineColorsHexes(colors, excludeTagsFields.length)

  const datasets = fastReduce(
    excludeTags,
    (acc, col, colIndex) => {
      if (col.visible) {
        acc.push({
          label: col.displayName !== '' ? col.displayName : col.internalName,
          data: fastMap(
            sortedData,
            item => item[sortingBasisField.indexOf(col.internalName)]
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

const createRadarChartDatasets = ({
  rawData,

  colors,
}: StatisticalGraphDatasetConfigType) => {
  const convertData = rawData
  const columns = convertData[0].columns
  const processedData = fastMap(convertData, item =>
    item.values[0].slice(1).map(value => value)
  )
  const axesX = fastMap(convertData, item => _.values(item.tags))
  const getcolors = getLineColorsHexes(colors, columns.length - 1)
  const datasets = columns.slice(1).map((col, colIndex) => ({
    label: col,
    data: fastMap(processedData, data => data[colIndex]),
    backgroundColor: changeColorsOpacity(getcolors, 0.2)[colIndex],
    borderColor: getcolors[colIndex],
    borderWidth: 1,
    pointBackgroundColor: changeColorsOpacity(getcolors, 0.7)[colIndex],
    pointBorderColor: getcolors[colIndex],
    pointHoverBackgroundColor: '#fff',
    pointHoverBorderColor: getcolors[colIndex],
  }))

  return {
    labels: axesX,
    datasets,
  }
}

const isValidValue = value => {
  return value !== undefined && value !== ''
}

const createBarChartOptions = ({
  axes,
  xAxisTitle,
  yAxisTitle,
  barChartType,
}: {
  axes: Axes
  xAxisTitle?: string
  yAxisTitle?: string
  barChartType: CellType
}) => {
  const type: StatisticalGraphScaleType =
    axes?.y?.scale === 'log' ? 'logarithmic' : undefined
  const bounds: StatisticalGraphBoundsType = axes?.y?.bounds
  const min: StatisticalGraphMinMaxValueType = convertToStaticGraphMinMaxValue(
    bounds[0]
  )
  const max: StatisticalGraphMinMaxValueType = convertToStaticGraphMinMaxValue(
    bounds[1]
  )

  const dynamicOption = {
    ...STATIC_GRAPH_OPTIONS,
    plugins: {
      ...STATIC_GRAPH_OPTIONS.plugins,
      tooltip: {
        ...STATIC_GRAPH_OPTIONS.plugins.tooltip,
        callbacks: {
          ...STATIC_GRAPH_OPTIONS.plugins.tooltip.callbacks,
          title: function (tooltipItems) {
            return tooltipItems[0].label
          },
          label: function (context) {
            return [
              ` ${context.dataset.label}:${formatStaticGraphValue(
                axes,
                context.raw
              )}`,
            ]
          },
        },
      },
    },
    scales: {
      x: {
        ...STATIC_GRAPH_OPTIONS.scales?.x,
        title: {
          ...STATIC_GRAPH_OPTIONS.scales?.x?.title,
          text: xAxisTitle,
        },
        stacked: barChartType === CellType.StaticStackedBar,
        ticks: {
          ...STATIC_GRAPH_OPTIONS.scales?.x?.ticks,
          callback: function (value) {
            return (
              axes?.x?.prefix +
              truncateLabelsWithEllipsis(this.getLabelForValue(value)) +
              axes?.x?.suffix
            )
          },
        },
      },
      y: {
        ...STATIC_GRAPH_OPTIONS.scales?.y,
        ...(type && {type}),
        ...(isValidValue(min) && {min}),
        ...(isValidValue(max) && {max}),
        title: {
          ...STATIC_GRAPH_OPTIONS.scales?.y?.title,
          text: yAxisTitle,
        },
        stacked: barChartType === CellType.StaticStackedBar,
        ticks: {
          ...STATIC_GRAPH_OPTIONS.scales?.y?.ticks,
          callback: function (value) {
            return formatStaticGraphValue(axes, value)
          },
        },
      },
    },
  }

  return dynamicOption
}

const createScatterChartOptions = ({
  axes,
  xAxisTitle,
  yAxisTitle,
}: {
  axes: Axes
  xAxisTitle?: string
  yAxisTitle?: string
}) => {
  const xType: StatisticalGraphScaleType =
    axes?.x?.scale === 'log' ? 'logarithmic' : undefined
  const yType: StatisticalGraphScaleType =
    axes?.y?.scale === 'log' ? 'logarithmic' : undefined
  const xBounds: StatisticalGraphBoundsType = axes?.x?.bounds
  const xMin: StatisticalGraphMinMaxValueType = convertToStaticGraphMinMaxValue(
    xBounds[0]
  )
  const xMax: StatisticalGraphMinMaxValueType = convertToStaticGraphMinMaxValue(
    xBounds[1]
  )
  const yBounds: StatisticalGraphBoundsType = axes?.y?.bounds
  const yMin: StatisticalGraphMinMaxValueType = convertToStaticGraphMinMaxValue(
    yBounds[0]
  )
  const yMax: StatisticalGraphMinMaxValueType = convertToStaticGraphMinMaxValue(
    yBounds[1]
  )

  const dynamicOption = {
    ...STATIC_GRAPH_OPTIONS,
    plugins: {
      ...STATIC_GRAPH_OPTIONS.plugins,
      tooltip: {
        ...STATIC_GRAPH_OPTIONS.plugins.tooltip,
        callbacks: {
          ...STATIC_GRAPH_OPTIONS.plugins.tooltip.callbacks,
          title: function (tooltipItems) {
            return tooltipItems[0].dataset.label || ''
          },
          label: function (context) {
            const label = ` ${axes?.x?.label || xAxisTitle}, ${
              axes?.y?.label || yAxisTitle
            }`
            const {x, y} = context.dataset.data[0] ?? {x: '0', y: '0'}

            return [
              label,
              `(${formatStaticGraphValue(
                axes,
                x,
                'x'
              )} , ${formatStaticGraphValue(axes, y, 'y')})`,
            ]
          },
        },
      },
    },
    scales: {
      x: {
        ...STATIC_GRAPH_OPTIONS.scales?.x,
        ...(xType && {type: xType}),
        ...(isValidValue(xMin) && {min: xMin}),
        ...(isValidValue(xMax) && {max: xMax}),
        title: {
          ...STATIC_GRAPH_OPTIONS.scales?.x?.title,
          text: xAxisTitle,
        },
        ticks: {
          ...STATIC_GRAPH_OPTIONS.scales?.x?.ticks,
          callback: function (value) {
            return formatStaticGraphValue(axes, value, 'x')
          },
        },
      },
      y: {
        ...STATIC_GRAPH_OPTIONS.scales?.y,
        ...(yType && {type: yType}),
        ...(isValidValue(yMin) && {min: yMin}),
        ...(isValidValue(yMax) && {max: yMax}),
        title: {
          ...STATIC_GRAPH_OPTIONS.scales?.y?.title,
          text: yAxisTitle,
        },
        ticks: {
          ...STATIC_GRAPH_OPTIONS.scales?.y?.ticks,
          callback: function (value) {
            return formatStaticGraphValue(axes, value)
          },
        },
      },
    },
  }
  return dynamicOption
}

const createPieOptions = ({axes}: {axes: Axes}) => {
  const dynamicOption = {
    ...STATIC_GRAPH_OPTIONS,
    plugins: {
      ...STATIC_GRAPH_OPTIONS.plugins,
      zoom: {},
      tooltip: {
        ...STATIC_GRAPH_OPTIONS.plugins.tooltip,
        callbacks: {
          ...STATIC_GRAPH_OPTIONS.plugins.tooltip.callbacks,
          title: function (tooltipItems) {
            return tooltipItems[0].label
          },
          label: function (context) {
            return [
              ` ${context.dataset.label}: ${formatStaticGraphValue(
                axes,
                context.raw
              )}`,
            ]
          },
        },
      },
    },
    scales: {},
  }

  return dynamicOption
}
const createStaticRadarOptions = ({axes}: {axes: Axes}) => {
  const bounds: StatisticalGraphBoundsType = axes?.y?.bounds
  const min: StatisticalGraphMinMaxValueType = convertToStaticGraphMinMaxValue(
    bounds[0]
  )
  const max: StatisticalGraphMinMaxValueType = convertToStaticGraphMinMaxValue(
    bounds[1]
  )
  const dynamicOption = {
    ...STATIC_GRAPH_OPTIONS,
    plugins: {
      ...STATIC_GRAPH_OPTIONS.plugins,
      zoom: {},
      tooltip: {
        ...STATIC_GRAPH_OPTIONS.plugins.tooltip,
        callbacks: {
          ...STATIC_GRAPH_OPTIONS.plugins.tooltip.callbacks,
          title: function (tooltipItems) {
            return tooltipItems[0].label
          },
          label: function (context) {
            return [
              ` ${context.dataset.label}: ${formatStaticGraphValue(
                axes,
                context.raw
              )}`,
            ]
          },
        },
      },
    },
    elements: {
      line: {
        borderWidth: 3,
      },
    },
    scales: {
      r: {
        ...STATIC_GRAPH_OPTIONS.scales?.r,
        min: min,
        max: max,
        ticks: {
          ...STATIC_GRAPH_OPTIONS.scales?.r?.ticks,
          callback: function (value) {
            return formatStaticGraphValue(axes, value)
          },
        },
      },
    },
  }
  return dynamicOption
}

export const staticGraphDatasets = (cellType: CellType) => {
  const datasetCreators = {
    [CellType.StaticStackedBar]: createBarChartDatasets,
    [CellType.StaticLineChart]: createBarChartDatasets,
    [CellType.StaticBar]: createBarChartDatasets,
    [CellType.StaticPie]: createPieChartDatasets,
    [CellType.StaticDoughnut]: createPieChartDatasets,
    [CellType.StaticScatter]: createScatterChartDatasets,
    [CellType.StaticRadar]: createRadarChartDatasets,
  }

  return datasetCreators[cellType] || null
}

export const staticGraphOptions = {
  [CellType.StaticStackedBar]: ({axes, xAxisTitle, yAxisTitle}) =>
    createBarChartOptions({
      axes,
      xAxisTitle,
      yAxisTitle,
      barChartType: CellType.StaticStackedBar,
    }),
  [CellType.StaticLineChart]: ({axes, xAxisTitle, yAxisTitle}) =>
    createBarChartOptions({
      axes,
      xAxisTitle,
      yAxisTitle,
      barChartType: CellType.StaticLineChart,
    }),
  [CellType.StaticBar]: ({axes, xAxisTitle, yAxisTitle}) =>
    createBarChartOptions({
      axes,
      xAxisTitle,
      yAxisTitle,
      barChartType: CellType.StaticBar,
    }),
  [CellType.StaticPie]: createPieOptions,
  [CellType.StaticDoughnut]: createPieOptions,
  [CellType.StaticScatter]: createScatterChartOptions,
  [CellType.StaticRadar]: createStaticRadarOptions,
}
