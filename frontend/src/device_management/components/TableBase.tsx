// Libraries
import React, {useEffect, useMemo, useState} from 'react'

// Components
import AccordionTable from 'src/device_management/components/AccordionTable'
import TableGaugeCell from 'src/dashboards/components/TableGaugeCell'

// Types
import {
  AlignType,
  ColumnInfo,
  DataTableObject,
  DataTableOptions,
  SortInfo,
  TimeZones,
} from 'src/types'
import {formatValueWithUnit} from 'src/dashboards/utils/gaugeCell'
interface Props {
  columns: ColumnInfo[]
  data: DataTableObject[]
  onSort?: (column: ColumnInfo) => void
  options?: DataTableOptions
  sortTarget?: SortInfo | null
  accordionColumns?: ColumnInfo[]
  onCheck?: (checked: string[]) => void
  checkedTargets?: string[]
  isMultiSelect?: boolean
  timeZone: TimeZones
  isDotKey?: boolean
}

function TableBase({
  columns,
  data,
  options,
  accordionColumns,
  onCheck,
  checkedTargets,
  isMultiSelect,
  sortTarget,
  onSort,
  timeZone,
  isDotKey = false,
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
    if (!isDotKey && Object.prototype.hasOwnProperty.call(item, key)) {
      return item[key] as string | number | boolean | DataTableObject[]
    }

    if (key.includes('.')) {
      const splitKey = key.split('.')
      let target: any = item[splitKey.shift() as string]
      while (
        splitKey.length > 0 &&
        target !== null &&
        target !== undefined &&
        typeof target !== 'string' &&
        typeof target !== 'number' &&
        typeof target !== 'boolean'
      ) {
        const nextKey = splitKey.shift() as string
        target = target?.[nextKey]
      }

      return target as string | number | boolean | DataTableObject[]
    }

    return item[key] as string | number | boolean | DataTableObject[]
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
                    style={column.options?.thead?.style}
                    className={`${getAlignClassName(
                      column?.options?.thead?.align
                    )} ${options?.theadRow?.className ?? ''} ${
                      column.options?.thead?.className ?? ''
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
                      <div
                        className={`${
                          !!sortTarget && sortTarget.key === column.key
                            ? 'sorted'
                            : ''
                        }`}
                      >
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
          {data?.length > 0 ? (
            data?.map((item, rowIndex) => {
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
                    className={`${
                      isAccordionRow ? 'hover-pointer-cursor' : ''
                    } ${options?.tbodyRow?.className ?? ''}`}
                  >
                    {keys.map((key, columnIndex) => {
                      const column = columns[columnIndex]
                      return (
                        <td
                          key={columnIndex}
                          onClick={() => columns[columnIndex].onClick}
                          className={`${getAlignClassName(
                            column?.options?.thead?.align
                          )}`}
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
                          ) : column?.options?.isGauge ? (
                            <TableGaugeCell
                              options={column.options?.gaugeOptions}
                              value={getValue(item, key) as number}
                            />
                          ) : column?.render ? (
                            column.render(
                              getValue(item, key),
                              item,
                              columnIndex,
                              rowIndex,
                              timeZone
                            )
                          ) : !!column?.options?.gaugeOptions?.valueFormat ? (
                            <>
                              {(column?.options?.gaugeOptions?.prefix ?? '') +
                                formatValueWithUnit(
                                  getValue(item, key) as number,
                                  column?.options?.gaugeOptions?.decimalPlaces,
                                  column?.options?.gaugeOptions?.valueFormat
                                ) +
                                (column?.options?.gaugeOptions?.suffix ?? '')}
                            </>
                          ) : (
                            <>
                              {(column?.options?.gaugeOptions?.prefix ?? '') +
                                getValue(item, key) +
                                (column?.options?.gaugeOptions?.suffix ?? '')}
                            </>
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
                            timeZone={timeZone}
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
            })
          ) : (
            <tr className="no-data">
              <td colSpan={keys.length} className="text-center">
                {options?.noDataMessage || <span>No data</span>}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default TableBase
