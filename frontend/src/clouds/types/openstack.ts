export interface OpenStackProjectData {
  projectName: string
  row: OpenStackPageTableProjectData
  chart: OpenStackGaugeChartProjectData
}
export interface OpenStackProject {
  projectData: OpenStackProjectData
  instances: OpenStackInstance[]
}

export interface OpenStackInstanceDetail {
  overview: {
    name: string
    id: string
    projectId: string
    status: string
    availabilityZone: string
    created: string
    age: string
  }
  speces: {
    flavor: string
  }
  ipAddress: {
    demoNw: string
  }
  securityGroups: {
    default: string
  }
  metaData: string
  volumesAttached: {
    attachedTo: string
  }
}
export interface OpenStackInstanceFlavorDetail {
  id: string
  vcpus: number
  ram: number
  size: number
  flavor: string
}

export interface OpenStackInstance {
  instanceId: string
  instanceName: string | null
  projectName: string | null
  ipAddress: string
  flavor: string
  keyPair: string
  status: string
  availabilityZone: string
  task: string
  powerState: string
  age: string
  detail: OpenStackInstanceDetail
  flavorDetail: OpenStackInstanceFlavorDetail
}
export type FocusedInstance = Pick<
  OpenStackInstance,
  'instanceId' | 'instanceName' | 'projectName'
>

export type FocusedProject = string
export interface OpenStackPageTableProjectData {
  [cloudResource: string]: OpenStackPageTableCloudResource
}

export interface OpenStackPageTableCloudResource {
  resourceUsuage: string
  gaugePosition: number
}

export interface OpenStackGaugeChartProjectData {
  [cloudService: string]: OpenStackGaugeChartCloudResource[]
}

export interface OpenStackGaugeChartCloudResource {
  resourceName: string
  resourceUsuage: string
  gaugePosition: number
}

export interface OpenStackGaugeChartSize {
  width: string
  height: string
}

export interface OpenStackLayoutCell {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export type OpenStackApiFunctions = {
  [x: string]: string[]
}

export const OpenStackDataGroupTypes = {
  projects: 'projects',
  instances: 'instances',
  flavors: 'flavors',
} as const

export type OpenStackDataGroupTypes = typeof OpenStackDataGroupTypes[keyof typeof OpenStackDataGroupTypes]

export type OpenStackApiInfo = {
  options?: object
  apiList: string[]
}

export type OpenStackApiList = {
  [x in OpenStackDataGroupTypes]?: OpenStackApiInfo
}

export interface OpenStackCallParams {
  saltFunction: string
  pToken: string
  saltOptions: object
}

export interface OpenstackProjectAPIInfo {
  [namesapce: string]: {
    flavor: object[]
    instance: object[]
    project: object[]
  }
}
export interface OpenStackInstanceLink {
  instanceId: string
  instanceName: string
  namespace: string
}
export interface OpenStackInstanceLinks {
  [index: string]: OpenStackInstanceLink
}

export interface SecurityGroupRule {
  id: string
  securityGroup: string
  ethertype: 'IPv4' | 'IPv6'
  protocol: string
  portrange: string
  remoteIPPrefix: string
  remoteSecurityGroup?: string
}
