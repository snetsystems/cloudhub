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
  isCheck?: boolean
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

export interface SaltDirFileInfo {
  updateTime?: string
  updateGetTime?: number
  application?: string
  applicationFullName?: string
  pathDirectory?: string
  fullPathDirectory?: string
}

export interface CheckRouter {
  assetId: string
  isCheck: boolean
}

export interface SaltDirFile {
  files: SaltDirFileInfo[]
  isLoading?: boolean
  isFailed?: boolean
}
