export interface DeviceData {
  id?: number
  organization: string
  organization_name?: string
  device_ip: string
  hostname?: string
  device_type?: string
  device_category?: string
  device_os?: string
  device_vendor?: string
  sensitivity?: number
  ssh_config?: SSHConfig
  snmp_config: SNMPConfig
  links?: {
    self: string
  }
  is_modeling_generated?: boolean
  is_config_written?: boolean
  isMonitoring?: boolean
}

export interface ApplyMonitoringProps {
  isCreateLearning?: boolean
  organization: string
  device_ip: string
  hostname: string
}

export interface SNMPConfig {
  snmp_community: string
  snmp_port: number
  snmp_version: string
  snmp_protocol: string
}

export interface SSHConfig {
  ssh_user_id?: string
  ssh_password?: string
  ssh_en_password?: string
  ssh_port?: number
}

export interface SNMPConnectionRequest {
  device_ip: string
  snmp_community?: string
  snmp_port?: number
  snmp_version?: string
  snmp_protocol?: string
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
  index: number
  device_ip: string
  device_os: string
  device_type: string
  hostname: string
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
  devices_id: number[]
}

export type ImportDevicePageStatus = 'UploadCSV' | 'DeviceStatus'

export type DeviceConnectionStatus = 'None' | 'Creating' | 'Updating'

interface deviceMonitoringStatusData {
  uptime?: number
}
export interface DeviceMonitoringStatus {
  [x: string]: deviceMonitoringStatusData
}
