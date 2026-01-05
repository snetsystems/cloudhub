import {AlignType, ColumnInfo, TimeZones} from 'src/types'
import {TimeSeriesSeries} from 'src/types/series'

import {
  ColumnSettingInterface,
  TableGaugeChartOptionsInterface,
} from 'src/types/statisticalgraph'
import {ColorString, ColorNumber} from 'src/types/colors'
import {DEFAULT_LINE_COLORS} from 'src/shared/constants/graphColorPalettes'
import {DEFAULT_GAUGE_COLORS} from '../constants/thresholds'
import {FieldOption} from 'src/types/dashboards'

interface ConvertOptions {
  defaultMin?: number
  defaultMax?: number
}

export const convertTimeSeriesDataToColumns = (
  data: TimeSeriesSeries[],
  options?: ConvertOptions,
  tableGaugeChartOptions?: TableGaugeChartOptionsInterface,
  originFiledOptions?: FieldOption[]
): ColumnInfo[] => {
  if (!data || data.length === 0) {
    return []
  }

  const {defaultMin = 0, defaultMax = 100} = options || {}

  const firstSeries = data[0]
  const columnNames = (firstSeries?.columns || []).filter(col => col !== 'time')
  const tagName = firstSeries?.name || ''

  const nameColumnArray: ColumnInfo[] = Object.keys(
    firstSeries?.tags || {}
  ).map(key => {
    return {
      key: key,
      name:
        originFiledOptions?.find(field => field.internalName === key)
          ?.displayName || key,
      options: {
        sorting: true,
      },
    }
  })

  const gaugeColumns: ColumnInfo[] = (
    tableGaugeChartOptions?.columnSettings || []
  )
    .map(columnSetting => {
      const matchingColumnName = columnNames.find(col => {
        const internalName = columnSetting.internalName.replace(
          `${tagName}.`,
          ''
        )
        return internalName === col
      })

      if (!matchingColumnName) {
        return null
      }

      const columnName = matchingColumnName
      let min = defaultMin
      let max = defaultMax

      const columnIndex = data[0].columns.indexOf(columnName)
      const allValues: number[] = []

      data.forEach(series => {
        series.values.forEach(valueArray => {
          const value = valueArray[columnIndex]
          if (typeof value === 'number' && !isNaN(value)) {
            allValues.push(value)
          }
        })
      })

      if (allValues.length > 0) {
        min = Math.min(...allValues)
        max = Math.max(...allValues)

        if (min === max) {
          min = min > 0 ? 0 : min - 10
          max = max === 0 ? 100 : max + 10
        }
      }

      min = isNaN(columnSetting?.min) ? min : columnSetting?.min
      max = isNaN(columnSetting?.max) ? max : columnSetting?.max

      const displayName = columnSetting?.displayName || columnName
      const isShowChart = columnSetting?.isShowChart ?? true

      const colors: ColorString[] = columnSetting?.colors ?? DEFAULT_LINE_COLORS
      const thresholdColors: ColorNumber[] =
        columnSetting?.thresholdColors ?? DEFAULT_GAUGE_COLORS

      const gaugeOptions = {
        min,
        max,
        decimalPlaces: tableGaugeChartOptions?.decimalPlaces?.digits,
        colors,
        thresholdColors,
        chartType: columnSetting?.chartType,
        isPercent: columnSetting?.isPercent,
        backgroundType: columnSetting?.backgroundType,
        prefix: columnSetting?.prefix,
        suffix: columnSetting?.suffix,
        isValuesVisible: tableGaugeChartOptions?.isShowValues,
      }

      return {
        key: columnName,
        name: displayName,
        options: {
          thead: {
            align: AlignType.RIGHT,
          },
          isGauge: isShowChart,
          sorting: true,

          gaugeOptions,
        },
      }
    })
    .filter(column => column !== null) as ColumnInfo[]

  // Preserve the order from the raw series columns (excluding time) while
  // merging in tag columns and gauge columns.
  const gaugeMap = new Map<string, ColumnInfo>()
  gaugeColumns.forEach(col => gaugeMap.set(col.key, col))

  const nameMap = new Map<string, ColumnInfo>()
  nameColumnArray.forEach(col => nameMap.set(col.key, col))

  const orderedColumns: ColumnInfo[] = []

  columnNames.forEach(colKey => {
    if (gaugeMap.has(colKey)) {
      orderedColumns.push(gaugeMap.get(colKey) as ColumnInfo)
      gaugeMap.delete(colKey)
      return
    }
    if (nameMap.has(colKey)) {
      orderedColumns.push(nameMap.get(colKey) as ColumnInfo)
      nameMap.delete(colKey)
    }
  })

  // Append any remaining name or gauge columns that were not part of columnNames.
  nameMap.forEach(col => orderedColumns.push(col))
  gaugeMap.forEach(col => orderedColumns.push(col))

  return orderedColumns
}

export const matchedColumn = (
  data: TimeSeriesSeries[],
  columnSettings?: ColumnSettingInterface[]
) => {
  if (!columnSettings) {
    return []
  }

  const firstSeries = data[0]
  const columnNames = (firstSeries?.columns || []).filter(col => col !== 'time')
  const tagName = firstSeries?.name || ''

  return columnSettings.map(columnSetting => {
    const matchingColumnName = columnNames.find(col => {
      const internalName = columnSetting.internalName.replace(`${tagName}.`, '')
      return internalName === col
    })

    return matchingColumnName
  })
}
