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

  // 테스트용 분포:
  // - 200번대는 줄이고
  // - 400/500번대를 늘려서 빨간 배지(에러) 비중이 더 크게 보이도록 함
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
 * 백엔드 API 연결 전, 리스트뷰에 필요한 필드(status code, URL, 지원)를 임시로 채웁니다.
 * - URL Monitoring 쿼리 결과의 latency(response_time_ms)는 그대로 사용합니다.
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
  // sparkline을 "평평하게" 보이지 않게, time bucket별로 약간의 변동을 준다.
  // TableLineChartCell -> toLineValues()에서 time/value 필드를 그대로 사용함.
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
 * Influx 결과가 0일 때 화면이 비지 않도록 최소 테스트 rows를 생성합니다.
 * - columns에서 요구하는 key: host/method/server, response_time_ms
 * - applyMockUrlMonitoringMeta()가 url/region/last_http_response_code를 보강합니다.
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
        // 스크롤이 생기도록 충분히 많이 생성합니다.
        if (rows.length >= 36) return rows
      }
    }
  }
  return rows
}

