export const LOG_ANALYSIS_CELLS_COLUMNS = 'Log-Analysis-cells-columns'
export const LOG_ANALYSIS_SYSLOG_TABLE_PAGE_SIZE_OPTIONS = [5, 10, 50]

export const SYSLOG_SEVERITY_MAP: Record<number, string> = {
  0: 'Emergency',
  1: 'Alert',
  2: 'Critical',
  3: 'Error',
  4: 'Warning',
  5: 'Notice',
  6: 'Informational',
  7: 'Debug',
}

export const SYSLOG_FACILITY_MAP: Record<number, string> = {
  0: 'kernel messages',
  1: 'user-level messages',
  2: 'mail system',
  3: 'system daemons',
  4: 'security/authorization messages',
  5: 'messages generated internally by syslogd',
  6: 'line printer subsystem',
  7: 'network news subsystem',
  8: 'UUCP subsystem',
  9: 'clock daemon',
  10: 'security/authorization messages',
  11: 'FTP daemon',
  12: 'NTP subsystem',
  13: 'log audit',
  14: 'log alert',
  15: 'clock daemon',
  16: 'local use 0 (local0)',
  17: 'local use 1 (local1)',
  18: 'local use 2 (local2)',
  19: 'local use 3 (local3)',
  20: 'local use 4 (local4)',
  21: 'local use 5 (local5)',
  22: 'local use 6 (local6)',
  23: 'local use 7 (local7)',
}
