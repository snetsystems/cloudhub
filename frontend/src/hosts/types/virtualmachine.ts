import {Item} from 'src/reusable_ui/components/treemenu/TreeMenu/walk'

export interface VM extends Item {
  moid: string
  name: string
  storage_usage: number
  cpu_usage: number
  guestId: string
  index: number
  label: string
  level: number
  memory_usage: number
  minion: string
  os: string
  parent_chart_field: string
  parent_name: string
  power_state: string
  type: string
  vmPathName: string
}

export interface VMDatastore extends Item {
  name: string
  capacity: number
  space: number
  type: string
  mode: string
}

export interface VMHost extends Item {
  cpu_capacity: number
  cpu_core: number
  cpu_name: string
  cpu_space: number
  cpu_usage: number
  datastores: VMDatastore[]
  index: number
  label: string
  level: number
  memory_capacity: number
  memory_space: number
  memory_usage: number
  minion: string
  model: string
  name: string
  nodes: {[key: string]: VM[]}
  parent_chart_field: string
  parent_name: string
  parent_type: string
  powerState: string
  storage_capacity: number
  storage_space: number
  storage_usage: number
  type: string
  vender: string
  vm_count: number
  vms: VM[]
}

export interface VMCluster extends Item {
  cpu_capacity: number
  cpu_core: number
  cpu_usage: number
  datastores: VMDatastore[]
  host_count: number
  hosts: VMHost[]
  index: number
  label: string
  level: number
  memory_capacity: number
  memory_usage: number
  minion: string
  name: string
  nodes: {[key: string]: VMHost}
  parent_chart_field: string
  parent_name: string
  storage_capacity: number
  storage_space: number
  storage_usage: number
  type: string
  vm_count: number
}

export interface VMDatacenter extends Item {
  cluster_count: number
  clusters: VMCluster[]
  cpu_space: number
  cpu_usage: number
  datacenter_hosts: VMHost[]
  datastores: VMDatastore[]
  host_count: number
  hosts: VMHost[]
  index: number
  label: string
  level: number
  memory_space: number
  memory_usage: number
  minion: string
  name: string
  nodes: {[key: string]: VMCluster | VMHost}
  parent_chart_field: string
  parent_name: string
  storage_capacity: number
  storage_space: number
  storage_usage: number
  type: string
  vm_count: number
}

export interface VCenter extends Item {
  buttons?: () => void[]
  cluster_count: number
  cpu_space: number
  cpu_usage: number
  host_count: number
  index: number
  label: string
  level: number
  memory_space: number
  memory_usage: number
  minion: string
  nodes: VMDatacenter[]
  storage_capacity: number
  storage_space: number
  storage_usage: number
  type: string
  vm_count: number
}
