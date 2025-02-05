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

export interface HostState {
  host: string
  isOk: boolean
  level: string
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
  displayState: number
}

export interface AnomalyFactor {
  host: string
  time: string
}

export interface AlertHostList {
  warning: string[]
  critical: string[]
}

export interface GetLearningMLData {
  device_ip: string
  learning_finish_datetime: string
  epsilon: number
  mean_matrix: number[]
  covariance_matrix: number[][]
  k: number
  mean: number
  md_threshold: number
  md_array: number[]
  cpu_array: number[]
  traffic_array: number[]
  gaussian_array: number[]
}

export interface GetLearningDLData {
  device_ip: string
  learning_finish_datetime: string
  dl_threshold: number
  train_loss: number[]
  valid_loss: number[]
  mse: number[]
}

export interface MLChartSectorProps {
  isNoData: boolean
  loading: boolean
  mlResultData: GetLearningMLData
  mlChartDataSet: any
  gaussianChartDataSet: any
  options: any
}
export interface DLChartSectorProps {
  isNoData: boolean
  loading: boolean
  dlResultData: GetLearningDLData
  trainChartDataSet: any
  mseChartDataSet: any
  options: any
}

export interface ContentItem {
  title: string
  content: string | number | object
}

export interface ModalContentHeaderProps {
  title: string
  headerContents: ContentItem[]
}
