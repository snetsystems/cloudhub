import React from 'react'
import moment from 'moment'
import {formatDisplayValue} from 'src/dashboards/utils/gaugeCell'
import {DecimalPlaces} from 'src/types/dashboards'
import {CellSummary} from 'src/types'

interface Props {
  summary: CellSummary | null
  decimalPlaces: DecimalPlaces
  prefix?: string
  suffix?: string
  itemColor?: string
}

const formatSummaryTime = (value: string | number | null) => {
  if (value === null) {
    return '--'
  }

  if (typeof value === 'number') {
    const parsed = moment.utc(value)
    return parsed.isValid() ? parsed.format('HH:mm:ss') : String(value)
  }

  const parsed = moment.utc(value)
  return parsed.isValid() ? parsed.format('HH:mm:ss') : value
}

function CellSummaryOverlay({
  summary,
  decimalPlaces,
  prefix = '',
  suffix = '',
  itemColor,
}: Props) {
  if (!summary || summary.items.length === 0) {
    return null
  }

  const item = summary.items[0]
  const formattedValue = formatDisplayValue(
    item.value,
    false,
    decimalPlaces?.digits ?? 2
  ).trim()
  const formattedTime = formatSummaryTime(item.time)
  const summaryTypeLabel = summary.context.summaryType || 'Chart Max'

  const line1Parts: (string | null)[] = []
  if (summary.context.timeRange) {
    line1Parts.push(summary.context.timeRange)
  }
  if (summary.context.interval) {
    line1Parts.push(`Interval: ${summary.context.interval}`)
  }
  if (summary.context.aggregation) {
    line1Parts.push(`Method: ${summary.context.aggregation}`)
  }

  return (
    <div className="cell-summary-overlay">
      <div className="cell-summary-overlay__line1">
        {line1Parts.join(' · ')}
      </div>
      <div className="cell-summary-overlay__line2">
        <span className="cell-summary-overlay__item-indicator">
          {itemColor ? (
            <span
              className="cell-summary-overlay__color-dot"
              style={{backgroundColor: itemColor}}
            />
          ) : (
            <span className="cell-summary-overlay__color-dot cell-summary-overlay__color-dot--fallback" />
          )}
        </span>
        <span className="cell-summary-overlay__item-content">
          {summaryTypeLabel} · Value: {prefix}
          {formattedValue}
          {suffix} · Time: {formattedTime} · Label: {item.label}
        </span>
      </div>
    </div>
  )
}

export default CellSummaryOverlay
