export const CELL_SIZE_WIDTH = 90
export const CELL_SIZE_HEIGHT = 90

interface AgentFilter {
  [csp: string]: string[]
}
type LayoutFilter = {
  [layoutApp: string]: string
}

export const agentFilter: AgentFilter = {
  aws: ['ALL', 'CloudWatch', 'Within instances'],
  gcp: ['ALL', 'StackDriver', 'Within instances'],
}

export const layoutFilter: LayoutFilter = {
  cloudwatch_elb: 'cloudwatch_elb',
  system: 'system',
  win_system: 'win_system',
  stackdriver: 'stackdriver',
  cloudwatch: 'cloudwatch',
}
