import React from 'react'

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
