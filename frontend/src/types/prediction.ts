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
