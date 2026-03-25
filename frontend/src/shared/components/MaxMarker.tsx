import React, {FunctionComponent} from 'react'
import {DygraphClass, DygraphData} from 'src/types'
import {DecimalPlaces, Axis} from 'src/types/dashboards'
import {numberValueFormatter} from 'src/utils/formatting'

interface Props {
  dygraph: DygraphClass
  timeSeries: DygraphData
  staticLegendHeight: number
  prefix?: string
  suffix?: string
  decimalPlaces?: DecimalPlaces
  yAxis?: Axis
  hide?: boolean
  offsetX?: number
  offsetY?: number
}

const MaxMarker: FunctionComponent<Props> = ({
  dygraph,
  timeSeries,
  prefix = '',
  suffix = '',
  decimalPlaces,
  yAxis,
  hide,
  offsetX = 16,
  offsetY = 8,
}) => {
  if (hide || !dygraph || !timeSeries || timeSeries.length === 0) {
    return null
  }

  let maxVal = -Infinity
  let maxTime = 0
  let maxSeriesIdx = -1

  // 1. Find the absolute maximum value, its timestamp, and series index
  const visibilities = dygraph.visibility() || []
  for (const row of timeSeries) {
    if (!row || row.length < 2) {
      continue
    }
    const time = row[0]
    for (let i = 1; i < row.length; i++) {
      if (visibilities.length > i - 1 && visibilities[i - 1] === false) {
        continue
      }
      const val = row[i]
      if (typeof val === 'number' && val > maxVal) {
        maxVal = val
        maxTime = time
        maxSeriesIdx = i
      }
    }
  }

  if (maxVal === -Infinity || isNaN(maxTime) || maxSeriesIdx === -1) {
    return null
  }

  // 2. Filter by current visible range
  const [minX, maxX] = dygraph.xAxisRange()
  if (maxTime < minX || maxTime > maxX) {
    return null
  }

  // 3. Convert data coordinates to DOM coordinates
  let x = dygraph.toDomXCoord(maxTime)
  let y = dygraph.toDomYCoord(maxVal)

  if (isNaN(x) || isNaN(y)) {
    return null
  }

  x += offsetX
  y += offsetY

  // 4. Get the color of the specific series from Dygraph
  let seriesColor = '#FDC44F'
  const labels = dygraph.getLabels()
  if (labels && maxSeriesIdx > 0 && maxSeriesIdx < labels.length) {
    const seriesName = labels[maxSeriesIdx]
    const props = dygraph.getPropertiesForSeries(seriesName)
    if (props && props.color) {
      seriesColor = props.color
    } else {
      const colors = dygraph.getColors() || []
      seriesColor = colors[maxSeriesIdx - 1] || '#FDC44F'
    }
  } else {
    const colors = dygraph.getColors() || []
    seriesColor = colors[maxSeriesIdx - 1] || '#FDC44F'
  }

  // 5. Format the value using the system's standard for charts
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

export default MaxMarker
