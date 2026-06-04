import React, {ReactNode} from 'react'
import {ColumnInfo} from 'src/types'
import {TableGaugeChartOptionsInterface} from 'src/types/statisticalgraph'
import {ColorString, ColorNumber} from 'src/types/colors'
import {DEFAULT_LINE_COLORS} from 'src/shared/constants/graphColorPalettes'
import {DEFAULT_GAUGE_COLORS} from '../constants/thresholds'
import {DecimalPlaces, FieldOption, TimeSeriesValue} from 'src/types/dashboards'
import {AlignType} from 'src/types'
import TableGaugeCell from 'src/dashboards/components/TableGaugeCell'

interface DataTableObject {
  [key: string]: string | number | boolean | null | any
}

export const convertTimeSeriesDataToColumns = (
  data: DataTableObject[],
  tableGaugeChartOptions?: TableGaugeChartOptionsInterface,
  originFiledOptions?: FieldOption[],
  decimalPlaces?: DecimalPlaces,
  temVarCell?: (tempVar: string, isTempVarData: TimeSeriesValue) => ReactNode
): ColumnInfo[] => {
  if (!data || data.length === 0) {
    return []
  }

  const allKeys = new Set<string>()
  data.forEach(row => {
    Object.keys(row).forEach(key => {
      if (key !== 'time') allKeys.add(key)
    })
  })

  const columns: ColumnInfo[] = Array.from(allKeys).map(key => {
    const sampleValue = data.find(
      row => row[key] !== null && row[key] !== undefined
    )?.[key]
    const isNumberType = typeof sampleValue === 'number'
    const columnAlign = isNumberType ? AlignType.RIGHT : AlignType.LEFT

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

      const isTempVar = fieldOption?.tempVar !== ''
      if (isTempVar) {
        return {
          key: key,
          name: displayName,
          options: {
            sorting: true,
            thead: {
              align: AlignType.LEFT,
            },
          },
          render: (value: string) => {
            return temVarCell(fieldOption?.tempVar, value)
          },
        }
      }

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

    const colors: ColorString[] = gaugeSetting.colors ?? DEFAULT_LINE_COLORS
    const thresholdColors: ColorNumber[] =
      gaugeSetting.thresholdColors ?? DEFAULT_GAUGE_COLORS
    const gaugeOptions = {
      min: gaugeSetting.min,
      max: gaugeSetting.max,
      decimalPlaces: decimalPlaces?.isEnforced
        ? decimalPlaces?.digits
        : undefined,
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
          align: columnAlign,
        },
        sorting: true,
      },
      render: value => {
        return React.createElement(TableGaugeCell, {
          options: gaugeOptions,
          value,
        })
      },
    }
  })

  return columns
}
