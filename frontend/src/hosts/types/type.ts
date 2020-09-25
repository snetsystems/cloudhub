// Type
import {LayoutCell as LayoutCells, Template} from 'src/types'
import {LayoutCell, VMRole} from 'src/hosts/types'
import {Item} from 'src/reusable_ui/components/treemenu/TreeMenu/walk'

export enum VcenterStatus {
  Request = 'VSPHERE_REQUEST',
  Response = 'VSPHERE_RESPONSE',
}

export interface ResponseDatastore {
  capacity: number
  mode: string
  name: string
  space: number
  type: VMRole
}

export interface ResponseHost {
  cpu_capacity: number
  cpu_core: number
  cpu_name: string
  cpu_space: number
  cpu_usage: number
  datastores: ResponseDatastore[]
  memory_capacity: number
  memory_space: number
  memory_usage: number
  model: string
  name: string
  powerState: string
  storage_capacity: number
  storage_space: number
  storage_usage: number
  vender: string
  vm_count: number
  vms: ResponseVMS[]
}

export interface ResponseCluster {
  cpu_capacity: number
  cpu_core: number
  cpu_usage: number
  datastores: ResponseDatastore[]
  host_count: number
  hosts: ResponseHost[]
  memory_capacity: number
  memory_usage: number
  name: string
  storage_capacity: number
  storage_space: number
  storage_usage: number
  vm_count: number
}

export interface ResponseVMS {
  cpu_usage: number
  guestId: string
  ip_address: string
  memory_usage: number
  moid: string
  name: string
  os: string
  power_state: string
  storage_usage: number
  vmPathName: string
}

export interface ResponseDatacenter {
  cluster_count: number
  clusters: ResponseCluster[]
  cpu_space: number
  cpu_usage: number
  datastores: ResponseDatastore[]
  host_count: number
  hosts: ResponseHost[]
  memory_space: number
  memory_usage: number
  name: string
  storage_capacity: number
  storage_space: number
  storage_usage: number
  vm_count: number
  vms: ResponseVMS[]
}

export interface ResponseVSphere {
  return: {
    [host: string]: {
      datacenters: ResponseDatacenter[]
      vcenter: string
    }
  }[]
}

export interface handleSelectHostProps {
  cpu_usage: number
  guestId: string
  id: string
  index: number
  ip_address: string
  key: string
  label: string
  layoutCells: LayoutCells[]
  level: number
  memory_usage: number
  minion: string
  moid: string
  name: string
  os: string
  parent_chart_field: string
  parent_name: string
  power_state: string
  storage_usage: number
  tempVars: Template[]
  type: VMRole
  vmParam: vmParam
  vmPathName: string
}

export interface vmParam {
  vmField: string
  vmVal: string
}

export interface VMHostsPageLocalStorage {
  layout: {[name: string]: {[name: string]: LayoutCell[]}}
  focusedHost: Item
  activeKey: string
  openNodes: string[]
  proportions: number[]
}

export interface reducerVSphere {
  vspheres: {
    [host: string]: {
      host: string
      id?: string
      interval?: number
      links?: {self: string}
      minion?: string
      nodes?: ResponseVSphere
      organization?: string
      password?: string
      port?: string
      protocol?: string
      username?: string
      isPause?: boolean
    }
  }
  status: VcenterStatus
}
