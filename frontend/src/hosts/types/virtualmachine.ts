import {TreeNode} from 'src/reusable_ui/components/treemenu/TreeMenu/walk'

export enum VMRole {
  vcenter = 'vcenter',
  datacenter = 'datacenter',
  datastore = 'datastore',
  cluster = 'cluster',
  host = 'host',
  vm = 'vm',
}
export interface VM extends TreeNode {
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
  type: VMRole.vm
  vmPathName: string
}

export interface VMDatastore extends TreeNode {
  name: string
  capacity: number
  space: number
  type: VMRole.datastore
  mode: string
}

export interface VMHost extends TreeNode {
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
  parent_chart_field: string
  parent_name: string
  parent_type: string
  powerState: string
  storage_capacity: number
  storage_space: number
  storage_usage: number
  type: VMRole.host
  vender: string
  vm_count: number
  vms: VM[]
}

export interface VMCluster extends TreeNode {
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
  parent_chart_field: string
  parent_name: string
  storage_capacity: number
  storage_space: number
  storage_usage: number
  type: VMRole.cluster
  vm_count: number
}

export interface VMDatacenter extends TreeNode {
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
  parent_chart_field: string
  parent_name: string
  storage_capacity: number
  storage_space: number
  storage_usage: number
  type: VMRole.datacenter
  vm_count: number
}

export interface VCenter extends TreeNode {
  buttons?: (() => JSX.Element)[]
  cluster_count?: number
  cpu_space?: number
  cpu_usage?: number
  host_count?: number
  index: number
  label: string
  level: number
  memory_space?: number
  memory_usage?: number
  minion?: string
  storage_capacity?: number
  storage_space?: number
  storage_usage?: number
  type?: VMRole.vcenter
  vm_count?: number
}
