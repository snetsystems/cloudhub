export interface DeviceData {
  device_ip: string
  organization: string
  hostname?: string
  device_type?: string
  device_os?: string
  snmp_config: SNMPConfig
  ssh_config?: SSHConfig
}

export interface SNMPConfig {
  snmp_community?: string
  snmp_port?: number
  snmp_version?: string
  snmp_protocol?: string
}

export interface SSHConfig {
  ssh_user_name?: string
  ssh_password?: string
  ssh_en_password?: string
  ssh_port?: number
}

export type ImportDevicePageStatus = 'UploadCSV' | 'DeviceStatus'
