import React, {FunctionComponent} from 'react'
import {Chart as ChartJS} from 'chart.js'
import {Axis, DecimalPlaces} from 'src/types/dashboards'
import {numberValueFormatter} from 'src/utils/formatting'
import '../MaxMarker.scss'

interface Props {
  chartInstance: ChartJS
  prefix?: string
  suffix?: string
  decimalPlaces?: DecimalPlaces
  yAxis?: Axis
  hide?: boolean
}

const StaticMaxMarker: FunctionComponent<Props> = ({
  chartInstance,
  prefix = '',
  suffix = '',
  decimalPlaces,
  yAxis,
  hide,
}) => {
  if (hide || !chartInstance) {
    return null
  }

  // 1. Find the absolute maximum value across all datasets
  const {data} = chartInstance
  let maxVal = -Infinity
  let maxDatasetIdx = -1
  let maxDataIdx = -1

  data.datasets.forEach((dataset, datasetIdx) => {
    dataset.data.forEach((val, dataIdx) => {
      if (typeof val === 'number' && val > maxVal) {
        maxVal = val
        maxDatasetIdx = datasetIdx
        maxDataIdx = dataIdx
      }
    })
  })

  if (maxVal === -Infinity || maxDatasetIdx === -1 || maxDataIdx === -1) {
    return null
  }

  // 2. Get the pixel coordinates for the max point
  const meta = chartInstance.getDatasetMeta(maxDatasetIdx)
  const element = meta.data[maxDataIdx]
  if (!element) {
    return null
  }

  // getProps provides the current rendered position
  const {x, y} = element.getProps(['x', 'y'], true)

  // 3. Get the color (borderColor or backgroundColor)
  const seriesColor = (data.datasets[maxDatasetIdx].borderColor as string) || '#FDC44F'

  // 4. Format the value consistently with other charts
  const digits =
    decimalPlaces && decimalPlaces.isEnforced ? decimalPlaces.digits : null

  const mockOpts = (name: string): any => {
    switch (name) {
      case 'labelsKMB':
        return yAxis?.base === '10'
      case 'labelsKMG2':
        return yAxis?.base === '2'
      case 'digitsAfterDecimal':
        return digits
      case 'sigFigs':
        return null
      case 'maxNumberWidth':
        return 6
      default:
        return null
    }
  }

  const fullDisplayValue = numberValueFormatter(
    maxVal,
    mockOpts,
    prefix,
    suffix,
    {
      avoidScientificNotation: yAxis?.avoidScientificNotation || false,
    }
  )

  return (
    <div
      className="max-marker-container"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <div
        className="max-marker-value"
        style={{
          border: `1px solid ${seriesColor}`,
        }}
      >
        {fullDisplayValue}
      </div>
      <span
        className="icon caret-down max-marker-icon"
        style={{
          color: seriesColor,
        }}
      />
    </div>
  )
}

export default StaticMaxMarker
