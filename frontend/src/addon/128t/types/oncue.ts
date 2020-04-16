export interface OncueService {
  name: string
  cpu: number
  memory: number
  queue: number
  version: string
  status: string
  listeningPort: number
  runningThread: number
  processingDataCount: number
  processingSpeed: number
}

export interface ProtocolModule {
  name: string
  version: string
  status: string
}

export interface DeviceConnection {
  url: string
}

export interface Connection {
  pathID: string
  connected: number
  disconnected: number
  inUser: number
  dataCount: number
  speed: number
}

export interface OncueData {
  router: string
  focusedInProtocolModule?: string
  focusedInDeviceConnection?: string
  oncueService?: OncueService
  protocolModules?: ProtocolModule[]
  deviceConnections?: DeviceConnection[]
  connections?: Connection[]
}
