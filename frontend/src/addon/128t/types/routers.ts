export interface Router {
  assetId: string
  locationCoordinates?: string
  managementConnected?: boolean
  bandwidth_avg?: number
  session_arrivals?: number
  enabled?: boolean
  role?: string
  startTime?: string
  softwareVersion?: string
  memoryUsage?: number
  cpuUsage?: number
  diskUsage?: number
  topSources?: TopSource[]
  topSessions?: TopSession[]
}

export interface TopSource {
  ip: string
  tenant: string
  currentBandwidth: number
  totalData: number
  sessionCount: number
}

export interface TopSession {
  service: string
  tenant: string
  value: number
  protocol: string
  source: {
    address: string
    port: number
  }
  destination: {
    address: string
    port: number
  }
}
