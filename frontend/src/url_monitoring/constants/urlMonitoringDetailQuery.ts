import {escapeInfluxQLString} from 'src/url_monitoring/utils/escapeInfluxQL'

const FROM = 'FROM ":db:".":rp:"."http_response"'

/**
 * Raw http_response samples for a single target (host / method / server tags).
 * Telegraf fields: response_time (s), http_response_code, content_length; result is a tag on the series.
 */
export function buildUrlMonitoringRawSamplesQuery(
  host: string,
  method: string,
  server: string
): string {
  const h = escapeInfluxQLString(host)
  const m = escapeInfluxQLString(method)
  const s = escapeInfluxQLString(server)
  return `SELECT "response_time","http_response_code","content_length"
${FROM}
WHERE time > :dashboardTime: AND time < :upperDashboardTime:
AND "host" = '${h}' AND "method" = '${m}' AND "server" = '${s}'
LIMIT 500`
}

/** Same bucketing as the list view line series, scoped to one target (RefreshingGraph). */
export function buildUrlMonitoringLatencyChartQuery(
  host: string,
  method: string,
  server: string
): string {
  const h = escapeInfluxQLString(host)
  const m = escapeInfluxQLString(method)
  const s = escapeInfluxQLString(server)
  return `SELECT mean("response_time")*1000 AS "response_time_ms"
${FROM}
WHERE time > :dashboardTime: AND time < :upperDashboardTime:
AND "host" = '${h}' AND "method" = '${m}' AND "server" = '${s}'
GROUP BY time(:interval:)
FILL(null)`
}
