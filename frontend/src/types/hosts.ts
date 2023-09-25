import {Axes} from 'src/types'
import {mxCell as mxCellType} from 'mxgraph'
import {CloudServiceProvider} from 'src/hosts/types'

export interface HostNames {
  [index: string]: HostName
}

export interface HostName {
  name: string
}

export interface Host {
  name: string
  cpu: number
  load?: number
  apps?: string[]
  tags?: {[x: string]: string}
  deltaUptime?: number
  winDeltaUptime?: number
  memory?: number
  disk?: number
  ipmiCpu?: number
  ipmiMemory?: number
  inside?: number
  inlet?: number
  outlet?: number
  extraTag?: {[x: string]: any}
}

export interface Layout {
  id: string
  app: string
  measurement: string
  cells: LayoutCell[]
  link: LayoutLink
  autoflow: boolean
}

interface LayoutLink {
  herf: string
  rel: string
}

export interface LayoutCell {
  x: number
  y: number
  w: number
  h: number
  i: string
  name: string
  type: string
  queries: LayoutQuery[]
  axes: Axes
  colors: string[]
}

export interface LayoutQuery {
  label: string
  query: string
}

export interface Ipmi {
  target: string
  host: string
  user: string
  pass: string
}
export interface IpmiCell {
  target: string
  host: string
  user: string
  pass: string
  powerStatus: string
  cell: mxCellType
}

export interface CloudHost {
  name: string
  cpu: number
  disk?: number
  load?: number
  memory?: number
  apps?: string[]
  tags?: {[x: string]: any}
  deltaUptime?: string
  instanceId?: string
  instanceType?: string
  instanceState?: string
  instanceStatusCheck?: string
  alarmStatus?: string
  csp: {
    id: string
    organization: string
    namespace: string
    provider: CloudServiceProvider
  }
}

export interface CloudHosts {
  [instanceName: string]: CloudHost
}
