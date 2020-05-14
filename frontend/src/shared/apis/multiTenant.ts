import {getDeep} from 'src/utils/wrappers'
import {proxy} from 'src/utils/queryUrlGenerator'
import {Source} from 'src/types'
import {HostNames} from 'src/types/hosts'

interface Series {
  name: string
  columns: string[]
  values: string[]
  tags: {
    host: string
  }
}

export const getAllHosts = async (source: Source): Promise<HostNames> => {
  const {
    telegraf,
    links: {proxy: proxyLink},
  } = source

  try {
    const {data} = await proxy({
      source: proxyLink,
      query: 'SHOW TAG VALUES WITH KEY = "host" WHERE TIME > now() - 10m;',
      db: telegraf,
    })

    const hosts: HostNames = {}
    const allHostsSeries = getDeep<Series[]>(data, 'results[0].series', [])

    allHostsSeries.forEach(s => {
      const hostnameIndex = s.columns.findIndex(col => col === 'value')
      s.values.forEach(v => {
        const hostname = v[hostnameIndex]
        hosts[hostname] = {
          name: hostname,
        }
      })
    })

    return hosts
  } catch (error) {
    console.error(error) // eslint-disable-line no-console
    throw error
  }
}
