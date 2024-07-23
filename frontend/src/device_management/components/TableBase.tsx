import React, {ReactNode, useEffect, useMemo, useState} from 'react'
import {
  AlignType,
  ColumnInfo,
  DataTableObject,
  DataTableOptions,
  SortInfo,
  TimeZones,
} from 'src/types'

import AccordionTable from 'src/device_management/components/AccordionTable'

interface Props {
  columns: ColumnInfo[]
  data: DataTableObject[]
  customNoDataNode?: ReactNode
  onSort?: (column: ColumnInfo) => void
  options?: DataTableOptions
  sortTarget?: SortInfo | null
  accordionColumns?: ColumnInfo[]
  onCheck?: (checked: string[]) => void
  checkedTargets?: string[]
  isMultiSelect?: boolean
  timeZone: TimeZones
}

function TableBase({
  columns,
  data,
  customNoDataNode,
  options,
  accordionColumns,
  onCheck,
  checkedTargets,
  isMultiSelect,
  sortTarget,
  onSort,
  timeZone,
}: Props) {
  const [openRowAccor, setOpenRowAccor] = useState<number | null>(null)

  useEffect(() => {
    setOpenRowAccor(null)
  }, [data])

  const keys = columns
    ?.filter(column => !column?.options?.isAccordion)
    ?.map(item => item.key)

  const accordionKey = useMemo(() => {
    return columns?.find(column => !!column?.options?.isAccordion)?.key || ''
  }, [columns])

  const getValue = (item: DataTableObject, key: string) => {
    let target
    if (
      key.includes('.') &&
      typeof target !== 'string' &&
      typeof target !== 'number' &&
      typeof target !== 'boolean'
    ) {
      const splitKey = key.split('.')
      target = item[splitKey[0]]
      while (
        splitKey.length > 1 &&
        typeof target !== 'string' &&
        typeof target !== 'number' &&
        typeof target !== 'boolean'
      ) {
        target = target[splitKey[1]]
        splitKey.splice(0, 1)
      }

      return target as string | number | boolean | DataTableObject[]
    } else {
      target = item[key]
      return target as string | number | boolean | DataTableObject[]
    }
  }

  const openAccordion = rowIndex => {
    if (openRowAccor === rowIndex) {
      setOpenRowAccor(null)
    } else {
      setOpenRowAccor(rowIndex)
    }
  }

  const onClickTh = (column: ColumnInfo) => {
    if (column.options?.sorting) {
      onSort?.(column)
    }
    if (column.options?.thead?.onClick) {
      column.options?.thead?.onClick?.(column)
    }
    setOpenRowAccor(null)
  }

  const onChangeCheckAll = (key: string) => {
    if (checkedTargets?.length === data?.length) {
      onCheck?.([])
    } else {
      const newChecked = data?.map(item => `${getValue(item, key)}`)
      onCheck?.(newChecked)
    }
  }

  const onChangeCheck = (value: string) => {
    // Checked Targets (string[])
    if (!!checkedTargets) {
      if (checkedTargets?.includes(value)) {
        if (isMultiSelect) {
          const newChecked = checkedTargets?.filter(item => item !== value)
          onCheck?.(newChecked)
        } else {
          onCheck?.([])
        }
      } else {
        if (isMultiSelect) {
          const newChecked = [...checkedTargets, value]
          onCheck?.(newChecked)
        } else {
          onCheck?.([value])
        }
      }
    }
  }

  //left align default
  const getAlignClassName = (align?: AlignType) => {
    switch (align) {
      case AlignType.CENTER:
        return 'text-center justify-center'
      case AlignType.LEFT:
        return 'text-left justify-start'
      case AlignType.RIGHT:
        return 'text-right justify-end'
      default:
        return 'text-left justify-start'
    }
  }

  return (
    <div>
      <table className="table v-center margin-bottom-zero table-highlight table-accordion">
        <thead>
          <tr className="highlight">
            {columns
              ?.filter(column => {
                // render no accordion
                return !column.options?.isAccordion
              })
              ?.map((column, index) => {
                return (
                  <th
                    className={`${getAlignClassName(column?.align)} ${
                      options?.theadRow?.className ?? ''
                    } ${column.options?.checkbox ? 'checkbox' : ''}`}
                    key={index}
                    onClick={() => onClickTh(column)}
                  >
                    {column.options?.checkbox ? (
                      <>
                        {isMultiSelect ? (
                          <div className="dark-checkbox">
                            <input
                              type={'checkbox'}
                              id="agent-control--all-check"
                              checked={checkedTargets?.length === data?.length}
                              onClick={event => event.stopPropagation()}
                              onChange={() => {
                                onChangeCheckAll(column.key)
                              }}
                            />
                            <label htmlFor={`agent-control--all-check`} />
                          </div>
                        ) : null}
                      </>
                    ) : column.options?.sorting ? (
                      <div>
                        <span>{column.name}</span>

                        {!!sortTarget &&
                          sortTarget.key === column.key &&
                          (sortTarget?.isDesc ? (
                            <span className="icon caret-down" />
                          ) : (
                            <span className="icon caret-up" />
                          ))}
                      </div>
                    ) : (
                      <>
                        <span>{column.name}</span>
                      </>
                    )}
                  </th>
                )
              })}
          </tr>
        </thead>
        <tbody>
          {data?.map((item, rowIndex) => {
            const isAccordionRow =
              !!accordionColumns && accordionColumns.length > 0
            return (
              <React.Fragment key={rowIndex}>
                <tr
                  onClick={e => {
                    if (isAccordionRow) {
                      e.stopPropagation()
                      openAccordion(rowIndex)
                    } else if (!!options?.tbodyRow?.onClick) {
                      options?.tbodyRow?.onClick?.(item, rowIndex)
                    } else {
                      null
                    }
                  }}
                  className={`${isAccordionRow ? 'hover-pointer-cursor' : ''}`}
                >
                  {keys.map((key, columnIndex) => {
                    const column = columns[columnIndex]
                    return (
                      <td
                        key={columnIndex}
                        onClick={() => columns[columnIndex].onClick}
                        className={`${
                          column.options?.thead?.className ?? ''
                        } ${getAlignClassName(column?.align)}`}
                      >
                        {column?.options?.checkbox ? (
                          <div className="dark-checkbox">
                            <input
                              type={'checkbox'}
                              id={`agent-control--${rowIndex}`}
                              className="checkbox-primary checkbox checkbox-sm"
                              checked={checkedTargets?.includes(
                                `${getValue(item, key)}`
                              )}
                              onClick={event => event.stopPropagation()}
                              onChange={() =>
                                onChangeCheck(`${getValue(item, key)}`)
                              }
                            />
                            <label
                              onClick={e => e.stopPropagation()}
                              htmlFor={`agent-control--${rowIndex}`}
                            />
                          </div>
                        ) : column?.render ? (
                          column.render(
                            getValue(item, key),
                            item,
                            columnIndex,
                            rowIndex,
                            timeZone
                          )
                        ) : (
                          getValue(item, key)
                        )}
                      </td>
                    )
                  })}
                </tr>
                {isAccordionRow && rowIndex === openRowAccor && (
                  <tr
                    key={`${rowIndex}-accordion`}
                    className="table-accordion-tr"
                  >
                    <td className="table-accordion-td" colSpan={keys.length}>
                      <div
                        className={`table-accordion-div panel-body ${
                          rowIndex === openRowAccor ? 'open' : 'close'
                        }`}
                      >
                        <AccordionTable
                          tableData={
                            getValue(item, accordionKey) as DataTableObject[]
                          }
                          accordionColumns={accordionColumns}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default TableBase
