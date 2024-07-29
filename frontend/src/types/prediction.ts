import {PredictionTooltipNode} from './deviceManagement'

export interface AppsForHost {
  apps: string[]
  tags: {host: string}
}

export interface SeriesObj {
  measurement: string
  tags: {host: string}
}

export interface PredictionManualRefresh {
  key: string
  value: number
}

export interface hostState {
  host: string
  isOk: boolean
}

export interface HexagonData {
  x: number
  y: number
  statusColor: string
  hostname: string
  index: number
}

export interface HexagonInputData extends PredictionTooltipNode {
  statusColor: string
}

export interface AnomalyFactor {
  host: string
  time: string
}
