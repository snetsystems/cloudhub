export const CELL_SIZE_WIDTH = 90
export const CELL_SIZE_HEIGHT = 90

interface AgentFilter {
  [csp: string]: string[]
}

export const agentFilter: AgentFilter = {
  aws: ['ALL', 'CloudWatch', 'Agent'],
  gcp: ['ALL', 'StackDriver', 'Agent'],
}
