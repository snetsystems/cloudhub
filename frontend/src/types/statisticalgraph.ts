// Types
import {ColorNumber, ColorString} from 'src/types/colors'
import {TimeSeriesSeries} from 'src/types/series'
import {DecimalPlaces} from 'src/types/dashboards'

export type StatisticalGraphScaleType = 'logarithmic' | undefined
export type StatisticalGraphBoundsType = [string, string] | undefined
export type StatisticalGraphMinMaxValueType = number | undefined
export type Direction = '' | 'asc' | 'desc'
export type RenamableField = {
  internalName: string
  displayName: string
  visible: boolean
  direction?: Direction
}
export type StatisticalGraphTableOptions = {
  verticalTimeAxis: boolean
  sortBy: StatisticalGraphFieldOption
  wrapping?: string
  fixFirstColumn: boolean
}
export type StatisticalGraphDatasetConfigType = {
  rawData: TimeSeriesSeries[]
  tableOptions?: StatisticalGraphTableOptions
  fieldOptions?: StatisticalGraphFieldOption[]
  colors: ColorString[]
  showCount?: number | null
  fillArea?: boolean
  decimalPlaces?: DecimalPlaces
}

export type StatisticalGraphSortOption = {
  fields: string[]
  sortKey: string
  order: Direction
}
export type StatisticalGraphSortedLabel = {
  label: string
  responseIndex: number
  seriesIndex: number
}
export type StatisticalGraphFieldOption = {
  internalName: string
  displayName: string
  visible: boolean
  direction?: '' | 'asc' | 'desc'
  groupByTagOrder?: number
}
export interface TableOptionsInterface {
  verticalTimeAxis: boolean
  sortBy: RenamableField
  fixFirstColumn: boolean
}
export interface DropdownOption {
  text: string
  key: string
}

export interface TableGaugeChartOptionsInterface {
  columnSettings: ColumnSettingInterface[]
  decimalPlaces: DecimalPlaces
  isShowValues: boolean
  sortBy: string
  sortByDirection: 'asc' | 'desc'
}

export interface ColumnSettingInterface extends RenamableField {
  min?: number
  max?: number
  colors: ColorString[]
  thresholdColors: ColorNumber[]
  unit?: string
  prefix?: string
  suffix?: string
  isShowChart: boolean
  isPercent: boolean
  chartType: ChartTypeMode
  backgroundType: BackgroundTypeMode
  isShowValues: boolean
  valueFormat: FormatOption
}

export type ChartTypeMode = typeof CHART_TYPE_MODES[keyof typeof CHART_TYPE_MODES]

export const CHART_TYPE_MODES = {
  CONTINUOUS: 'continuous',
  SEGMENTED: 'segmented',
} as const

export const BACKGROUND_TYPE_MODES = {
  GRADIENT: 'gradient',
  SOLID: 'solid',
} as const

export type BackgroundTypeMode = typeof BACKGROUND_TYPE_MODES[keyof typeof BACKGROUND_TYPE_MODES]

export const FORMAT_OPTIONS = {
  RAW: 'Raw',
  KMB: 'KMB',
  KMG: 'KMG',
} as const

export type FormatOption = typeof FORMAT_OPTIONS[keyof typeof FORMAT_OPTIONS]
