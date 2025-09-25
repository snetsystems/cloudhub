// Types
import {
  DropdownItem,
  FilteredLogsForLogAnalysis,
  SyslogTableRows,
} from 'src/types'

// Constants
export const DEFAULT_SYSLOG_TABLE_CHUNK_SIZE = 500
export const DEFAULT_SYSLOG_TABLE_CHUNK_MAX_SIZE = 10000
export const LOG_ANALYSIS_LOCAL_STORAGE_KEY = 'Log-Analysis'
export const LOG_ANALYSIS_SYSLOG_TABLE_PAGE_SIZE_OPTIONS = [
  10,
  20,
  30,
  40,
  50,
  100,
]

export const SYSLOG_FACILITY_MAP: Record<number, string> = {
  0: 'kern',
  1: 'user',
  2: 'mail',
  3: 'daemon',
  4: 'auth',
  5: 'syslog',
  6: 'lpr',
  7: 'news',
  8: 'uucp',
  9: 'cron',
  10: 'authpriv',
  11: 'ftp',
  12: 'ntp',
  13: 'security',
  14: 'console',
  15: 'cron2',
  16: 'local0',
  17: 'local1',
  18: 'local2',
  19: 'local3',
  20: 'local4',
  21: 'local5',
  22: 'local6',
  23: 'local7',
}

export const VM_HYPERVISOR_DROPDOWN_ITEMS: DropdownItem[] = [{text: 'VMware'}]

export const VM_LEVEL_DROPDOWN_ITEMS: DropdownItem[] = [
  {text: 'VMware'},
  {text: 'OpenStack'},
]

export const BAREMETAL_VENDOR_DROPDOWN_ITEMS: DropdownItem[] = [
  {text: 'Inspur'},
  {text: 'Gigabyte'},
  {text: 'Dell'},
  {text: 'Supermicro'},
]

export const DEFAULT_TIME_RANGE_OPTIONS = [
  {text: '1h'},
  {text: '2h'},
  {text: '3h'},
  {text: '4h'},
  {text: '5h'},
  {text: '6h'},
]

export const DEFAULT_TIME_RANGE_OPTIONS_PLACEHOLDER =
  'Time range (e.g., 2h, 30m, 1d)'
