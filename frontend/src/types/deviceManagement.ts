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

export interface GetDeviceListRsponse {
  Devices?: DevicesInfo[] | null
}

export interface DevicesInfo {
  id: string
  organization: string
  device_ip: string
  hostname: string
  device_type: string
  device_category: string
  device_os: string
  ssh_config: SSHConfig
  snmp_config: SNMPConfig
  device_vendor: string
}

export interface PatchDeviceResponse {
  isSuccess: boolean
}

// SNMP Connection API
export interface SNMPConnectionRequest {
  device_ip: string
  snmp_community?: string
  snmp_port?: number
  snmp_version?: string
  snmp_protocol?: string
}

//device update api
export interface PatchDeviceParams {
  id: string
  deviceData: DevicesInfo
}

export interface DeleteDeviceResponse {
  code: number
  message: string
}

export interface DeleteDeviceParams {
  devices_id: string[]
}

export type ImportDevicePageStatus = 'UploadCSV' | 'DeviceStatus'
