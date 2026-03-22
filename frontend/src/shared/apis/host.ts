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
  disks: Disk[]
  gpus: GPU[]
  sourceType: HostSourceType
  status: HostStatus
}

export interface Host {
  id: string
  minionId: string
  hostname: string
  ip: string
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
  disks: Disk[]
  gpus: GPU[]
  sourceType: HostSourceType
  orgId: string
  status: HostStatus
  createdAt: string
}

export async function getHosts(): Promise<Host[]> {
  const {data} = await AJAX({
    url: '/cloudhub/v2/hosts',
    method: 'GET',
  })
  return data as Host[]
}

export async function getHostByHostname(hostname: string): Promise<Host> {
  const {data} = await AJAX({
    url: `/cloudhub/v2/hosts/${encodeURIComponent(hostname)}`,
    method: 'GET',
  })
  return data as Host
}

export async function registerHost(payload: HostRegistrationPayload): Promise<Host> {
  const {data} = await AJAX({
    url: '/cloudhub/v2/hosts',
    method: 'POST',
    data: payload,
  })
  return data as Host
}

export interface HostPatch {
  status?: HostStatus
  orgId?: string
}

export async function patchHost(hostname: string, patch: HostPatch): Promise<Host> {
  const {data} = await AJAX({
    url: `/cloudhub/v2/hosts/${encodeURIComponent(hostname)}`,
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
    url: `/cloudhub/v2/hosts/${encodeURIComponent(hostname)}`,
    method: 'PUT',
    data: payload,
  })
  return data as Host
}

export async function deleteHost(hostname: string): Promise<void> {
  await AJAX({
    url: `/cloudhub/v2/hosts/${encodeURIComponent(hostname)}`,
    method: 'DELETE',
  })
}
