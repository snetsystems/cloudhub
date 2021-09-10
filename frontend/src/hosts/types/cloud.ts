export enum CloudServiceProvider {
  AWS = 'AWS',
  GCP = 'GCP',
  AZURE = 'AZURE',
}

export interface AWSInstanceData {
  [instanceID: string]: {[info: string]: number | string | JSX.Element}
}

export interface CloudHost {
  name: string
  instanceId: string
  instanceType: string
  instanceState: string
  instanceStatusCheck: string
  alarmStatus: string
  cpu: number
  disk: number
  load: number
  memory: number
  apps: string[]
  deltaUptime: string
}
export interface CloudHosts {
  [instanceName: string]: CloudHost
}

export interface getCSPAccessInfoParams {
  provider: string
  region: string
  accesskey: string
  secretkey: string
}

export interface CSPAccessObject {
  id: string
  provider: string
  region: string
  accesskey: string
  secretkey: string
  organization: string
  links: {self: string}
}
