export interface Router {
  assetID: string
  routerStatus: string
  networkStatus: string
  ApplicationStatus: string
  cpu: number
  memory: number
  sdplexTrafficUsage: number
  config: string
  firmware: string
}

export interface TopSources {
  ip: string
  tenant: string
  currentBandwidth: number
  totalData: number
  sessionCount: number
}
