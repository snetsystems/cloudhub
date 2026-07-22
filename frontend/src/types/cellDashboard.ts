import {TimeSeriesValue} from 'src/types/series'

export interface CellSummaryItem {
  label: string
  value: number
  time: TimeSeriesValue
  /** Chart series label for color matching (format: measurement.field[tag=val]...) */
  chartLabel?: string
}

export interface CellSummaryContext {
  timeRange: string | null
  interval: string | null
  aggregation: string | null
  summaryType: string | null
  showTime?: boolean
}

export interface CellSummary {
  context: CellSummaryContext
  items: CellSummaryItem[]
}
