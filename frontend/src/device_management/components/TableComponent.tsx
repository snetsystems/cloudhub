// Libraries
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

// Components
import SearchBar from 'src/hosts/components/SearchBar'
import TableBase from 'src/device_management/components/TableBase'
import {TableChartHoverProvider} from 'src/device_management/components/TableChartHoverContext'

// Types
import {
  ColumnInfo,
  SortInfo,
  DataTableObject,
  DataTableOptions,
  TimeZones,
} from 'src/types'
import PageSpinner from 'src/shared/components/PageSpinner'

interface Props {
  data: DataTableObject[]
  columns: ColumnInfo[]
  topLeftRender?: ReactNode
  toprightRender?: ReactNode
  checkedArray?: string[]
  setCheckedArray?: (value: string[]) => void
  isAccordion?: boolean
  accordionColumns?: ColumnInfo[]
  isCheckInit?: boolean
  isMultiSelect?: boolean
  isSearchDisplay?: boolean
  tableTitle?: string
  options?: DataTableOptions
  initSort?: SortInfo
  bodyClassName?: string
  timeZone?: TimeZones
  searchPlaceholder?: string
  isDotKey?: boolean
  isLoading?: boolean
  enableSharedChartHover?: boolean
}

function TableComponent({
  topLeftRender,
  toprightRender,
  isAccordion,
  isMultiSelect = true,
  accordionColumns,
  checkedArray,
  setCheckedArray,
  isCheckInit,
  columns,
  data,
  tableTitle,
  options,
  isSearchDisplay = true,
  initSort = null,
  bodyClassName,
  timeZone,
  searchPlaceholder,
  isDotKey = false,
  isLoading = false,
  enableSharedChartHover = false,
}: Props) {
  const [keyword, setKeyword] = useState('')

  const [sortTarget, setSortTarget] = useState<SortInfo | null>(initSort)

  useEffect(() => {
    !!setCheckedArray && setCheckedArray([])
  }, [isCheckInit])

  useEffect(() => {
    if (initSort) {
      setSortTarget(initSort)
    }
  }, [initSort])

  useEffect(() => {
    !!setCheckedArray && setCheckedArray(checkedArray)
  }, [checkedArray])

  const filterData = useMemo(() => {
    const keys = columns.map(item => item.key)
    return keyword
      ? (data as DataTableObject[]).filter(row => {
          return (
            keys
              .map(key => {
                if (key.includes('.')) {
                  const keyAry = key.split('.')
                  let result: any = row
                  keyAry.map(keyItem => {
                    result = result[keyItem]
                    return
                  })
                  return result
                } else {
                  return row[key]
                }
              })
              .filter(
                value =>
                  typeof value !== 'object' &&
                  `${value}`.toLowerCase().includes(keyword.toLowerCase())
              ).length > 0
          )
        })
      : (data as DataTableObject[])
  }, [keyword, data])

  const sortIp = (a: string, b: string) => {
    const aParts = a.split('.').map(Number)
    const bParts = b.split('.').map(Number)

    for (let i = 0; i < 4; i++) {
      if (aParts[i] < bParts[i]) return -1
      if (aParts[i] > bParts[i]) return 1
    }
    return 0
  }

  const toNumber = (val: any) => {
    if (typeof val === 'number' && Number.isFinite(val)) {
      return val
    }
    if (
      typeof val === 'string' &&
      val.trim() !== '' &&
      !Number.isNaN(Number(val))
    ) {
      return Number(val)
    }
    return null
  }

  const getArraySortValue = (value: any[], metric: SortInfo['sortArrayBy']) => {
    const getNumericValue = (item: any) => {
      if (
        item !== null &&
        item !== undefined &&
        typeof item === 'object' &&
        'value' in item
      ) {
        return toNumber(item.value)
      }

      return toNumber(item)
    }

    const numericValues = value
      .map(item => getNumericValue(item))
      .filter((item): item is number => item !== null)

    if (numericValues.length === 0) {
      return ''
    }

    if (metric === 'max') {
      return Math.max(...numericValues)
    }

    if (metric === 'min') {
      return Math.min(...numericValues)
    }

    if (metric === 'avr') {
      return (
        numericValues.reduce((sum, current) => sum + current, 0) /
        numericValues.length
      )
    }

    for (let index = value.length - 1; index >= 0; index--) {
      const numericValue = getNumericValue(value[index])
      if (numericValue !== null) {
        return numericValue
      }
    }

    return ''
  }

  const getComparableSortValue = (
    value: any,
    metric: SortInfo['sortArrayBy'] = 'last'
  ) => {
    if (!Array.isArray(value)) {
      return value
    }

    return getArraySortValue(value, metric)
  }

  const compareStringValues = (a: any, b: any) =>
    String(a ?? '').localeCompare(String(b ?? ''), undefined, {
      sensitivity: 'base',
      numeric: true,
    })

  const sortedData = useMemo(() => {
    const newData: DataTableObject[] = JSON.parse(JSON.stringify(filterData))
    if (sortTarget === null) {
      return newData
    }

    newData?.sort((a, b) => {
      let dataA = ''
      let dataB = ''
      if (sortTarget?.key.includes('.') && !isDotKey) {
        const keyAry = sortTarget?.key.split('.')
        let resultA: any = a
        let resultB: any = b
        keyAry.map(keyItem => {
          resultA = resultA[keyItem]
          resultB = resultB[keyItem]
          return
        })
        dataA = resultA
        dataB = resultB
      } else {
        dataA = (a[sortTarget.key] as any) ?? ''
        dataB = (b[sortTarget.key] as any) ?? ''
      }
      dataA = getComparableSortValue(dataA, sortTarget.sortArrayBy) as any
      dataB = getComparableSortValue(dataB, sortTarget.sortArrayBy) as any
      const isDesc = sortTarget.isDesc
      const numA = toNumber(dataA)
      const numB = toNumber(dataB)
      const bothNumeric = numA !== null && numB !== null

      if (isDesc) {
        if (sortTarget.isIP) {
          return sortIp(dataA, dataB) * -1
        }
        if (bothNumeric) {
          if (numA > numB) {
            return -1
          } else if (numA < numB) {
            return 1
          }
        }
        const stringCompare = compareStringValues(dataA, dataB)
        if (stringCompare !== 0) {
          return stringCompare * -1
        }
      } else {
        if (sortTarget.isIP) {
          return sortIp(dataA, dataB)
        }
        if (bothNumeric) {
          if (numA > numB) {
            return 1
          } else if (numA < numB) {
            return -1
          }
        }
        const stringCompare = compareStringValues(dataA, dataB)
        if (stringCompare !== 0) {
          return stringCompare
        }
      }

      return 0
    })
    return newData
  }, [sortTarget, filterData, JSON.stringify(data)])

  const onSort = useCallback(
    (column: ColumnInfo) => {
      const target = JSON.parse(JSON.stringify(sortTarget))
      if (sortTarget === null) {
        setSortTarget({
          key: column.key,
          isDesc: false,
          isIP: column.options?.isIP,
          sortArrayBy: column.options?.sortArrayBy,
        })
        return
      } else if (target.key !== column.key) {
        target.isDesc = false
        target.key = column.key
        target.isIP = column.options?.isIP
        target.sortArrayBy = column.options?.sortArrayBy
      } else {
        if (target.isDesc) {
          setSortTarget(null)
          return
        } else {
          target.isDesc = true
        }
      }

      setSortTarget(target)
    },
    [sortTarget]
  )

  const searchHandler = (value: string) => {
    setKeyword(value)
  }

  return (
    <div className="panel panel-solid">
      {(!!tableTitle ||
        !!topLeftRender ||
        !!toprightRender ||
        isSearchDisplay) && (
        <div className="panel-heading">
          <div className="table-top left">
            <h2 className="panel-title">{tableTitle}</h2>
            {/* left custom node */}
            {topLeftRender}
          </div>
          <div className="table-top right">
            {isSearchDisplay && (
              <SearchBar
                placeholder={searchPlaceholder ?? 'Filter by Host...'}
                onSearch={searchHandler}
              />
            )}
            {/* right custom node */}
            {toprightRender}
          </div>
        </div>
      )}
      <div className={`panel-body ${bodyClassName ?? ''}`}>
        {isLoading ? (
          <PageSpinner customClass="table-spinner" />
        ) : (
          <>
            {enableSharedChartHover ? (
              <TableChartHoverProvider>
                <TableBase
                  columns={columns}
                  data={sortedData}
                  accordionColumns={isAccordion ? accordionColumns : null}
                  isMultiSelect={isMultiSelect}
                  onCheck={setCheckedArray}
                  onSort={onSort}
                  checkedTargets={checkedArray}
                  sortTarget={sortTarget}
                  options={options}
                  timeZone={timeZone}
                />
              </TableChartHoverProvider>
            ) : (
              <TableBase
                columns={columns}
                data={sortedData}
                accordionColumns={isAccordion ? accordionColumns : null}
                isMultiSelect={isMultiSelect}
                onCheck={setCheckedArray}
                onSort={onSort}
                checkedTargets={checkedArray}
                sortTarget={sortTarget}
                options={options}
                timeZone={timeZone}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default TableComponent
