import {SyslogTableRows} from 'src/types'

export const LOG_ANALYSIS_LOCAL_STORAGE_KEY = 'Log-Analysis'
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

export const SYSLOG_TABLE_ROWS_MOCK_DATA: SyslogTableRows[] = [
  {
    id: '1',
    '@timestamp': ['2025-05-28T01:15:44.000Z'],
    'host.ip': ['192.168.16.1'],
    'host.hostname': ['host1'],
    message: [
      '[2025-05-28T01:15:44.828+00:00][INFO ][plugins.security.authentication] Login attempt with "basic" provider succeeded (requires redirect: true).\n',
    ],
    message_tokens: [
      '2025-05-28t01:15:44.828+00:00',
      'info',
      'plugins.security.authentication',
      'login',
      'attempt',
      'basic',
      'provider',
      'succeeded',
      'requires',
      'redirect',
      'true',
      '.',
    ],
    'event.original': [
      '<142>2025-05-28T10:15:44+09:00 host1 kibana[1181]: [2025-05-28T01:15:44.828+00:00][INFO ][plugins.security.authentication] Login attempt with "basic" provider succeeded (requires redirect: true).\n',
    ],
    'service.type': ['system'],
    'process.name': ['kibana'],
    'process.pid': [1181],
    'log.syslog.severity.code': [6],
    'log.syslog.priority': [142],
    'log.syslog.facility.code': [17],
  },
  {
    id: '2',
    '@timestamp': ['2025-05-28T01:15:43.000Z'],
    'host.ip': ['192.168.16.1'],
    'host.hostname': ['host1'],
    message: [
      '[2025-05-28T01:15:43.716+00:00][INFO ][plugins.security.authentication] Performing login attempt with "basic" provider.\n',
    ],
    message_tokens: [
      '2025-05-28t01:15:43.716+00:00',
      'info',
      'plugins.security.authentication',
      'performing',
      'login',
      'attempt',
      'basic',
      'provider.',
    ],
    'event.original': [
      '<142>2025-05-28T10:15:43+09:00 host1 kibana[1181]: [2025-05-28T01:15:43.716+00:00][INFO ][plugins.security.authentication] Performing login attempt with "basic" provider.\n',
    ],
    'service.type': ['system'],
    'process.name': ['kibana'],
    'process.pid': [1181],
    'log.syslog.severity.code': [6],
    'log.syslog.priority': [142],
    'log.syslog.facility.code': [17],
  },
  {
    id: '3',
    '@timestamp': ['2025-05-28T01:15:30.046Z'],
    'host.ip': ['192.168.16.1'],
    'host.hostname': ['host1'],
    message: [
      'run-docker-runtime\\x2drunc-moby-ebba8de10c493727e9865a1ccacedc604a3feed32b411220fcd183140ee2e635-runc.4YKCW2.mount: Deactivated successfully.\n',
    ],
    message_tokens: [
      'run-docker-runtime-runc-moby-ebba8de10c493727e9865a1ccacedc604a3feed32b411220fcd183140ee2e635-runc.4ykcw2.mount',
      'deactivated',
      'successfully.',
    ],
    'event.original': [
      '<30>2025-05-28T10:15:30.046014+09:00 host1 systemd[1]: run-docker-runtime\\x2drunc-moby-ebba8de10c493727e9865a1ccacedc604a3feed32b411220fcd183140ee2e635-runc.4YKCW2.mount: Deactivated successfully.\n',
    ],
    'service.type': ['system'],
    'process.name': ['systemd'],
    'process.pid': [1],
    'log.syslog.severity.code': [6],
    'log.syslog.priority': [30],
    'log.syslog.facility.code': [3],
  },
]
