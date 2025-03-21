interface TooltipRow {
  title: string
  value: number
  originalValue?: number | string | JSX.Element
  isTemperatureMetrics?: boolean
}

export interface NVidiaSmiMonitoringTooltipNode {
  rows: TooltipRow[]
  name: string
}

type Hostname = string
export type HostsForGPUSmiData = Record<Hostname, GPUSmiData[]>
export type HostsForGPUSmiMIGData = Record<Hostname, GPUSmiMIGData[]>

export interface GPUSmiData {
  hostname: string
  gpuIndex: number
  gpuPowerDraw: number
  gpuCurrentPowerLimit: number
  gpuTemperature: number
  gpuTemperatureMaxThreshold: number
  gpuMemoryTemperature: number
  gpuMemoryTemperatureMaxThreshold: number
  pcieLinkTx: number
  pcieLinkRx: number
  pcieLinkCurrentGeneration: number
  pcieLinkCurrentWidth: number
  migMode: 'Enabled' | 'Disabled'
  gpuMemoryUtilization: number
  gpuMemoryTotal: number
  gpuMemoryUsed: number
  gpuUtilization: number
}
export interface GPUSmiMIGData {
  hostname: string
  gpuIndex: number
  gi: number
  ci: number
  bar1Used: number
  bar1Total: number
  fbUsed: number
  fbTotal: number
}

export interface FilteredHostForGPUMonitoring {
  hostname: string
  gpuIndex: number
  gi: number
  ci: number
  migMode: 'Enabled' | 'Disabled' | 'N/A'
}

export interface GPUMonitoringSeries {
  name: string
  columns: string[]
  values: any[][]
  tags: {
    host: string
    index?: string
    compute_index?: string
    gpu_index?: string
  }
}

type NumericKeys<T> = {
  [K in keyof T]: T[K] extends number ? K : never
}[keyof T]

export type AllowedGPUMonitoringMetricProperty =
  | NumericKeys<GPUSmiData>
  | 'migMode'

export interface FetchNvidiaLocalGrainItemsForGPUResponse {
  return: Array<Record<string, NvidiaLocalGrainItemForGPU>>
}

export interface NvidiaLocalGrainItemForGPU {
  os: string
  osrelease: string
  localhost: string
  gpus: Array<{vendor: string; model: string}>
}

export interface FetchNvidiaLocalGrainItemsResponse {
  return: Array<Record<Hostname, NvidiaLocalGrainItem>>
}

export interface NvidiaLocalGrainItem {
  saltversion: string
  master: string
  os_family: string
  os: string
  osrelease: string
  kernel: string
  kernelrelease: string
  kernelversion: string
  virtual: string
  cpuarch: string
  cpu_model: string
  localhost: string
  ip_interfaces: Record<string, string[]>
  ip6_interfaces: Record<string, string[]>
  ip4_gw: string
  ip6_gw: boolean
  'dns:nameservers': string[]
  locale_info: {
    defaultlanguage: string
    defaultencoding: string
    detectedencoding: string
    timezone: string
  }
  biosversion: string
  mem_total: number
  swap_total: number
  gpus: Array<{vendor: string; model: string}>
  selinux: string
  path: string
}

export type FetchNVidiaGPUMigLgipResponse = string

export interface MigProfile {
  name: string
  gpu: number
  id: number
  memGiB: number
  memoryBytes: number
  totalInstances: number
}
