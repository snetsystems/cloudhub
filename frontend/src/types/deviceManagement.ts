export interface DeviceData {
  id?: number
  organization: string
  device_ip: string
  hostname?: string
  device_type?: string
  device_category?: string
  device_os?: string
  IsCollectingCfgWritten?: boolean
  ssh_config?: SSHConfig
  snmp_config: SNMPConfig
  sensitivity?: string
  device_vendor?: string
  learning_state?: string
  learning_update_date?: string
  learning_finish_datetime?: string
  is_learning?: boolean
  ml_function?: string
  links?: {
    self: string
  }
}

export interface ApplyMonitoringProps {
  isCreateLearning?: boolean
  organization: string
  device_ip: string
  hostname: string
}

export interface SNMPConfig {
  community: string
  port: number
  version: string
  protocol: string
  snmp_port?: number
}

export interface SSHConfig {
  user_id?: string
  password?: string
  en_password?: string
  port?: number
  ssh_port?: number
}

export interface SNMPConnectionRequest {
  device_ip: string
  community?: string
  port?: number
  version?: string
  protocol?: string
}

export interface SNMPConnectionResponse {
  data: {
    failed_requests: SNMPConnectionFailedDevice[]
    results: SNMPConnectionSuccessDevice[] | null
  }
}

export interface SNMPConnectionFailedDevice {
  index: number
  device_ip: string
  errorMessage: string
}

export interface SNMPConnectionSuccessDevice {
  device_ip: string
  index: number
  device_type: string
  hostname: string
  device_os: string
}

export type CreateDeviceListRequest = DeviceData[]

export interface CreateDeviceListResponse {
  data: {failed_devices: FailedDevice[]}
}

export interface FailedDevice {
  index: number
  device_ip: string
  errorMessage: string
}

export interface GetDeviceListResponse {
  Devices?: DeviceData[] | null
}

export interface UpdateDeviceRequest {
  id: number
  deviceData: DeviceData
}

export interface UpdateDeviceResponse {
  data: {failed_devices: FailedDevice[]}
}

export interface DeleteDeviceResponse {
  code: number
  message: string
}

export interface DeleteDeviceParams {
  devices_ids: number[]
}

export type ImportDevicePageStatus = 'UploadCSV' | 'DeviceStatus'

export type DeviceConnectionStatus = 'None' | 'Creating' | 'Updating'

interface deviceMonitoringStatusData {
  uptime?: number
}
export interface DeviceMonitoringStatus {
  [x: string]: deviceMonitoringStatusData
}
