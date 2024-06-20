import {DeviceData, DropdownItem, SNMPConfig, SSHConfig} from 'src/types'

export const DEFAULT_SNMP_CONFIG: SNMPConfig = {
  snmp_community: '',
  snmp_port: 161,
  snmp_version: '1',
  snmp_protocol: 'UDP',
}

export const DEFAULT_SSH_CONFIG: SSHConfig = {
  ssh_user_id: '',
  ssh_password: '',
  ssh_en_password: '',
  ssh_port: 22,
}

export const DEFAULT_NETWORK_DEVICE_DATA: DeviceData = {
  device_ip: '',
  organization: 'Default',
  snmp_config: DEFAULT_SNMP_CONFIG,
  ssh_config: DEFAULT_SSH_CONFIG,
}

export const SNMP_VERSION: DropdownItem[] = [{text: '1'}, {text: '2c'}]

export const SNMP_PROTOCOL: DropdownItem[] = [
  {text: 'UDP'},
  {text: 'UDP4'},
  {text: 'UDP6'},
  {text: 'TCP'},
  {text: 'TCP4'},
  {text: 'TCP6'},
]

export const IMPORT_DEVICE_CSV_Template =
  'device_ip,organization,snmp_community,snmp_port,snmp_version,snmp_protocol,ssh_user_id,ssh_password,ssh_en_password,ssh_port'

export const SNMP_CONNECTION_URL = '/cloudhub/v1/snmp/validation'

export const DEVICE_MANAGEMENT_URL =
  '/cloudhub/v1//ai/network/managements/devices'

export const DELETE_MODAL_INFO = {
  message: `Are you sure you want to delete this?`,
}

export const SYSTEM_MODAL = {
  LEARNING: 'learning',
  MONITORING: 'monitoring',
  DELETE: 'delete',
  MONITORING_DELETE: 'monitoring_delete',
} as const
