import {DropdownItem} from 'src/types'
import {DeviceData} from 'src/types'

export const DEFAULT_DEVICE_DATA: DeviceData = {
  device_ip: '',
  organization: 'Default',
  snmp_str: '',
  snmp_ver: '1',
  snmp_port: 162,
  ssh_en_password: '',
  ssh_password: '',
  ssh_port: 22,
  ssh_user_name: '',
}

export const SNMP_VERSION: DropdownItem[] = [{text: '1'}, {text: '3'}]
