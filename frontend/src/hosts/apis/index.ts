import _ from 'lodash'
import {AxiosResponse} from 'axios'
import yaml from 'js-yaml'
import {getDeep} from 'src/utils/wrappers'

import {proxy} from 'src/utils/queryUrlGenerator'
import replaceTemplate from 'src/tempVars/utils/replace'
import AJAX from 'src/utils/ajax'
import {
  linksFromHosts,
  updateActiveHostLink,
} from 'src/hosts/utils/hostsSwitcherLinks'
// Types
import {Template, Layout, Source, Host, Links} from 'src/types'
import {HostNames, HostName, Ipmi, IpmiCell} from 'src/types/hosts'
import {DashboardSwitcherLinks} from '../../types/dashboards'

// APIs
import {
  getWheelKeyAcceptedList,
  getLocalVSphereInfoAll,
  getTicketRemoteConsole,
  getIpmiGetPower,
  getIpmiGetSensorData,
  setIpmiSetPower,
  IpmiSetPowerStatus,
} from 'src/shared/apis/saltStack'
import {Provider} from 'src/hosts/types'

interface HostsObject {
  [x: string]: Host
}

const EmptyHost: Host = {
  name: '',
  cpu: 0.0,
  load: 0.0,
  deltaUptime: -1,
  apps: [],
}

interface Series {
  name: string
  columns: string[]
  values: string[]
  tags: {
    host: string
  }
}
interface SeriesObj {
  measurement: string
  tags: {host: string}
}

interface AppsForHost {
  apps: string[]
  tags: {host: string}
}

export const getCpuAndLoadForHosts = async (
  proxyLink: string,
  telegrafDB: string,
  telegrafSystemInterval: string,
  tempVars: Template[]
): Promise<HostsObject> => {
  const query = replaceTemplate(
    `SELECT mean("usage_user") FROM \":db:\".\":rp:\".\"cpu\" WHERE "cpu" = 'cpu-total' AND time > now() - 10m GROUP BY host;
      SELECT mean("load1") FROM \":db:\".\":rp:\".\"system\" WHERE time > now() - 10m GROUP BY host;
      SELECT non_negative_derivative(mean(uptime)) AS deltaUptime FROM \":db:\".\":rp:\".\"system\" WHERE time > now() - ${telegrafSystemInterval} * 10 GROUP BY host, time(${telegrafSystemInterval}) fill(0);
      SELECT mean("Percent_Processor_Time") FROM \":db:\".\":rp:\".\"win_cpu\" WHERE time > now() - 10m GROUP BY host;
      SELECT mean("Processor_Queue_Length") FROM \":db:\".\":rp:\".\"win_system\" WHERE time > now() - 10s GROUP BY host;
      SELECT non_negative_derivative(mean("System_Up_Time")) AS winDeltaUptime FROM \":db:\".\":rp:\".\"win_system\" WHERE time > now() - ${telegrafSystemInterval} * 10 GROUP BY host, time(${telegrafSystemInterval}) fill(0);
      SHOW TAG VALUES WITH KEY = "host" WHERE TIME > now() - 10m;
      SELECT mean("used_percent") AS "memUsed" FROM \":db:\".\":rp:\".\"mem\" WHERE time > now() - 10m GROUP BY host;
      SELECT mean("used_percent") AS "diskUsed" FROM \":db:\".\":rp:\".\"disk\" WHERE time > now() - 10m GROUP BY host;`,
    tempVars
  )

  const {data} = await proxy({
    source: proxyLink,
    query,
    db: telegrafDB,
  })

  const hosts: HostsObject = {}
  const precision = 100
  const cpuSeries = getDeep<Series[]>(data, 'results.[0].series', [])
  const loadSeries = getDeep<Series[]>(data, 'results.[1].series', [])
  const uptimeSeries = getDeep<Series[]>(data, 'results.[2].series', [])
  const winCPUSeries = getDeep<Series[]>(data, 'results.[3].series', [])
  const winLoadSeries = getDeep<Series[]>(data, 'results.[4].series', [])
  const winUptimeSeries = getDeep<Series[]>(data, 'results.[5].series', [])
  const allHostsSeries = getDeep<Series[]>(data, 'results.[6].series', [])
  const memUsedSeries = getDeep<Series[]>(data, 'results.[7].series', [])
  const diskUsadSeries = getDeep<Series[]>(data, 'results.[8].series', [])

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

  cpuSeries.forEach(s => {
    const meanIndex = s.columns.findIndex(col => col === 'mean')
    hosts[s.tags.host] = {
      ...EmptyHost,
      name: s.tags.host,
      cpu: Math.round(Number(s.values[0][meanIndex]) * precision) / precision,
    }
  })

  loadSeries.forEach(s => {
    const meanIndex = s.columns.findIndex(col => col === 'mean')
    hosts[s.tags.host].load =
      Math.round(Number(s.values[0][meanIndex]) * precision) / precision
  })

  uptimeSeries.forEach(s => {
    const uptimeIndex = s.columns.findIndex(col => col === 'deltaUptime')
    hosts[s.tags.host].deltaUptime = Number(
      s.values[s.values.length - 1][uptimeIndex]
    )
  })

  winCPUSeries.forEach(s => {
    const meanIndex = s.columns.findIndex(col => col === 'mean')
    hosts[s.tags.host] = {
      name: s.tags.host,
      cpu: Math.round(Number(s.values[0][meanIndex]) * precision) / precision,
    }
  })

  winLoadSeries.forEach(s => {
    const meanIndex = s.columns.findIndex(col => col === 'mean')
    hosts[s.tags.host].load =
      Math.round(Number(s.values[0][meanIndex]) * precision) / precision
  })

  winUptimeSeries.forEach(s => {
    const winUptimeIndex = s.columns.findIndex(col => col === 'winDeltaUptime')
    hosts[s.tags.host].winDeltaUptime = Number(
      s.values[s.values.length - 1][winUptimeIndex]
    )
  })

  memUsedSeries.forEach(s => {
    const meanIndex = s.columns.findIndex(col => col === 'memUsed')
    hosts[s.tags.host].memory =
      Math.round(Number(s.values[0][meanIndex]) * precision) / precision
  })

  diskUsadSeries.forEach(s => {
    const meanIndex = s.columns.findIndex(col => col === 'diskUsed')
    hosts[s.tags.host].disk =
      Math.round(Number(s.values[0][meanIndex]) * precision) / precision
  })

  return hosts
}

const getAllHosts = async (source: Source): Promise<HostNames> => {
  const {
    telegraf,
    links: {proxy: proxyLink},
  } = source

  try {
    const {data} = await proxy({
      source: proxyLink,
      query: 'show tag values with key = "host"',
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

export const loadHostsLinks = async (
  source: Source,
  activeHost: HostName
): Promise<DashboardSwitcherLinks> => {
  const hostNames = await getAllHosts(source)
  return loadHostsLinksFromNames(source, activeHost, hostNames)
}

export const loadHostsLinksFromNames = async (
  source: Source,
  activeHost: HostName,
  hostNames: HostNames
): Promise<DashboardSwitcherLinks> => {
  const allLinks = linksFromHosts(hostNames, source)

  return updateActiveHostLink(allLinks, activeHost)
}

interface LayoutsResponse {
  layouts: Layout[]
}

export const getLayouts = () =>
  AJAX({
    method: 'GET',
    resource: 'layouts',
  }) as Promise<AxiosResponse<LayoutsResponse>>

export const getAppsForHost = async (
  proxyLink: string,
  host: string,
  appLayouts: Layout[],
  telegrafDB: string
) => {
  const measurements = appLayouts.map(m => `^${m.measurement}$`).join('|')
  const measurementsToApps = _.zipObject(
    appLayouts.map(m => m.measurement),
    appLayouts.map(({app}) => app)
  )

  const {data} = await proxy({
    source: proxyLink,
    query: `show series from /${measurements}/ where host = '${host}'`,
    db: telegrafDB,
  })

  const appsForHost: AppsForHost = {apps: [], tags: {host: null}}

  const allSeries = getDeep<string[][]>(data, 'results.0.series.0.values', [])

  allSeries.forEach(series => {
    const seriesObj = parseSeries(series[0])
    const measurement = seriesObj.measurement

    appsForHost.apps = _.uniq(
      appsForHost.apps.concat(measurementsToApps[measurement])
    )
    _.assign(appsForHost.tags, seriesObj.tags)
  })
  return appsForHost
}

export const getAppsForHosts = async (
  proxyLink: string,
  hosts: HostsObject,
  appLayouts: Layout[],
  telegrafDB: string,
  tempVars: Template[]
): Promise<HostsObject> => {
  const measurements = appLayouts
    .map(m => `\":db:\".\":rp:\".\"${m.measurement}\"`)
    .join(',')
  const measurementsToApps = _.zipObject(
    appLayouts.map(m => m.measurement),
    appLayouts.map(({app}) => app)
  )
  const {data} = await proxy({
    source: proxyLink,
    query: replaceTemplate(
      `show series from ${measurements} where time > now() - 10m`,
      tempVars
    ),
    db: telegrafDB,
  })
  const newHosts = {...hosts}
  const allSeries = getDeep<string[][]>(
    data,
    'results.[0].series.[0].values',
    []
  )
  allSeries.forEach(series => {
    const seriesObj = parseSeries(series[0])
    const measurement = seriesObj.measurement
    const host = getDeep<string>(seriesObj, 'tags.host', '')
    if (!newHosts[host]) {
      return
    }
    if (!newHosts[host].apps) {
      newHosts[host].apps = []
    }
    if (!newHosts[host].tags) {
      newHosts[host].tags = {}
    }
    newHosts[host].apps = _.uniq(
      newHosts[host].apps.concat(measurementsToApps[measurement])
    )
    _.assign(newHosts[host].tags, seriesObj.tags)
  })
  return newHosts
}

export const getMeasurementsForHost = async (
  source: Source,
  host: string
): Promise<string[]> => {
  const {data} = await proxy({
    source: source.links.proxy,
    query: `SHOW MEASUREMENTS WHERE "host" = '${host}'`,
    db: source.telegraf,
  })

  if (isEmpty(data) || hasError(data)) {
    return []
  }

  const values = getDeep<string[][]>(data, 'results.[0].series.[0].values', [])
  const measurements = values.map(m => {
    return m[0]
  })
  return measurements
}

const parseSeries = (seriesString: string): SeriesObj => {
  const ident = /\w+/
  const tag = /,?([^=]+)=([^,]+)/

  const parseMeasurement = (s, obj) => {
    const match = ident.exec(s)
    const measurement = match[0]
    if (measurement) {
      obj.measurement = measurement
    }
    return s.slice(match.index + measurement.length)
  }

  const parseTag = (s, obj) => {
    const match = tag.exec(s)

    if (match) {
      const kv = match[0]
      const key = match[1]
      const value = match[2]

      if (key) {
        if (!obj.tags) {
          obj.tags = {}
        }
        obj.tags[key] = value
      }
      return s.slice(match.index + kv.length)
    }

    return ''
  }

  let workStr = seriesString.slice()
  const out: SeriesObj = {
    measurement: null,
    tags: {host: null},
  }

  // Consume measurement
  workStr = parseMeasurement(workStr, out)

  // Consume tags
  while (workStr.length > 0) {
    workStr = parseTag(workStr, out)
  }

  return out
}

const isEmpty = (resp): boolean => {
  return !resp.results[0].series
}

const hasError = (resp): boolean => {
  return !!resp.results[0].error
}

export const getMinionKeyAcceptedList = async (
  pUrl: string,
  pToken: string
): Promise<String[]> => {
  const info = await Promise.all([getWheelKeyAcceptedList(pUrl, pToken)])
  const minions = _.get(
    yaml.safeLoad(info[0].data),
    'return[0].data.return.minions',
    []
  )

  return minions
}

export const getVSphereInfoSaltApi = async (
  pUrl: string,
  pToken: string,
  tgt: string,
  address: string,
  user: string,
  password: string,
  port: string,
  protocol: string
): Promise<any> => {
  const info = await Promise.all([
    getLocalVSphereInfoAll(
      pUrl,
      pToken,
      tgt,
      address,
      user,
      password,
      port,
      protocol
    ),
  ])

  const vSphere = yaml.safeLoad(info[0].data)
  return vSphere
}

export const getTicketRemoteConsoleApi = async (
  pUrl: string,
  pToken: string,
  tgt: string,
  address: string,
  user: string,
  password: string
): Promise<String[]> => {
  const info = await Promise.all([
    getTicketRemoteConsole(pUrl, pToken, tgt, address, user, password),
  ])
  const ticket = yaml.safeLoad(info[0].data)
  return ticket
}

const calcInterval = (interval: string) => {
  if (interval.indexOf('s') > -1) {
    return parseInt(interval) * 1000
  }
  if (interval.indexOf('m') > -1) {
    return parseInt(interval) * (1000 * 60)
  }
}

export const getVSpheresApi = async () => {
  let data
  try {
    const {
      data: {vspheres},
    }: AxiosResponse<any> = await AJAX({
      url: '/cloudhub/v1/vspheres',
      method: 'GET',
    })

    data = {...vspheres}
    return data
  } catch (error) {}
  return
}

export const getVSphereApi = async (id: number) => {
  let info = await AJAX({
    url: `/cloudhub/v1/vspheres/${id}`,
    method: 'GET',
  })
  const vSphere = _.get(info, 'data', [])
  return vSphere
}

export const addVSphereApi = async (
  tgt: string,
  address: string,
  user: string,
  password: string,
  port: string,
  protocol: string,
  interval: string,
  sourceID: string
) => {
  return await AJAX({
    url: '/cloudhub/v1/vspheres',
    method: 'POST',
    data: {
      host: address,
      username: user,
      password,
      protocol,
      port: parseInt(port),
      interval: calcInterval(interval),
      datasource: sourceID,
      minion: tgt,
    },
  })
}

export const updateVSphereApi = async ({
  id,
  tgt,
  address,
  user,
  password,
  port,
  protocol,
  interval,
  sourceID,
}: {
  id: number
  tgt: string
  address: string
  user: string
  password: string
  port: string
  protocol: string
  interval: string
  sourceID: string
}) => {
  let data = {}
  if (tgt) {
    data = {...data, minion: tgt}
  }

  if (address) {
    data = {...data, host: address}
  }

  if (user) {
    data = {...data, username: user}
  }

  if (password) {
    data = {...data, password}
  }

  if (port) {
    data = {...data, port: parseInt(port)}
  }

  if (protocol) {
    data = {...data, protocol}
  }

  if (interval) {
    data = {...data, interval: calcInterval(interval)}
  }

  if (sourceID) {
    data = {...data, datasource: sourceID}
  }

  return await AJAX({
    url: `/cloudhub/v1/vspheres/${id}`,
    method: 'PATCH',
    data,
  })
}

export const deleteVSphereApi = async (id: number) => {
  return await AJAX({
    url: `/cloudhub/v1/vspheres/${id}`,
    method: 'DELETE',
  })
}

export const loadInventoryTopology = async (links: Links) => {
  try {
    const info = await AJAX({
      url: `${_.get(links, 'topologies')}`,
      method: 'GET',
    })

    const result = _.get(info, 'data', [])

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const createInventoryTopology = async (links: Links, cells: string) => {
  return await AJAX({
    url: `${_.get(links, 'topologies')}`,
    method: 'POST',
    data: cells,
    headers: {'Content-Type': 'text/xml'},
  })
}

export const updateInventoryTopology = async (
  links: Links,
  cellsId: string,
  cells: string
) => {
  return await AJAX({
    url: `${_.get(links, 'topologies')}/${cellsId}`,
    method: 'PATCH',
    data: cells,
    headers: {'Content-Type': 'text/xml'},
  })
}

export const getIpmiStatusSaltApi = async (
  pUrl: string,
  pToken: string,
  pIpmis: IpmiCell[]
): Promise<any> => {
  const info = await getIpmiGetPower(pUrl, pToken, pIpmis)
  const ipmiStatus = yaml.safeLoad(info.data)

  return ipmiStatus
}

export const getIpmiGetSensorDataApi = async (
  pUrl: string,
  pToken: string,
  pIpmi: Ipmi
): Promise<any> => {
  const getSensorData = await getIpmiGetSensorData(pUrl, pToken, pIpmi)
  const sensorData = yaml.safeLoad(getSensorData.data)

  return sensorData
}

export const setIpmiSetPowerApi = async (
  pUrl: string,
  pToken: string,
  pIpmi: Ipmi,
  pState: IpmiSetPowerStatus
): Promise<any> => {
  const responseSetPower = await setIpmiSetPower(pUrl, pToken, pIpmi, pState)
  const setPower = yaml.safeLoad(responseSetPower.data)

  return setPower
}

export const getCSP = async (id?: string) => {
  let url = '/cloudhub/v1/csp'

  if (id) {
    url += `/${id}`
  }

  return await AJAX({
    url,
    method: 'GET',
  })
}

export const addCSP = async ({
  provider,
  region,
  accesskey,
  secretkey,
}: {
  provider: Provider
  region: string
  accesskey: string
  secretkey: string
}) => {
  // return await AJAX({
  //   url: `/cloudhub/v1/csp`,
  //   method: 'POST',
  //   data: {provider, region, accsesskey, secretkey},
  // })
  return {
    id: '1',
    provider: provider,
    region: region,
    accesskey: accesskey,
    secretkey: secretkey,
    organization: '2',
    links: {
      self: '/cloudhub/v1/csp/1',
    },
  }
}

export const updateCSP = async ({
  id,
  provider,
  region,
  accsesskey,
  secretkey,
}) => {
  // return await AJAX({
  //   url: `/cloudhub/v1/csp`,
  //   method: 'PATCH',
  //   data: {id, provider, region, accsesskey, secretkey},
  // })

  return {
    id,
    provider,
    region,
    accsesskey,
    secretkey,
  }
}

export const deleteCSP = async (id: string) => {
  return await AJAX({
    url: `/cloudhub/v1/csp/${id}`,
    method: 'DELETE',
  })
}
