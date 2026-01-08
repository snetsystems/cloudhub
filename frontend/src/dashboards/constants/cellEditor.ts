import {DEFAULT_TABLE_OPTIONS} from 'src/dashboards/constants'
import {stringifyColorValues} from 'src/shared/constants/colorOperations'
import {CellType, Axis, Axes, Legend} from 'src/types/dashboards'
import {ColorString, ColorNumber} from 'src/types/colors'

export const initializeOptions = (cellType: CellType) => {
  switch (cellType) {
    case 'table':
      return DEFAULT_TABLE_OPTIONS
    default:
      return DEFAULT_TABLE_OPTIONS
  }
}

export const AXES_SCALE_OPTIONS = {
  LINEAR: 'linear',
  LOG: 'log',
  BASE_2: '2',
  BASE_10: '10',
  BASE_RAW: 'raw',
}

type DefaultAxis = Pick<Axis, Exclude<keyof Axis, 'bounds'>>

export const DEFAULT_AXIS: DefaultAxis = {
  prefix: '',
  suffix: '',
  base: AXES_SCALE_OPTIONS.BASE_RAW,
  scale: AXES_SCALE_OPTIONS.LINEAR,
  label: '',
}

export const FULL_DEFAULT_AXIS: Axis = {
  ...DEFAULT_AXIS,
  bounds: ['', ''],
}

export const DEFAULT_AXES: Axes = {
  x: FULL_DEFAULT_AXIS,
  y: FULL_DEFAULT_AXIS,
}

interface Color {
  cellType: CellType
  thresholdsListColors: ColorNumber[]
  gaugeColors: ColorNumber[]
  lineColors: ColorString[]
}

export const getCellTypeColors = ({
  cellType,
  gaugeColors,
  thresholdsListColors,
  lineColors,
}: Color): ColorString[] => {
  switch (cellType) {
    case CellType.Gauge: {
      return stringifyColorValues(gaugeColors)
    }
    case CellType.SingleStat:
    case CellType.Table: {
      return stringifyColorValues(thresholdsListColors)
    }
    case CellType.Bar:
    case CellType.Line:
    case CellType.LinePlusSingleStat:
    case CellType.Stacked:
    case CellType.StaticPie:
    case CellType.StaticDoughnut:
    case CellType.StaticScatter:
    case CellType.StaticRadar:
    case CellType.StaticStackedBar:
    case CellType.StaticLineChart:
    case CellType.StaticBar:
    case CellType.StepPlot: {
      return stringifyColorValues(lineColors)
    }
    default: {
      return []
    }
  }
}

// normalizeTableGaugeChartOptions ensures threshold color values are strings for API payloads.
export const normalizeTableGaugeChartOptions = options => {
  if (!options || !Array.isArray(options.columnSettings)) {
    return options
  }

  const columnSettings = options.columnSettings.map(setting => {
    if (!setting || !Array.isArray(setting.thresholdColors)) {
      return setting
    }

    // Convert threshold color values to strings
    let thresholdColors = setting.thresholdColors
    if (Array.isArray(setting.thresholdColors)) {
      thresholdColors = setting.thresholdColors.map(color => ({
        ...color,
        value: `${color?.value ?? ''}`,
      }))
    }

    const min = convertToNumber(setting.min)
    const max = convertToNumber(setting.max)

    return {
      ...setting,
      min,
      max,
      thresholdColors,
    }
  })

  return {...options, columnSettings}
}

export const STATIC_LEGEND: Legend = {
  type: 'static',
  orientation: 'bottom',
}

// Convert min/max from string to number (null for empty/invalid values)
// Also convert undefined to null as defensive code
const convertToNumber = (
  value: string | number | null | undefined
): number | null => {
  // Defensive code: convert undefined to null
  if (value === undefined) {
    return null
  }
  if (value === null || value === '') {
    return null
  }
  if (typeof value === 'number') {
    return isNaN(value) ? null : value
  }
  const parsed = parseFloat(value as string)
  return isNaN(parsed) ? null : parsed
}
