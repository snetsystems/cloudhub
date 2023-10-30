export const CELL_SIZE_WIDTH = 90
export const CELL_SIZE_HEIGHT = 90

interface AgentFilter {
  [csp: string]: string[]
}

export const agentFilter: AgentFilter = {
  aws: ['Agent', 'CloudWatch'],
  gcp: ['Agent', 'StackDriver'],
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
  'type:inlet,active:0,min:15,max:30',
  'type:inside,active:1,min:38,max:55',
  'type:outlet,active:0,min:30,max:50',
]

export const TOOLTIP_TYPE = {
  temperature: 'temperature',
  cpu: 'cpu',
  memory: 'memory',
  disk: 'disk',
}

export const DATA_GATHER_TYPE = {agent: 'agent', ipmi: 'ipmi'}

export const keysWithGatherType = {
  agent: {
    cpu: 'cpu',
    memory: 'memory',
    disk: 'disk',
    temperature: {
      inside: 'inside',
      inlet: 'inlet',
      outlet: 'outlet',
    },
  },
  ipmi: {
    cpu: 'ipmiCpu',
    memory: 'ipmiMemory',
    disk: 'disk',
    temperature: {
      inside: 'inside',
      inlet: 'inlet',
      outlet: 'outlet',
    },
  },
  true: {
    cpu: 'cpu',
    memory: 'memory',
    disk: 'disk',
    temperature: {
      inside: 'inside',
      inlet: 'inlet',
      outlet: 'outlet',
    },
  },
}
export const inletText = 'CPU Temp'
export const titleWithGatherType = {
  agent: {
    cpu: 'CPU usage',
    memory: 'Memory usage',
    disk: 'Disk usage',
    inside: inletText,
    inlet: 'Inlet Temp',
    outlet: 'Outlet Temp',
  },
  ipmi: {
    ipmiCpu: 'CPU usage',
    ipmiMemory: 'Memory usage',
    disk: 'Disk usage',
    inside: inletText,
    inlet: 'Inlet Temp',
    outlet: 'Outlet Temp',
  },
  true: {
    cpu: 'CPU usage',
    memory: 'Memory usage',
    disk: 'Disk usage',
    inside: inletText,
    inlet: 'Inlet Temp',
    outlet: 'Outlet Temp',
  },
}

export const objectKeyWithGatherType = {
  agent: {
    cpu: 'cpu',
    memory: 'memory',
    disk: 'disk',
    inside: 'temperature',
    inlet: 'temperature',
    outlet: 'temperature',
  },
  ipmi: {
    ipmiCpu: 'cpu',
    ipmiMemory: 'memory',
    disk: 'disk',
    inside: 'temperature',
    inlet: 'temperature',
    outlet: 'temperature',
  },
  true: {
    cpu: 'cpu',
    memory: 'memory',
    disk: 'disk',
    inside: 'temperature',
    inlet: 'temperature',
    outlet: 'temperature',
  },
}

export const TOPOLOGY_TOOLTIP_TABLE_SIZING = {
  TABLE_ROW_IN_HEADER: '48%',
  TABLE_ROW_IN_BODY: '52%',
}

export const TOOLTIP_OFFSET_X = 5
export const TOOLTIP_WIDTH = 240
export const OUTLINE = 58
export const DETECT_RATE = 0.85
export const STATIC_TOOLTIP_HEIGHT = 147
