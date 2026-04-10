import AJAX from 'src/utils/ajax'

export interface IPInterface {
  interfaceName: string
  ipAddress: string
}

export interface Disk {
  device: string
  mountPoint: string
}

export interface GPU {
  vendor: string
  model: string
}

export type HostStatus = 'accepted' | 'rejected'
export type HostSourceType = 'salt' | 'snmp' | 'syslog'

export interface HostRegistrationPayload {
  minionId: string
  hostname: string
  originalHostname: string
  ipInterfaces: IPInterface[]
  os: string
  osFamily: string
  osVersion: string
  kernel: string
  arch: string
  memTotalKb: number
  swapTotalKb: number
  cpuCores: number
  cpuModel: string
  biosVersion: string
  timezone: string
  selinuxState: string
  isCollector: boolean
  disks: Disk[]
  gpus: GPU[]
  sourceType: HostSourceType
  status: HostStatus
}

export interface Host {
  id: string
  minionId: string
  hostname: string
  originalHostname?: string
  ip?: string
  privateIps: string[]
  ipInterfaces: IPInterface[]
  os: string
  osFamily: string
  osVersion: string
  kernel: string
  arch: string
  memTotalKb: number
  swapTotalKb: number
  cpuCores: number
  cpuModel: string
  biosVersion: string
  timezone?: string
  selinuxState?: string
  isCollector?: boolean
  disks: Disk[]
  gpus: GPU[]
  sourceType: HostSourceType
  orgId: string
  status: HostStatus
  createdAt?: string
  acceptedAt?: string
  updatedAt?: string
  links?: {
    self: string
  }
}

export async function getHosts(): Promise<Host[]> {
  const {data} = await AJAX({
    url: '/cloudhub/v1/hosts',
    method: 'GET',
  })
  return data as Host[]
}

export async function getHostByHostname(hostname: string): Promise<Host> {
  const {data} = await AJAX({
    url: `/cloudhub/v1/hosts/${encodeURIComponent(hostname)}`,
    method: 'GET',
  })
  return data as Host
}

export async function registerHost(
  payload: HostRegistrationPayload
): Promise<Host> {
  const {data} = await AJAX({
    url: '/cloudhub/v1/hosts',
    method: 'POST',
    data: payload,
  })
  return data as Host
}

export interface HostPatch {
  status?: HostStatus
  orgId?: string
}

export async function patchHost(
  hostname: string,
  patch: HostPatch
): Promise<Host> {
  const {data} = await AJAX({
    url: `/cloudhub/v1/hosts/${encodeURIComponent(hostname)}`,
    method: 'PATCH',
    data: patch,
  })
  return data as Host
}

export async function updateHost(
  hostname: string,
  payload: Partial<HostRegistrationPayload>
): Promise<Host> {
  const {data} = await AJAX({
    url: `/cloudhub/v1/hosts/${encodeURIComponent(hostname)}`,
    method: 'PUT',
    data: payload,
  })
  return data as Host
}

export interface HostBulkUpsertFailedItem {
  hostname: string
  error: string
}

export interface HostBulkUpsertResponse {
  created: string[]
  updated: string[]
  failed: HostBulkUpsertFailedItem[]
}

export async function bulkUpsertHosts(
  hosts: HostRegistrationPayload[]
): Promise<HostBulkUpsertResponse> {
  const normalize = (raw: any): HostBulkUpsertResponse => ({
    created: Array.isArray(raw?.created) ? raw.created : [],
    updated: Array.isArray(raw?.updated) ? raw.updated : [],
    failed: Array.isArray(raw?.failed) ? raw.failed : [],
  })

  try {
    const res = await AJAX({
      url: '/cloudhub/v1/hosts/bulk-upsert',
      method: 'POST',
      data: {hosts},
    })
    return normalize((res as {data: HostBulkUpsertResponse}).data)
  } catch (err: any) {
    // AJAX throws the axios response on error; 400 bulk-upsert still returns a JSON body.
    if (err?.status === 400 && err?.data) {
      return normalize(err.data)
    }
    console.warn('bulkUpsertHosts request failed', {
      status: err?.status,
      data: err?.data,
    })
    throw err
  }
}

export async function deleteHost(hostname: string): Promise<void> {
  await AJAX({
    url: `/cloudhub/v1/hosts/${encodeURIComponent(hostname)}`,
    method: 'DELETE',
  })
}
