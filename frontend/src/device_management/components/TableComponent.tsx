import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {ColumnInfo, SortInfo, DataTableObject} from 'src/types'
import TableBase from './TableBase'
import SearchBar from 'src/hosts/components/SearchBar'

interface Props {
  topLeftRender?: ReactNode
  toprightRender?: ReactNode
  isAccordion?: boolean
  accordionColumns?: ColumnInfo[]
  setCheckedArray?: (value: string[]) => void
  isCheckInit?: boolean
  isMultiSelect?: boolean
  columns: ColumnInfo[]
  data: DataTableObject[]
  tableTitle?: string
}

function TableComponent({
  topLeftRender,
  toprightRender,
  isAccordion,
  isMultiSelect = true,
  accordionColumns,
  setCheckedArray,
  isCheckInit,
  columns,
  data,
  tableTitle,
}: Props) {
  const [checkedTargets, setCheckedTargets] = useState<string[]>([])

  const [keyword, setKeyword] = useState('')

  const [sortTarget, setSortTarget] = useState<SortInfo | null>(null)

  useEffect(() => {
    setCheckedTargets([])
  }, [isCheckInit])

  useEffect(() => {
    !!setCheckedArray && setCheckedArray(checkedTargets)
  }, [checkedTargets])

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
        if (dataA > dataB) {
          return -1
        } else if (dataA < dataB) {
          return 1
        }
      } else {
        if (dataA > dataB) {
          return 1
        } else if (dataA < dataB) {
          return -1
        }
      }

      return 0
    })
    return newData
  }, [sortTarget, filterData])

  const onSort = useCallback(
    (column: ColumnInfo) => {
      const target = JSON.parse(JSON.stringify(sortTarget))

      if (sortTarget === null) {
        setSortTarget({
          key: column.key,
          isDesc: false,
        })
        return
      } else if (target.key !== column.key) {
        target.isDesc = false
        target.key = column.key
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
          <SearchBar placeholder="Filter by Host..." onSearch={searchHandler} />
          {/* right custom node */}
          {toprightRender}
        </div>
      </div>
      <div className="panel-body">
        <TableBase
          columns={columns}
          data={sortedData}
          accordionColumns={isAccordion ? accordionColumns : null}
          isMultiSelect={isMultiSelect}
          onCheck={setCheckedTargets}
          onSort={onSort}
          checkedTargets={checkedTargets}
          sortTarget={sortTarget}
        />
      </div>
    </div>
  )
}

export default TableComponent
