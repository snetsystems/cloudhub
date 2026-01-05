// Libraries
import React, {useEffect, useMemo, useState} from 'react'
import _ from 'lodash'

// Components
import TableComponent from 'src/device_management/components/TableComponent'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

// Utils
import {convertTimeSeriesDataToColumns} from 'src/shared/utils/gaugeChartColumns'
import {useIsUpdateObj} from 'src/shared/utils/useIsUpdateObj'

// Types
import {ColumnInfo, DataTableObject, FluxTable} from 'src/types'
import {TimeSeriesServerResponse, TimeSeriesSeries} from 'src/types/series'
import {TableGaugeChartOptionsInterface} from 'src/types/statisticalgraph'
import {DecimalPlaces, FieldOption} from 'src/types/dashboards'
import {matchedColumn} from 'src/shared/utils/gaugeChartColumns'

interface Props {
  data: TimeSeriesServerResponse[] | FluxTable[]
  staticGraphStyle: React.CSSProperties
  tableGaugeChartOptions: TableGaugeChartOptionsInterface
  decimalPlaces: DecimalPlaces
  originFiledOptions: FieldOption[]
}

function StaticTableGaugeChart({
  data,
  staticGraphStyle,
  tableGaugeChartOptions,
  decimalPlaces,
  originFiledOptions,
}: Props) {
  const queryKey = _.get(data, ['0', 'response', 'uuid'], [])

  const isUpdated = useIsUpdateObj({queryKey, object: tableGaugeChartOptions})

  const [convertData, setConvertData] = useState<TimeSeriesSeries[]>()

  const [tableData, setTableData] = useState<DataTableObject[]>([])

  useEffect(() => {
    setConvertData(data[0]['response']['results'][0]['series'])
  }, [data])

  useEffect(() => {
    if (convertData) {
      setTableData(decimalizeTableData(convertData, decimalPlaces))
    }
  }, [convertData, decimalPlaces])

  const decimalizeTableData = (
    data: TimeSeriesSeries[],
    decimalPlaces: DecimalPlaces
  ) => {
    const newData = data.map(item => {
      const row: DataTableObject = {
        ...item.tags,
      }

      item.columns.forEach((column, index) => {
        if (index > 0) {
          if (decimalPlaces?.isEnforced) {
            row[column] = Number(item.values[0][index]).toFixed(
              decimalPlaces.digits
            )
          } else {
            row[column] = item.values[0][index]
          }
        }
      })

      return row
    })

    return newData
  }

  const normalizeInternalName = (name?: string, tagName?: string) => {
    if (!name) {
      return ''
    }
    return tagName ? name.replace(`${tagName}.`, '') : name
  }

  const buildNormalizedFields = (
    originFiledOptions?: FieldOption[],
    tagName?: string
  ) => {
    return (
      originFiledOptions
        ?.filter(field => field.internalName !== 'time')
        .map(field => ({
          key: normalizeInternalName(field.internalName, tagName),
          visible: field.visible !== false,
        })) || []
    )
  }

  const reorderColumns = (
    baseColumns: ColumnInfo[],
    normalizedFields: {key: string; visible: boolean}[],
    matchedColumns: string[]
  ): ColumnInfo[] => {
    const preferredOrder = normalizedFields
      .filter(field => field.visible)
      .map(field => field.key)

    const hiddenKeys = new Set(
      normalizedFields.filter(field => !field.visible).map(field => field.key)
    )

    const filteredColumns = baseColumns.filter(col => !hiddenKeys.has(col.key))

    //style width columns
    const styledColumns = setWidthColumns(
      filteredColumns,
      matchedColumns,
      hiddenKeys
    )

    if (!preferredOrder.length) {
      return styledColumns
    }

    const columnMap = new Map<string, ColumnInfo>(
      styledColumns.map(col => [col.key, col])
    )

    const ordered: ColumnInfo[] = []

    preferredOrder.forEach(key => {
      const found = columnMap.get(key)
      if (found) {
        ordered.push(found)
        columnMap.delete(key)
      }
    })

    columnMap.forEach(col => ordered.push(col))

    return ordered
  }

  const setWidthColumns = (
    columns: ColumnInfo[],
    matchedColumns: string[],
    hiddenKeys: Set<string>
  ) => {
    const visibleColumns = matchedColumns.filter(col => !hiddenKeys.has(col))

    return columns.map(col => {
      if (visibleColumns.includes(col.key)) {
        return {
          ...col,
          options: {
            ...col.options,
            thead: {
              ...col.options?.thead,
              style: {
                width: `${80 / visibleColumns.length}%`,
              },
            },
          },
        }
      }

      return col
    })
  }

  const columns = useMemo<ColumnInfo[]>(() => {
    if (!convertData) return []

    const baseColumns = convertTimeSeriesDataToColumns(
      convertData,
      {
        defaultMin: 0,
        defaultMax: 100,
      },
      tableGaugeChartOptions,
      originFiledOptions
    )

    const tagName = convertData?.[0]?.name
    const normalizedFields = buildNormalizedFields(originFiledOptions, tagName)

    // width setting
    const matchedColumns = matchedColumn(
      convertData,
      tableGaugeChartOptions?.columnSettings
    )

    const returnColumns = reorderColumns(
      baseColumns,
      normalizedFields,
      matchedColumns
    )
    return returnColumns
  }, [convertData, isUpdated, tableGaugeChartOptions, originFiledOptions])

  const initSort = useMemo(() => {
    const keyName = convertData?.[0]?.name
    return tableGaugeChartOptions?.sortBy
      ? {
          key: tableGaugeChartOptions?.sortBy.replace(`${keyName}.`, ''),
          isDesc: tableGaugeChartOptions?.sortByDirection === 'desc',
        }
      : null
  }, [tableGaugeChartOptions, convertData])

  return (
    <div className="dygraph-child">
      <div className="dygraph-child-container" style={{...staticGraphStyle}}>
        <FancyScrollbar className="display-options" autoHide={true}>
          <div className="static-graph-container table-gauge-chart">
            {columns.length > 0 && tableData.length > 0 && (
              <TableComponent
                data={tableData || []}
                columns={columns}
                isSearchDisplay={false}
                initSort={initSort}
              />
            )}
          </div>
        </FancyScrollbar>
      </div>
    </div>
  )
}

export default StaticTableGaugeChart
