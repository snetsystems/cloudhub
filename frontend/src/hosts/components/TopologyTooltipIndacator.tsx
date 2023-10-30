import React from 'react'
import classnames from 'classnames'
export const TopologyTooltipIndacator = ({
  value,
  status,
}: {
  value: string | number | React.ReactText
  status: string | null
}): JSX.Element => {
  if (!value) return
  const indicatorStatus = status === 'UsageIndacator' ? '' : status
  return (
    <div className="UsageIndacator-container">
      <div className={classnames('UsageIndacator-value', indicatorStatus)}>
        {value}
      </div>
      <div
        className={classnames('IPMI-UsageIndacator ', indicatorStatus)}
      ></div>
    </div>
  )
}
