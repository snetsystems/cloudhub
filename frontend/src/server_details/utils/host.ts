import {proxy} from 'src/utils/queryUrlGenerator'
import {getDeep} from 'src/utils/wrappers'
import type {Source} from 'src/types'

export interface HostTagSeries {
  columns: string[]
  values: string[][]
}

export async function fetchHostsBySource(
  source: Source
): Promise<{hostname: string}[]> {
  if (!source || !source.links?.proxy) {
    return []
  }
  const {data} = await proxy({
    source: source.links.proxy,
    query: 'show tag values with key = "host"',
    db: source.telegraf,
  })
  const seriesList = getDeep<HostTagSeries[]>(data, 'results.[0].series', [])
  const names = new Set<string>()
  seriesList.forEach(s => {
    const valueIdx = s.columns.findIndex(c => c === 'value')
    if (valueIdx < 0) return
    s.values.forEach(v => {
      const name = v[valueIdx]
      if (typeof name === 'string' && name) {
        names.add(name)
      }
    })
  })
  return Array.from(names)
    .sort()
    .map(hostname => ({hostname}))
}
