export interface Router {
  name: string
  nodeName?: string
  ipAddress?: string
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
  peers?: PeerDetail[]
  group?: string
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
  nodeName: string
  isCheck: boolean
}

export interface SaltDirFile {
  files: SaltDirFileInfo[]
  isLoading?: boolean
  status?: string | GetSaltDirectoryInfo
}

export interface GetSaltDirectoryInfo {
  data: {return: string[]}
  status: number
  statusText: string
}

export interface PeerDetail {
  name: string
}

export interface GroupRouterData {
  groupName: string
  routers: Router[]
}
