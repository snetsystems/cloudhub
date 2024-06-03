import {DropdownItem, DeviceData, SNMPConfig, SSHConfig} from 'src/types'

export const DEFAULT_SNMP_CONFIG: SNMPConfig = {
  snmp_community: '',
  snmp_port: 162,
  snmp_version: '1',
  snmp_protocol: 'udp',
}

export const DEFAULT_SSH_CONFIG: SSHConfig = {
  ssh_user_name: '',
  ssh_password: '',
  ssh_en_password: '',
  ssh_port: 22,
}
export const DEFAULT_DEVICE_DATA: DeviceData = {
  device_ip: '',
  organization: 'Default',
  snmp_config: DEFAULT_SNMP_CONFIG,
  ssh_config: DEFAULT_SSH_CONFIG,
}

export const SNMP_VERSION: DropdownItem[] = [{text: '1'}, {text: '2c'}]

export const SNMP_PROTOCOL: DropdownItem[] = [
  {text: 'udp'},
  {text: 'udp4'},
  {text: 'udp6'},
  {text: 'tcp'},
  {text: 'tcp4'},
  {text: 'tcp6'},
]

export const IMPORT_DEVICE_CSV_Template =
  'dev_ip,ssh_user,ssh_pwd,enable,ssh_port,snmp_str,group,snmp_ver,snmp_port,organization'
