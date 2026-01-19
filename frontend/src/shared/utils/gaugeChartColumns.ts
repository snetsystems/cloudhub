import {ColumnInfo} from 'src/types'
import {TableGaugeChartOptionsInterface} from 'src/types/statisticalgraph'
import {ColorString, ColorNumber} from 'src/types/colors'
import {DEFAULT_LINE_COLORS} from 'src/shared/constants/graphColorPalettes'
import {DEFAULT_GAUGE_COLORS} from '../constants/thresholds'
import {DecimalPlaces, FieldOption} from 'src/types/dashboards'
import {AlignType} from 'src/types'

interface DataTableObject {
  [key: string]: string | number | boolean | null | any
}

export const convertTimeSeriesDataToColumns = (
  data: DataTableObject[],
  tableGaugeChartOptions?: TableGaugeChartOptionsInterface,
  originFiledOptions?: FieldOption[],
  decimalPlaces?: DecimalPlaces
): ColumnInfo[] => {
  if (!data || data.length === 0) {
    return []
  }

  const DEFAULT_MIN = 0
  const DEFAULT_MAX = 100
  const allKeys = new Set<string>()
  data.forEach(row => {
    Object.keys(row).forEach(key => {
      if (key !== 'time') allKeys.add(key)
    })
  })

  const columns: ColumnInfo[] = Array.from(allKeys).map(key => {
    const gaugeSetting = tableGaugeChartOptions?.columnSettings?.find(
      setting => {
        return (
          setting.internalName === key ||
          setting.internalName.endsWith(`.${key}`)
        )
      }
    )

    if (!gaugeSetting) {
      const fieldOption = originFiledOptions?.find(f => f.internalName === key)
      const displayName = fieldOption?.displayName || key

      return {
        key: key,
        name: displayName,
        options: {
          sorting: true,
          thead: {
            align: AlignType.LEFT,
          },
        },
      }
    }

    let min = DEFAULT_MIN
    let max = DEFAULT_MAX

    const values = data
      .map(row => row[key])
      .filter(val => typeof val === 'number') as number[]

    if (values.length > 0) {
      const dataMin = Math.min(...values)
      const dataMax = Math.max(...values)

      if (dataMin === dataMax) {
        min = dataMin > 0 ? 0 : dataMin - 10
        max = dataMax === 0 ? 100 : dataMax + 10
      } else {
        min = dataMin
        max = dataMax
      }
    }

    min =
      gaugeSetting.min !== undefined && !isNaN(gaugeSetting.min)
        ? gaugeSetting.min
        : min
    max =
      gaugeSetting.max !== undefined && !isNaN(gaugeSetting.max)
        ? gaugeSetting.max
        : max

    const colors: ColorString[] = gaugeSetting.colors ?? DEFAULT_LINE_COLORS
    const thresholdColors: ColorNumber[] =
      gaugeSetting.thresholdColors ?? DEFAULT_GAUGE_COLORS

    const gaugeOptions = {
      min,
      max,
      decimalPlaces: decimalPlaces?.isEnforced ? decimalPlaces?.digits : 0,
      colors,
      thresholdColors,
      chartType: gaugeSetting.chartType,
      isPercent: gaugeSetting.isPercent,
      backgroundType: gaugeSetting.backgroundType,
      prefix: gaugeSetting.prefix,
      suffix: gaugeSetting.suffix,
      isValuesVisible: tableGaugeChartOptions?.isShowValues,
      isShowValues: gaugeSetting.isShowValues,
      valueFormat: gaugeSetting.valueFormat,
      isGauge: gaugeSetting.isShowChart ?? true,
    }

    return {
      key: key,
      name: gaugeSetting.displayName || key,
      options: {
        thead: {
          align: AlignType.RIGHT,
        },
        isGauge: true,
        sorting: true,
        gaugeOptions,
      },
    }
  })

  return columns
}
