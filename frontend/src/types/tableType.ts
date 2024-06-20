import {ReactNode} from 'react'

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
}

export interface ColumnInfoOptions {
  thead?: ColumnBaseInfo
  isAccordion?: boolean
  sorting?: boolean
  checkbox?: boolean
}

export interface ColumnInfo extends ColumnBaseInfo {
  name: string
  key: string
  options?: ColumnInfoOptions
  render?: (
    value: any,
    rowData: any,
    ColumnIndex: number,
    rowIndex: number
  ) => ReactNode
}

export interface DataTableObject {
  [key: string]: number | string | boolean | DataTableObject | any
}

export interface DataTableOptions {
  theadRow?: RowInfo
  tbodyRow?: RowInfo
}

export interface RowInfo {
  className?: string
  onClick?: (rowData: any, index: number) => void
}

export interface SortInfo {
  key: string
  isDesc: boolean
}
