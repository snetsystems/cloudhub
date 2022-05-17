export enum CloudServiceProvider {
  AWS = 'aws',
  GCP = 'gcp',
  AZURE = 'azure',
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
export interface CSPAccessObject {
  id: string
  minion: string
  accesskey: string
  secretkey: string
  saemail: string
  sakey: string
  provider: string
  namespace: string
  organization: string
  links?: {self: string}
  data?: any[]
}

export interface awsSecurity {
  port: number | string
  protocol: string
  security_groups: string
  source?: string
  destination?: string
}

export interface awsVolume {
  attachmentStatus: string
  attachmentTime: string
  deleteOnTermination: string
  deviceName: string
  encrypted: string
  volumeId: string
  volumeSize: number
}

export interface CSPFileWriteParam {
  path: string
  fileName: string
  script: string
}

export interface Instance {
  provider: string
  namespace: string
  instanceid: string
  instancename: string
}
