export interface OpenStackProjectData {
  projectName: string
  row: OpenStackPageTableProjectData
  chart: OpenStackGaugeChartProjectData
}
export interface OpenStackProject {
  projectName: string
  projectData: OpenStackProjectData
  instances: OpenStackInstance[]
}

export interface OpenStackInstanceDetail {
  overview: {
    name: string
    id: string
    description: string
    projectId: string
    status: string
    locked: string
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

export interface OpenStackInstance {
  instanceId: string
  instanceName: string
  imageName: string
  ipAddress: string
  flavor: string
  keyPair: string
  status: string
  availability: string
  zone: string
  task: string
  powerState: string
  age: string
  detail: OpenStackInstanceDetail
}

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
