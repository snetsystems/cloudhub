export interface OncueService {
  name: string
  memoryUsage?: number
  cpuUsage?: number
  diskUsage?: number
  version?: string
  status?: string
  listeningPort?: string
  runningThread?: number
  processDataCount?: number
  processSpeed?: number
  protocolModule?: ProtocolModule[]
}

export interface ProtocolModule {
  name: string
  version?: string
  status?: string
  deviceConnection?: DeviceConnection[]
}

export interface DeviceConnection {
  url: string
  connection?: Connection[]
}

export interface Connection {
  pathId: string
  connected?: number
  disconnected?: number
  inUse?: number
  processDataCount?: number
  processSpeed?: number
}

export interface OncueData {
  router: string
  focusedInProtocolModule?: string
  focusedInDeviceConnection?: string
  oncueService?: OncueService
  protocolModule?: ProtocolModule[]
  deviceConnection?: DeviceConnection[]
  connection?: Connection[]
}
