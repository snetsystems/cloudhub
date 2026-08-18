import {ServerListQuery} from 'src/hosts/constants/serverListColumns'

export function buildUrlMonitoringQueries(): ServerListQuery[] {
  const from = 'FROM ":db:".":rp:"."http_response"'
  return [
    {
      id: 'url-monitoring-last-status',
      text: `SELECT last("response_time")*1000 AS "response_time_ms", last("http_response_code") AS "last_http_response_code", last("result_code") AS "result_code"
${from}
WHERE time > :dashboardTime: AND time < :upperDashboardTime:
GROUP BY "host", "method", "server"
FILL(null)`,
    },
    {
      id: 'url-monitoring-line-response-time',
      text: `SELECT mean("response_time")*1000 AS "response_time_ms"
${from}
WHERE time > :dashboardTime: AND time < :upperDashboardTime:
GROUP BY "host", "method", "server", time(:interval:)
FILL(null)`,
    },
  ]
}
