import React from 'react'
import classnames from 'classnames'
import {
  colorScaleForGPUMonitoring,
  colorScaleForGPUTempMetricsMonitoring,
} from 'src/gpu_monitoring/utils'

export const GPUMonitoringTooltipIndicator = ({
  tooltipText,
  value,
  originalValue,
  isTemperatureMetrics,
}: {
  tooltipText: React.ReactText
  value: number
  originalValue?: React.ReactText | JSX.Element
  isTemperatureMetrics?: boolean
}): JSX.Element => {
  if (!tooltipText) return null
  const indicatorStatus = tooltipText === 'N/A' ? '' : tooltipText
  const color = isTemperatureMetrics
    ? colorScaleForGPUTempMetricsMonitoring(value)
    : colorScaleForGPUMonitoring(value)

  return (
    <div className="gpu-monitoringTooltip-container">
      <div
        className={classnames(
          'gpu-monitoringTooltip-value',
          `gpu-monitoringTooltip--${indicatorStatus}`
        )}
        style={{
          color: color,
        }}
      >
        {originalValue !== undefined ? originalValue : tooltipText}
      </div>
      <div
        className={classnames(
          'gpu-monitoringTooltip-graph',
          `gpu-monitoringTooltip--${indicatorStatus}`
        )}
        style={{
          background: color,
        }}
      ></div>
    </div>
  )
}
