import AJAX from 'src/utils/ajax'

export interface IPInterface {
  interfaceName: string
  ipAddress: string
}

export interface GPU {
  slot?: number
  vendor: string
  model: string
}

export type AgentStatus = 'accepted' | 'rejected'

export interface AgentRegistrationPayload {
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
  gpus: GPU[]
  status: AgentStatus
}

export interface Agent {
  id: string
  minionId: string
  hostname: string
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
  gpus: GPU[]
  orgId: string
  status: AgentStatus
  createdAt: string
}

export async function registerAgent(
  payload: AgentRegistrationPayload
): Promise<Agent> {
  const {data} = await AJAX({
    url: '/cloudhub/v1/agents',
    method: 'POST',
    data: payload,
  })
  return data as Agent
}

export async function getAgents(): Promise<Agent[]> {
  const {data} = await AJAX({
    url: '/cloudhub/v1/agents',
    method: 'GET',
  })
  return data as Agent[]
}

export async function deleteAgent(minionId: string): Promise<void> {
  await AJAX({
    url: `/cloudhub/v1/agents/${encodeURIComponent(minionId)}`,
    method: 'DELETE',
  })
}
