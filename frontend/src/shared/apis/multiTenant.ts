import {getDeep} from 'src/utils/wrappers'
import {proxy} from 'src/utils/queryUrlGenerator'
import {Source} from 'src/types'
import {HostNames} from 'src/types/hosts'

// Utils
import replaceTemplate from 'src/tempVars/utils/replace'
import {generateForHosts} from 'src/utils/tempVars'

interface HostsObject {
  [x: string]: Host
}

export interface Host {
  name: string
  deltaUptime?: number
  winDeltaUptime?: number
}

const EmptyHost: Host = {
  name: '',
  deltaUptime: -1,
}

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

export const getAllHostsAndStatus = async (
  source: Source
): Promise<HostsObject> => {
  const {
    telegraf,
    links: {proxy: proxyLink},
  } = source

  const tempVars = generateForHosts(source)

  try {
    const {data} = await proxy({
      source: proxyLink,
      query: replaceTemplate(
        `SHOW TAG VALUES WITH KEY = "host" WHERE TIME > now() - 10m;
              SELECT non_negative_derivative(mean(uptime)) AS deltaUptime FROM \":db:\".\":rp:\".\"system\" WHERE time > now() - 1m0s * 10 GROUP BY host, time(1m0s) fill(0);
              SELECT non_negative_derivative(mean("System_Up_Time")) AS winDeltaUptime FROM \":db:\".\":rp:\".\"win_system\" WHERE time > now() - 1m0s * 10 GROUP BY host, time(1m0s) fill(0);`,
        tempVars
      ),
      db: telegraf,
    })

    const hosts: HostsObject = {}
    const allHostsSeries = getDeep<Series[]>(data, 'results[0].series', [])
    const uptimeSeries = getDeep<Series[]>(data, 'results.[1].series', [])
    const winUptimeSeries = getDeep<Series[]>(data, 'results.[2].series', [])

    allHostsSeries.forEach(s => {
      const hostnameIndex = s.columns.findIndex(col => col === 'value')
      s.values.forEach(v => {
        const hostname = v[hostnameIndex]
        hosts[hostname] = {
          ...EmptyHost,
          name: hostname,
        }
      })
    })

    uptimeSeries.forEach(s => {
      const uptimeIndex = s.columns.findIndex(col => col === 'deltaUptime')
      hosts[s.tags.host].deltaUptime = Number(
        s.values[s.values.length - 1][uptimeIndex]
      )
    })

    winUptimeSeries.forEach(s => {
      const winUptimeIndex = s.columns.findIndex(
        col => col === 'winDeltaUptime'
      )
      hosts[s.tags.host].winDeltaUptime = Number(
        s.values[s.values.length - 1][winUptimeIndex]
      )
    })

    return hosts
  } catch (error) {
    console.error(error) // eslint-disable-line no-console
    throw error
  }
}
