import React from 'react'

// Library
import classnames from 'classnames'
import {hslColorValue} from '../utils'

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
        style={{
          color: hslColorValue(status),
        }}
      >
        {value}
      </div>
      <div
        className={classnames(
          'IPMI-predictionTooltip',
          `predictionTooltip-ipmi--${indicatorStatus}`
        )}
        style={{
          background: hslColorValue(status),
        }}
      ></div>
    </div>
  )
}
