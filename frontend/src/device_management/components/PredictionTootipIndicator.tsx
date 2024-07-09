import React from 'react'
import classnames from 'classnames'
export const PredictionTooltipIndicator = ({
  value,
  status,
}: {
  value: string | number | React.ReactText
  status: string | null
}): JSX.Element => {
  if (!value) return
  const indicatorStatus = status === 'predictionTooltip' ? '' : status
  return (
    <div className="predictionTooltip-container">
      <div
        className={classnames(
          'predictionTooltip-value',
          `predictionTooltip--${indicatorStatus}`
        )}
      >
        {value}
      </div>
      <div
        className={classnames(
          'IPMI-predictionTooltip',
          `predictionTooltip-ipmi--${indicatorStatus}`
        )}
      ></div>
    </div>
  )
}
