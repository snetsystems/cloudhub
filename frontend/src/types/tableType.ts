import {ReactNode} from 'react'
import {TimeZones} from 'src/types'
import {ColorNumber, ColorString} from 'src/types/colors'
import {
  BackgroundTypeMode,
  ChartTypeMode,
  FormatOption,
} from 'src/types/statisticalgraph'

export enum SortType {
  NONE = 'NONE',
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum AlignType {
  CENTER = 'CENTER',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

export interface ColumnBaseInfo {
  className?: string
  onClick?: (item: any) => void
  sort?: SortType
  align?: AlignType
  style?: React.CSSProperties
}

export interface ColumnInfoOptions {
  thead?: ColumnBaseInfo
  isAccordion?: boolean
  sorting?: boolean
  checkbox?: boolean
  isIP?: boolean
  isGauge?: boolean
  gaugeOptions?: GaugeOptions
}

export interface ColumnInfo extends ColumnBaseInfo {
  name: string
  key: string
  parentHeader?: string
  options?: ColumnInfoOptions
  render?: (
    value: any,
    rowData: any,
    ColumnIndex: number,
    rowIndex: number,
    timeZone: TimeZones
  ) => ReactNode
}

export interface DataTableObject {
  [key: string]: number | string | boolean | DataTableObject | any
}

export interface DataTableOptions {
  theadRow?: RowInfo
  tbodyRow?: RowInfo
  noDataMessage?: ReactNode
}

export interface RowInfo {
  className?: string
  onClick?: (rowData: any, index: number) => void
}

export interface SortInfo {
  key: string
  isDesc: boolean
  isIP?: boolean
}

export interface GaugeOptions {
  isPercent?: boolean // percent / raw value
  chartType?: ChartTypeMode
  backgroundType?: BackgroundTypeMode
  decimalPlaces?: number
  min?: number
  max?: number
  colors?: ColorString[]
  thresholdColors?: ColorNumber[]
  prefix?: string
  suffix?: string
  valueFormat?: FormatOption
  isShowValues?: boolean
  isGauge?: boolean
}

export interface Column {
  name: string
  min: number
  max: number
  color?: string
}
