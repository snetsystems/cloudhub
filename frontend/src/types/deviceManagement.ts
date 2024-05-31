// interface SpecificAttributes {
//   snmp_community?: string
//   snmp_version?: number
//   snmp_udp_port?: number
// }

// TODO Delete DeviceData Type
export interface DeviceData {
  device_ip: string
  organization: string
  snmp_str: string
  snmp_ver: string
  snmp_port: number
  // ssh_config?: SSHConfig
  ssh_en_password?: string
  ssh_password?: string
  ssh_port?: number
  ssh_user_name?: string
}

// interface SSHConfig {
//   ssh_user_name?: string
//   ssh_password?: string
//   ssh_en_password?: string
//   ssh_port?: number
// }

export type ImportDevicePageStatus = 'UploadCSV' | 'DeviceStatus'
