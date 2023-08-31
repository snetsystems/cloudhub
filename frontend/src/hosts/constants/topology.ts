export const CELL_SIZE_WIDTH = 90
export const CELL_SIZE_HEIGHT = 90

interface AgentFilter {
  [csp: string]: string[]
}

export const agentFilter: AgentFilter = {
  aws: ['ALL', 'CloudWatch', 'Agent'],
  gcp: ['ALL', 'StackDriver', 'Agent'],
}

export const defaultTemperatureType = 'inlet'

export const temperatureMinValue = {
  inlet: '15',
  inside: '38',
  outlet: '30',
}

export const temperatureMaxValue = {
  inlet: '30',
  inside: '55',
  outlet: '50',
}

export const defaultPreferencesTemperature = [
  'type:inlet,active:1,min:15,max:30',
  'type:inside,active:0,min:38,max:55',
  'type:outlet,active:0,min:30,max:50',
]
