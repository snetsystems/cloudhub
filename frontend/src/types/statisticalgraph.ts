// Types
import {ColorString} from 'src/types/colors'
import {TimeSeriesSeries} from 'src/types/series'

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
