import {TimeSeriesResponse, TimeSeriesValue} from 'src/types/series'

export interface UrlMonitoringRawSampleRow {
  time: TimeSeriesValue
  elapsedMs: number | null
  statusCode: number | null
  bodyBytes: number | null
  resultTag: string
}

const toNumber = (v: TimeSeriesValue): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** HTTP status code → short reason (Telegraf does not store status text). */
export function httpStatusReason(code: number | null): string {
  if (code === null) return '--'
  const map: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  }
  return map[code] ?? `HTTP ${code}`
}

export function formatBodyLength(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return '--'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const kiB = bytes / 1024
  if (kiB < 1024) return `${kiB.toFixed(1)} KiB`
  return `${(kiB / 1024).toFixed(2)} MiB`
}

export function formatDetailReason(row: UrlMonitoringRawSampleRow): string {
  const r = (row.resultTag || '').toLowerCase()
  if (!row.resultTag) return httpStatusReason(row.statusCode)
  if (r === 'success') return httpStatusReason(row.statusCode)
  return row.resultTag
}

export function parseUrlMonitoringRawSamples(
  response: TimeSeriesResponse | null
): UrlMonitoringRawSampleRow[] {
  if (!response?.results?.length) return []

  const out: UrlMonitoringRawSampleRow[] = []

  for (const statement of response.results) {
    if (!('series' in statement) || !statement.series?.length) continue

    for (const series of statement.series) {
      const tags = series.tags ?? {}
      const resultTag = String(tags.result ?? tags.status_code ?? '')

      const cols = series.columns ?? []
      const ti = cols.indexOf('time')
      if (ti < 0) continue

      const rt = cols.indexOf('response_time')
      const hc = cols.indexOf('http_response_code')
      const cl = cols.indexOf('content_length')

      for (const row of series.values ?? []) {
        const t = row[ti] ?? null
        const rtSec = rt >= 0 ? toNumber(row[rt]) : null
        const code = hc >= 0 ? toNumber(row[hc]) : null
        const len = cl >= 0 ? toNumber(row[cl]) : null

        out.push({
          time: t,
          elapsedMs:
            rtSec !== null && Number.isFinite(rtSec) ? rtSec * 1000 : null,
          statusCode: code !== null ? Math.round(code) : null,
          bodyBytes: len !== null ? Math.round(len) : null,
          resultTag,
        })
      }
    }
  }

  const timeRank = (t: TimeSeriesValue): number => {
    if (typeof t === 'number' && Number.isFinite(t)) return t
    if (typeof t === 'string') {
      const n = Date.parse(t)
      return Number.isFinite(n) ? n : 0
    }
    return 0
  }

  out.sort((a, b) => timeRank(b.time) - timeRank(a.time))
  return out
}
