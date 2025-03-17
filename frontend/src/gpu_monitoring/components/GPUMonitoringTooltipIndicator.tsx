import React from 'react'
import classnames from 'classnames'
import {colorScaleForGPUMonitoring} from 'src/gpu_monitoring/utils'

export const GPUMonitoringTooltipIndicator = ({
  tooltipText,
  value,
}: {
  tooltipText: string | React.ReactText
  value: number
}): JSX.Element => {
  if (!tooltipText) return
  const indicatorStatus = tooltipText === 'N/A' ? '' : tooltipText

  return (
    <div className="gpu-monitoringTooltip-container">
      <div
        className={classnames(
          'gpu-monitoringTooltip-value',
          `gpu-monitoringTooltip--${indicatorStatus}`
        )}
        style={{
          color: colorScaleForGPUMonitoring(value),
        }}
      >
        {tooltipText}
      </div>
      <div
        className={classnames(
          'gpu-monitoringTooltip-graph',
          `gpu-monitoringTooltip--${indicatorStatus}`
        )}
        style={{
          background: colorScaleForGPUMonitoring(value),
        }}
      ></div>
    </div>
  )
}
