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
import {
  ColumnInfo,
  DataTableObject,
  FluxTable,
  Template,
  TemplateValue,
} from 'src/types'
import {
  TimeSeriesServerResponse,
  TimeSeriesSeries,
  TimeSeriesValue,
} from 'src/types/series'
import {
  ColumnSettingInterface,
  TableGaugeChartOptionsInterface,
} from 'src/types/statisticalgraph'
import {DecimalPlaces, FieldOption} from 'src/types/dashboards'

interface Props {
  data: TimeSeriesServerResponse[] | FluxTable[]
  staticGraphStyle: React.CSSProperties
  tableGaugeChartOptions: TableGaugeChartOptionsInterface
  decimalPlaces: DecimalPlaces
  originFiledOptions: FieldOption[]
  onPickTemplate?: (template: Template, value: TemplateValue) => void
  templates?: Template[]
}

function StaticTableGaugeChart({
  data,
  staticGraphStyle,
  tableGaugeChartOptions,
  decimalPlaces,
  originFiledOptions,
  onPickTemplate,
  templates,
}: Props) {
  const queryKey = _.get(data, ['0', 'response', 'uuid'], [])

  const isUpdated = useIsUpdateObj({queryKey, object: tableGaugeChartOptions})

  const [convertData, setConvertData] = useState<TimeSeriesSeries[][]>()

  const [tableData, setTableData] = useState<DataTableObject[]>([])

  useEffect(() => {
    const rowData = data.map(item =>
      _.get(item, ['response', 'results', '0', 'series'], [])
    )

    setConvertData(rowData)
  }, [data])

  const mergeDataByTags = (rawData: any[]): DataTableObject[] => {
    const mergedMap = new Map<string, DataTableObject>()

    rawData.forEach(rootItem => {
      const results = rootItem?.response?.results || []

      results.forEach((result: any) => {
        const seriesList = result?.series || []

        seriesList.forEach((seriesItem: any) => {
          const tags = seriesItem.tags || {}
          const columns = seriesItem.columns || []
          const values = seriesItem.values || []

          if (values.length === 0) return

          const tagSignature = Object.keys(tags)
            .sort()
            .map(key => `${key}:${tags[key]}`)
            .join('|')

          let targetRow = mergedMap.get(tagSignature)

          if (!targetRow) {
            targetRow = {...tags}
            mergedMap.set(tagSignature, targetRow)
          }

          columns.forEach((colName: string, index: number) => {
            if (index > 0) {
              const val = values[0][index]

              if (val !== undefined && val !== null) {
                targetRow![colName] = val
              }
            }
          })
        })
      })
    })

    return Array.from(mergedMap.values())
  }

  useEffect(() => {
    if (data && data.length > 0) {
      const finalResult = mergeDataByTags(data)
      setTableData(finalResult)
    }
  }, [data])

  const normalizeInternalName = (name?: string, tagName?: string[]) => {
    if (!name) {
      return ''
    }

    if (!tagName || tagName.length === 0) {
      return name
    }

    for (const tag of tagName) {
      const prefix = `${tag}.`
      if (name.startsWith(prefix)) {
        return name.replace(prefix, '')
      }
    }

    return name
  }

  const buildNormalizedFields = (
    originFiledOptions?: FieldOption[],
    tagNameList?: string[]
  ) => {
    return (
      originFiledOptions
        ?.filter(field => field.internalName !== 'time')
        .map(field => ({
          key: normalizeInternalName(field.internalName, tagNameList),
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
                width: `${100 / visibleColumns.length}%`,
              },
            },
          },
        }
      }

      return col
    })
  }

  const matchedColumn = (
    data: DataTableObject[],
    columnSettings?: ColumnSettingInterface[],
    tagNameList?: string[]
  ) => {
    if (!columnSettings || !data || data.length === 0) {
      return []
    }

    const columnNamesSet = new Set<string>()
    data.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key !== 'time') {
          columnNamesSet.add(key)
        }
      })
    })
    const columnNames = Array.from(columnNamesSet)

    return columnSettings.map(columnSetting => {
      const normalizedInternalName = normalizeInternalName(
        columnSetting.internalName,
        tagNameList
      )

      const matchingColumnName = columnNames.find(
        col => col === normalizedInternalName
      )

      return matchingColumnName
    })
  }

  const handleClickCell = (
    tempVar: string,
    isTempVarData: TimeSeriesValue
  ) => async (): Promise<void> => {
    const temp = templates && templates.find(f => f.tempVar === tempVar)
    const val = temp && temp.values.find(f => f.value === isTempVarData)
    if (typeof onPickTemplate === 'function' && temp !== undefined) {
      onPickTemplate(temp, val)
    }
  }

  const temVarCell = (tempVar: string, isTempVarData: TimeSeriesValue) => {
    return (
      <div
        className="template-variable-cell"
        onClick={handleClickCell(tempVar, isTempVarData)}
      >
        {isTempVarData}
      </div>
    )
  }

  const columns = useMemo<ColumnInfo[]>(() => {
    if (!tableData) return []

    const baseColumns = convertTimeSeriesDataToColumns(
      tableData,
      tableGaugeChartOptions,
      originFiledOptions,
      decimalPlaces,
      temVarCell
    )

    const tagNameList: string[] = convertData?.map(item => item[0].name) || []

    const normalizedFields = buildNormalizedFields(
      originFiledOptions,
      tagNameList
    )

    // width setting
    const matchedColumns = matchedColumn(
      tableData,
      tableGaugeChartOptions?.columnSettings,
      tagNameList
    )

    const returnColumns = reorderColumns(
      baseColumns,
      normalizedFields,
      matchedColumns
    )
    return returnColumns
  }, [
    tableData,
    isUpdated,
    tableGaugeChartOptions,
    decimalPlaces,
    originFiledOptions,
  ])

  const initSort = useMemo(() => {
    if (!tableGaugeChartOptions?.sortBy) {
      return null
    }

    const tagNameList: string[] =
      convertData?.map(item => item[0]?.name).filter(Boolean) || []

    return {
      key: normalizeInternalName(tableGaugeChartOptions.sortBy, tagNameList),
      isDesc: tableGaugeChartOptions.sortByDirection === 'desc',
    }
  }, [tableGaugeChartOptions, convertData])

  return (
    <div className="dygraph-child">
      <div
        className="dygraph-child-container"
        style={{
          ...staticGraphStyle,
        }}
      >
        <FancyScrollbar className="display-options" autoHide={true}>
          <div className="static-graph-container table-gauge-chart">
            {columns.length > 0 && tableData.length > 0 && (
              <TableComponent
                data={tableData || []}
                columns={columns}
                isSearchDisplay={false}
                initSort={initSort}
                isDotKey={true}
              />
            )}
          </div>
        </FancyScrollbar>
      </div>
    </div>
  )
}

export default StaticTableGaugeChart
