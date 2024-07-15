export interface AppsForHost {
  apps: string[]
  tags: {host: string}
}

export interface SeriesObj {
  measurement: string
  tags: {host: string}
}
