export interface DeviceData {
  id?: string
  organization: string
  device_ip: string
  hostname?: string
  device_type?: string
  device_category?: string
  device_os?: string
  ssh_config?: SSHConfig
  snmp_config: SNMPConfig
  device_vendor?: string
}
export interface SNMPConfig {
  snmp_community: string
  snmp_port: number
  snmp_version: string
  snmp_protocol: string
}

export interface SSHConfig {
  ssh_user_name?: string
  ssh_password?: string
  ssh_en_password?: string
  ssh_port?: number
}
export interface DevicesInfo {
  id?: string
  organization: string
  device_ip: string
  hostname: string
  device_type: string
  device_category: string
  device_os: string
  ssh_config: SSHConfig
  snmp_config: SNMPConfig
  device_vendor: string
  links?: {
    self: string
  }
  is_modeling_generated?: boolean
  is_monitoring_enabled?: boolean
  learn_ratio?: number
  learn_setting_group_id?: number
}

// SNMP Connection API
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
    results: SNMPConnectionSuccessDevice[]
  }
}

export interface SNMPConnectionFailedDevice {
  index: number
  device_ip: string
  errorMessage: string
}

export interface SNMPConnectionSuccessDevice {
  device_type: string
  hostname: string
  device_os: string
}

export type CreateDeviceListRequest = DevicesInfo[]

export interface CreateDeviceListResponse {
  data: {failed_devices: FailedDevice[]}
}

export interface FailedDevice {
  index: number
  device_ip: string
  errorMessage: string
}

export interface GetDeviceListRsponse {
  Devices?: DevicesInfo[] | null
}

export interface UpdateDeviceRequest {
  id: string
  devicesInfo: DevicesInfo
}

export interface UpdateDeviceResponse {
  data: {failed_devices: FailedDevice[]}
}

export interface DeleteDeviceResponse {
  code: number
  message: string
}

export interface DeleteDeviceParams {
  devices_id: string[]
}

export type ImportDevicePageStatus = 'UploadCSV' | 'DeviceStatus'

export type DeviceConnectionStatus = 'None' | 'Creating' | 'Updating'
