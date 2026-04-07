import {DataTableObject} from 'src/types'
import {TableLineChartPoint} from 'src/types/series'

const hashString = (value: string): number => {
  let h = 0
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0
  }
  return h
}

const mockRegionFor = (host: unknown) => {
  const regions = ['Seoul', 'Pangyo', 'Busan', 'Daegu']
  const h = hashString(String(host ?? ''))
  return regions[h % regions.length]
}

const mockStatusCodeFor = (host: unknown, method: unknown, server: unknown) => {
  const h = hashString(`${host}|||${method}|||${server}`)
  const r = h % 100

  // Test distribution: fewer 2xx, more 4xx/5xx so error badges are more visible
  if (r < 50) return 200 // 50%
  if (r < 60) return 302 // 10%
  if (r < 85) return 404 // 25%
  return 500 // 15%
}

const mockUrlFor = (method: unknown, server: unknown) => {
  const srv = String(server ?? 'example.com')
  const endpoints = ['/health', '/api/status', '/v1/metrics', '/v2/check']
  const endpoint = endpoints[hashString(srv) % endpoints.length]
  return `${String(method ?? 'GET').toUpperCase()} ${srv}\nhttp://${srv}${endpoint}`
}

/**
 * Before backend API wiring: fill list-view fields (status code, URL, support) with mock data.
 * Keeps latency (response_time_ms) from URL Monitoring query results as-is.
 */
export const applyMockUrlMonitoringMeta = (
  rows: DataTableObject[]
): DataTableObject[] => {
  return rows.map(row => {
    const host = row.host
    const method = row.method
    const server = row.server

    return {
      ...row,
      url: mockUrlFor(method, server),
      region: mockRegionFor(host),
      last_http_response_code: mockStatusCodeFor(host, method, server),
    }
  })
}

const makeResponseTimeSeries = (seed: number): TableLineChartPoint[] => {
  // Small per-bucket variation so sparklines are not perfectly flat.
  // TableLineChartCell -> toLineValues() uses time/value as-is.
  return Array.from({length: 14}).map((_, i) => {
    const t = i
    const base = 220 + (seed % 7) * 18
    const wave = Math.sin((i + seed) / 3) * 45
    const jitter = ((seed + i * 13) % 21) - 10
    const value = Math.max(20, Math.round(base + wave + jitter))
    return {time: t, value}
  })
}

/**
 * When Influx returns no rows, create minimal test rows so the UI is not empty.
 * Required keys for columns: host/method/server, response_time_ms
 * applyMockUrlMonitoringMeta() fills url/region/last_http_response_code.
 */
export const createMockUrlMonitoringRows = (): DataTableObject[] => {
  const hosts = ['10.0.0.11', '10.0.0.12', '10.0.1.21', '10.0.2.7']
  const methods = ['GET', 'POST']
  const servers = ['auth.example.com', 'api.example.com', 'order.example.com']

  const rows: DataTableObject[] = []
  let idx = 0
  for (const host of hosts) {
    for (const method of methods) {
      for (const server of servers) {
        rows.push({
          host,
          method,
          server,
          response_time_ms: makeResponseTimeSeries(idx + host.length),
        })
        idx += 1
        // Enough rows to exercise scrolling.
        if (rows.length >= 36) return rows
      }
    }
  }
  return rows
}

