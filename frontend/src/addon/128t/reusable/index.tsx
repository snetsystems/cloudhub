import React from 'react'
import classnames from 'classnames'

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export const usageIndacator = ({
  value,
}: {
  value: string | number | React.ReactText
}): JSX.Element => {
  if (!value) return
  const numValue = parseInt(value.toString())

  return (
    <div className="UsageIndacator-container">
      <div
        className={classnames('UsageIndacator-value', {
          'UsageIndacator--caution': numValue >= 70,
          'UsageIndacator--warning': numValue >= 80,
          'UsageIndacator--danger': numValue >= 90,
        })}
      >
        {value}
      </div>
      <div
        className={classnames('UsageIndacator', {
          'UsageIndacator--caution': numValue >= 70,
          'UsageIndacator--warning': numValue >= 80,
          'UsageIndacator--danger': numValue >= 90,
        })}
      ></div>
    </div>
  )
}

export const sortableClasses = ({
  sortKey,
  sortDirection,
  key,
}: {
  sortKey: string
  sortDirection: SortDirection
  key: string
}): string => {
  if (sortKey === key) {
    if (sortDirection === SortDirection.ASC) {
      return 'hosts-table--th sortable-header sorting-ascending'
    }
    return 'hosts-table--th sortable-header sorting-descending'
  }
  return 'hosts-table--th sortable-header'
}

export const unitIndicator = (
  value: string | number,
  splitUnit: string
): JSX.Element => {
  const divider = String(value).split(splitUnit)
  return (
    <>
      {divider[0]}
      <span className="indicator-unit--wrap">
        <span className="indicator-unit">{divider[1]}</span>
      </span>
    </>
  )
}

export const ErrorState = (): JSX.Element => (
  <div className="generic-empty-state">
    <h4 style={{margin: '90px 0'}}>There was a problem loading hosts</h4>
  </div>
)

export const NoHostsState = (): JSX.Element => (
  <div className="generic-empty-state">
    <h4 style={{margin: '90px 0'}}>No information or no information found. </h4>
  </div>
)

export const NoSortedHostsState = (): JSX.Element => (
  <div className="generic-empty-state">
    <h4 style={{margin: '90px 0'}}>
      There are no hosts that match the search criteria
    </h4>
  </div>
)
