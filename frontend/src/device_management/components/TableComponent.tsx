import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  ColumnInfo,
  SortInfo,
  DataTableObject,
  DataTableOptions,
  TimeZones,
} from 'src/types'
import TableBase from './TableBase'
import SearchBar from 'src/hosts/components/SearchBar'

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
}: Props) {
  const [keyword, setKeyword] = useState('')

  const [sortTarget, setSortTarget] = useState<SortInfo | null>(initSort)

  useEffect(() => {
    !!setCheckedArray && setCheckedArray([])
  }, [isCheckInit])

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

  const sortedData = useMemo(() => {
    const newData: DataTableObject[] = JSON.parse(JSON.stringify(filterData))
    if (sortTarget === null) {
      return newData
    }

    newData?.sort((a, b) => {
      let dataA = ''
      let dataB = ''

      if (sortTarget?.key.includes('.')) {
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
      const isDesc = sortTarget.isDesc

      if (isDesc) {
        if (sortTarget.isIP) {
          return sortIp(dataA, dataB) * -1
        }
        if (dataA > dataB) {
          return -1
        } else if (dataA < dataB) {
          return 1
        }
      } else {
        if (sortTarget.isIP) {
          return sortIp(dataA, dataB)
        }
        if (dataA > dataB) {
          return 1
        } else if (dataA < dataB) {
          return -1
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
          isIP: column.options.isIP,
        })
        return
      } else if (target.key !== column.key) {
        target.isDesc = false
        target.key = column.key
        target.isIp = column.options.isIP
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
      <div className="panel-heading">
        <div className="table-top left">
          <h2 className="panel-title">{tableTitle}</h2>
          {/* left custom node */}
          {topLeftRender}
        </div>
        <div className="table-top right">
          {isSearchDisplay && (
            <SearchBar
              placeholder="Filter by Host..."
              onSearch={searchHandler}
            />
          )}
          {/* right custom node */}
          {toprightRender}
        </div>
      </div>
      <div className={`panel-body ${bodyClassName ?? ''}`}>
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
      </div>
    </div>
  )
}

export default TableComponent
