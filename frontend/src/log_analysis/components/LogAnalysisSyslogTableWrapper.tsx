// Library
import React from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

// Action
import {setFilteredLogForLogAnalysis} from 'src/log_analysis/actions/'

// Type
import {FilteredLogsForLogAnalysis, SyslogTableRows, TimeZones} from 'src/types'

// Components
import LogAnalysisSyslogTable from 'src/log_analysis/components/LogAnalysisSyslogTable'

interface Props {
  timeZone?: TimeZones
  filteredLogsForLogAnalysis?: FilteredLogsForLogAnalysis
  setFilteredLogForLogAnalysis?: (
    filteredLogsForLogAnalysis: FilteredLogsForLogAnalysis
  ) => void
}

function generateMockData(): SyslogTableRows[] {
  return [
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
}

function LogAnalysisSyslogTableWrapper({
  timeZone,
  filteredLogsForLogAnalysis,
  setFilteredLogForLogAnalysis,
}: Props) {
  const syslogTableItemsMockData = generateMockData()
  return (
    <LogAnalysisSyslogTable
      syslogTableRows={syslogTableItemsMockData}
      timeZone={timeZone}
      filteredLogsForLogAnalysis={filteredLogsForLogAnalysis}
      setFilteredLogForLogAnalysis={setFilteredLogForLogAnalysis}
    />
  )
}

const mstp = state => {
  const {
    logAnalysisDashboard: {filteredLogsForLogAnalysis},
  } = state
  return {
    filteredLogsForLogAnalysis,
  }
}

const mdtp = dispatch => ({
  setFilteredLogForLogAnalysis: bindActionCreators(
    setFilteredLogForLogAnalysis,
    dispatch
  ),
})

export default connect(mstp, mdtp, null)(LogAnalysisSyslogTableWrapper)
