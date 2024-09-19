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
import {CloudServiceProvider, CSPFileWriteParam} from 'src/hosts/types'
import {DashboardSwitcherLinks} from 'src/types/dashboards'

// APIs
import {
  getWheelKeyAcceptedList,
  getLocalVSphereInfoAll,
  getTicketRemoteConsole,
  getIpmiGetPower,
  getIpmiGetSensorData,
  setIpmiSetPower,
  IpmiSetPowerStatus,
  getLocalBotoEc2DescribeInstances,
  getLocalBotoSecgroupGetAllSecurityGroups,
  getLocalBoto2DescribeVolumes,
  getLocalBoto2DescribeInstanceTypes,
  getCSPListInstances,
  getRunnerCloudActionListInstances,
  getCSPRunnerFileWrite,
  getRunnerFileRead,
  setRunnerFileRemove,
} from 'src/shared/apis/saltStack'
import {COLLECTOR_SERVER, DEFAULT_ORGANIZATION} from 'src/shared/constants'
import {SUPERADMIN_ROLE} from 'src/auth/Authorized'
export interface HostsObject {
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
interface CloudSeries extends Series {
  tags: {
    host: string
  }
}
type IpmiSeries = Omit<Series, 'tags'> & {
  tags: {
    hostname: Series['tags']['host']
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

interface CSPInstance {
  PrivateDnsName: string
  InstanceId: string
  InstanceType: string
  State: {Name: string}
  Tags: {[x: string]: any}[]
  Csp?: {id: string; organization: string; provider: string; namespace: string}
}

interface AWSInstances extends CSPInstance {}

interface GCPInstances extends CSPInstance {
  [x: string]: any
  name: string
}

export const getCpuAndLoadForHosts = async (
  proxyLink: string,
  telegrafDB: string,
  telegrafSystemInterval: string,
  tempVars: Template[],
  meRole: string
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
      SELECT max("diskUsed") AS "diskUsed", "path" AS "diskPath" FROM (SELECT last("used_percent") AS "diskUsed" FROM \":db:\".\":rp:\".\"disk\" WHERE time > now() - 10m GROUP BY host, path) GROUP BY host;
      `,
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
    const diskPathIndex = s.columns.findIndex(col => col === 'diskPath')
    hosts[s.tags.host].disk =
      Math.round(Number(s.values[0][meanIndex]) * precision) / precision
    hosts[s.tags.host].extraTag = {diskPath: s.values[0][diskPathIndex]}
  })

  if (
    meRole !== SUPERADMIN_ROLE ||
    (meRole === SUPERADMIN_ROLE &&
      telegrafDB.toLocaleLowerCase() !==
        DEFAULT_ORGANIZATION.toLocaleLowerCase())
  ) {
    const hostsWithoutCollectorServer = _.reduce(
      hosts,
      (acc, host) => {
        if (!_.startsWith(host.name, COLLECTOR_SERVER)) {
          acc = {
            ...acc,
            [host.name]: host,
          }
        }
        return acc
      },
      {}
    )
    return hostsWithoutCollectorServer
  }

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
  telegrafDB: string,
  tempVars: Template[],
  getFrom = 'Agent'
) => {
  const measurements = appLayouts
    .map(m => `\":db:\".\":rp:\".\"${m.measurement}\"`)
    .join(',')
  const measurementsToApps = _.zipObject(
    appLayouts.map(m => m.measurement),
    appLayouts.map(({app}) => app)
  )

  let query = ''
  if (getFrom === 'IPMI') {
    query = `show series from ${measurements} where hostname = '${host}'`
  } else {
    query = `show series from ${measurements} where host = '${host}'`
  }
  const {data} = await proxy({
    source: proxyLink,
    query: replaceTemplate(query, tempVars),
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

export const getAppsForEtc = async (
  proxyLink: string,
  host: string,
  appLayouts: Layout[],
  telegrafDB: string,
  tempVars: Template[]
) => {
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
      `show series from ${measurements} where load_balancer = '${host}' or "host" = '${host}'`,
      tempVars
    ),
    db: telegrafDB,
  })

  const appsForEtc: AppsForHost = {apps: [], tags: {host: null}}

  const allSeries = getDeep<string[][]>(data, 'results.0.series.0.values', [])

  allSeries.forEach(series => {
    const seriesObj = parseSeries(series[0])
    const measurement = seriesObj.measurement

    appsForEtc.apps = _.uniq(
      appsForEtc.apps.concat(measurementsToApps[measurement])
    )
    _.assign(appsForEtc.tags, seriesObj.tags)
  })

  return appsForEtc
}

export const getAppsForInstance = async (
  proxyLink: string,
  instance: object,
  appLayouts: Layout[],
  telegrafDB: string,
  tempVars: Template[],
  getFrom: string
) => {
  const measurements = appLayouts
    .map(m => `\":db:\".\":rp:\".\"${m.measurement}\"`)
    .join(',')
  const measurementsToApps = _.zipObject(
    appLayouts.map(m => m.measurement),
    appLayouts.map(({app}) => app)
  )

  let query = ''

  if (getFrom === 'CloudWatch') {
    query = `show series from ${measurements} where region = '${instance['namespace']}' and instance_id = '${instance['instanceid']}'`
  } else if (getFrom === 'StackDriver') {
    query = `show series from ${measurements} where project_id = '${instance['namespace']}' and instance_id = '${instance['instanceid']}'`
  } else if (getFrom === 'OpenStack') {
    query = `show series from  ${measurements} where "tenant" = '${instance['namespace']}' and "server_id" = '${instance['instanceid']}'  `
  } else {
    query = `show series from ${measurements} where host = '${instance['instancename']}'`
  }

  const {data} = await proxy({
    source: proxyLink,
    query: replaceTemplate(query, tempVars),
    db: telegrafDB,
  })

  const appsForInstance: AppsForHost = {apps: [], tags: {host: null}}

  const allSeries = getDeep<string[][]>(data, 'results.0.series.0.values', [])

  allSeries.forEach(series => {
    const seriesObj = parseSeries(series[0])
    const measurement = seriesObj.measurement

    appsForInstance.apps = _.uniq(
      appsForInstance.apps.concat(measurementsToApps[measurement])
    )

    _.assign(appsForInstance.tags, seriesObj.tags)
  })

  return appsForInstance
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

export const getAppsForInstances = async (
  proxyLink: string,
  providers,
  appLayouts: Layout[],
  telegrafDB: string,
  tempVars: Template[],
  cspProvider: string
): Promise<any> => {
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
      `show series from ${measurements} where time > now() - 10m AND csp != null AND csp = '${cspProvider}'`,
      tempVars
    ),
    db: telegrafDB,
  })

  const newProviders = {...providers}

  const allSeries = getDeep<string[][]>(
    data,
    'results.[0].series.[0].values',
    []
  )

  allSeries.forEach(series => {
    const seriesObj = parseSeries(series[0])
    const measurement = seriesObj.measurement

    const host = getDeep<string>(seriesObj, 'tags.host', '')
    const validationItems = {
      host: host,
    }

    if (!newProviders[host]) {
      return
    }

    const isHasNotOwnProperty = getIsHasNotProperty(
      newProviders,
      validationItems
    )

    if (isHasNotOwnProperty) return

    if (!newProviders[host].apps) {
      newProviders[host].apps = []
    }

    if (!newProviders[host].tags) {
      newProviders[host].tags = {}
    }

    newProviders[host].apps = _.uniq(
      newProviders[host].apps.concat(measurementsToApps[measurement])
    )
    _.assign(newProviders[host].tags, seriesObj.tags)
  })
  return newProviders
}

export const getMeasurementsForHost = async (
  source: Source,
  host: string,
  getFrom = 'Agent'
): Promise<string[]> => {
  let query = ''
  if (getFrom === 'IPMI') {
    query = `SHOW MEASUREMENTS WHERE hostname = '${host}'`
  } else {
    query = `SHOW MEASUREMENTS WHERE host = '${host}'`
  }
  const {data} = await proxy({
    source: source.links.proxy,
    query,
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

export const getMeasurementsForInstance = async (
  source: Source,
  instance: object,
  getFrom: string
): Promise<string[]> => {
  let query = ''

  if (getFrom === 'CloudWatch') {
    query = `SHOW MEASUREMENTS WHERE "region" = '${instance['namespace']}' and "instance_id" = '${instance['instanceid']}'`
  } else if (getFrom === 'StackDriver') {
    query = `SHOW MEASUREMENTS WHERE "project_id" = '${instance['namespace']}' and "instance_id" = '${instance['instanceid']}'`
  } else if (getFrom === 'OpenStack') {
    query = `SHOW MEASUREMENTS WHERE "server_id" = '${instance['instanceid']}' and "tenant" = '${instance['namespace']}'`
  } else {
    query = `SHOW MEASUREMENTS WHERE "host" = '${instance['instancename']}'`
  }

  const {data} = await proxy({
    source: source.links.proxy,
    query: query,
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

export const getMeasurementsForEtc = async (
  source: Source,
  host: string
): Promise<string[]> => {
  const {data} = await proxy({
    source: source.links.proxy,
    query: `SHOW MEASUREMENTS WHERE "load_balancer" = '${host}' or "host" = '${host}'`,
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
  const ident = /[^,]+/
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
): Promise<string[]> => {
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

export const createInventoryTopology = async (
  links: Links,
  cells: string,
  preferences: string[]
) => {
  return await AJAX({
    url: `${_.get(links, 'topologies')}`,
    method: 'POST',
    data: {cells, preferences},
    headers: {'Content-Type': 'text/xml'},
  })
}

export const updateInventoryTopology = async (
  links: Links,
  cellsId: string,
  cells: string,
  preferences: string[]
) => {
  return await AJAX({
    url: `${_.get(links, 'topologies')}/${cellsId}`,
    method: 'PATCH',
    data: {cells, preferences},
    headers: {'Content-Type': 'text/xml'},
  })
}

export const getIpmiStatusSaltApi = async (
  pUrl: string,
  pToken: string,
  pIpmis: IpmiCell
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

export const loadCloudServiceProvidersAPI = async () => {
  try {
    const url = `/cloudhub/v1/csp`
    let {
      data: {CSPs},
    } = await loadCloudServiceProvider(url)
    CSPs = _.map(CSPs, csp => {
      csp = {...csp, provider: csp.provider.toLowerCase()}
      return csp
    })
    return CSPs
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const loadCloudServiceProviderAPI = async (id: string) => {
  try {
    const url = `/cloudhub/v1/csp/${id}`
    const {data} = await loadCloudServiceProvider(url)

    return data
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const createCloudServiceProviderAPI = async ({
  provider,
  namespace,
  accesskey,
  secretkey,
}) => {
  try {
    const {data} = await createCloudServiceProvider({
      provider,
      namespace,
      accesskey,
      secretkey,
    })

    const newData = {
      ...data,
      provider: data.provider.toLowerCase(),
    }

    return newData
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const updateCloudServiceProviderAPI = async (
  params: paramsUpdateCSP
) => {
  try {
    const {data} = await updateCloudServiceProvider(params)

    const newData = {
      ...data,
      provider: data.provider.toLowerCase(),
    }

    return newData
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const deleteCloudServiceProviderAPI = async (id: string) => {
  try {
    const {status, statusText} = await deleteCloudServiceProvider(id)
    return {isDelete: status === 204 && statusText === 'No Content'}
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const loadCloudServiceProvider = async (url: string) => {
  try {
    return await AJAX({
      url,
      method: 'GET',
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export interface paramsCreateCSP {
  provider: CloudServiceProvider
  namespace: string
  accesskey: string
  secretkey: string
}

export const createCloudServiceProvider = async ({
  provider,
  namespace,
  accesskey,
  secretkey,
}: paramsCreateCSP) => {
  try {
    let newProvider: string = provider
    newProvider = newProvider

    return await AJAX({
      url: `/cloudhub/v1/csp`,
      method: 'POST',
      data: {
        provider: newProvider,
        namespace: namespace,
        accesskey,
        secretkey,
      },
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export interface paramsUpdateCSP {
  id: string
  namespace: string
  accesskey: string
  secretkey: string
}

export const updateCloudServiceProvider = async ({
  id,
  namespace,
  accesskey,
  secretkey,
}: paramsUpdateCSP) => {
  try {
    return await AJAX({
      url: `/cloudhub/v1/csp/${id}`,
      method: 'PATCH',
      data: {namespace, accesskey, secretkey},
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const deleteCloudServiceProvider = async (id: string) => {
  try {
    return await AJAX({
      url: `/cloudhub/v1/csp/${id}`,
      method: 'DELETE',
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

const getIsHasNotProperty = (
  providers: {
    host: {
      [key: string]: string
    }
  },
  validationItems: {[key: string]: string}
): boolean => {
  let isNotOwn = false

  const {host} = validationItems
  if (!providers.hasOwnProperty(host)) {
    isNotOwn = true
  }

  return isNotOwn
}

const getAWSInstances = (
  cspHosts: AWSInstances[][][]
): {[Key: string]: object} => {
  let providers = {}
  try {
    _.reduce(
      cspHosts,
      (_before, currents) => {
        _.reduce(
          currents,
          (__before, current) => {
            let rHosts = {}
            _.reduce(
              current,
              (___before, cCurrent) => {
                const instanceName = cCurrent.Tags.find(
                  tag => tag.Key === 'Name'
                )

                rHosts = {
                  ...rHosts,
                  [instanceName.Value]: {
                    name: instanceName.Value,
                    instanceId: cCurrent.InstanceId,
                    instanceType: cCurrent.InstanceType,
                    instanceState: cCurrent.State.Name,
                    csp: {...cCurrent.Csp},
                  },
                }

                providers = {
                  ...providers,
                  ...rHosts,
                }
                return false
              },
              {}
            )
            return false
          },
          {}
        )

        return false
      },
      {}
    )
  } catch (error) {
    console.error(error)
  }
  return providers
}

const getGCPInstances = (
  cspHosts: GCPInstances[][][]
): {[Key: string]: object} => {
  let providers = {}
  try {
    _.map(cspHosts, item => {
      _.reduce(
        item,
        (__before, current) => {
          let rHosts = {}
          _.reduce(
            current,
            (___before, cCurrent) => {
              const instanceName = cCurrent.name
              rHosts = {
                ...rHosts,
                [instanceName]: {
                  name: instanceName,
                  instanceId: cCurrent.id,
                  instanceType: cCurrent.size,
                  instanceState: cCurrent.state,
                  csp: {...cCurrent.Csp},
                },
              }
              providers = {
                ...providers,
                ...rHosts,
              }
              return false
            },
            {}
          )
          return false
        },
        {}
      )
      return false
    })
  } catch (error) {
    console.error(error)
  }
  return providers
}

const getCspAdapter = (cspHosts, cspProvider) => {
  const cspAdapter = {
    aws: {
      getSortedCspData: () => getAWSInstances(cspHosts),
    },
    gcp: {
      getSortedCspData: () => getGCPInstances(cspHosts),
    },
  }
  return cspAdapter[cspProvider]
}

export const getCpuAndLoadForInstances = async (
  proxyLink: string,
  telegrafDB: string,
  tempVars: Template[],
  cspProvider: string,
  cspHosts: CSPInstance[][][]
): Promise<any> => {
  const query = replaceTemplate(
    `SELECT mean("usage_user") FROM \":db:\".\":rp:\".\"cpu\" WHERE "cpu" = 'cpu-total' AND time > now() - 10m AND csp != null AND csp = '${cspProvider}' GROUP BY host;
    SELECT mean("Percent_Processor_Time") FROM \":db:\".\":rp:\".\"win_cpu\" WHERE time > now() - 10m  AND csp != null AND csp = '${cspProvider}'  GROUP BY host;
    SELECT mean("used_percent") AS "memUsed" FROM \":db:\".\":rp:\".\"mem\" WHERE time > now() - 10m AND csp != null AND csp = '${cspProvider}'  GROUP BY host;
    SELECT max("diskUsed") AS "diskUsed" FROM (SELECT last("used_percent") AS "diskUsed" FROM \":db:\".\":rp:\".\"disk\" WHERE time > now() - 10m AND csp != null AND csp = '${cspProvider}' GROUP BY host, path) GROUP BY host;
    SELECT max("winDiskUsed") AS "winDiskUsed" FROM (SELECT 100 - last("Percent_Free_Space") AS "winDiskUsed" FROM \":db:\".\":rp:\".\"win_disk\" WHERE time > now() - 10m AND csp != null AND csp = '${cspProvider}'  GROUP BY host, instance ) group by host;
    `,
    tempVars
  )

  const {data} = await proxy({
    source: proxyLink,
    query,
    db: telegrafDB,
  })
  const csp = getCspAdapter(cspHosts, cspProvider)
  let providers = csp.getSortedCspData()

  const precision = 100
  const cpuSeries = getDeep<CloudSeries[]>(data, 'results.[0].series', [])
  const winCPUSeries = getDeep<CloudSeries[]>(data, 'results.[1].series', [])
  const memUsedSeries = getDeep<CloudSeries[]>(data, 'results.[2].series', [])
  const diskUsedSeries = getDeep<CloudSeries[]>(data, 'results.[3].series', [])
  const winDiskUsedSeries = getDeep<CloudSeries[]>(
    data,
    'results.[4].series',
    []
  )
  cpuSeries.forEach(s => {
    const isHasNotOwnProperty = getIsHasNotProperty(providers, s.tags)

    if (isHasNotOwnProperty) return

    const meanIndex = s.columns.findIndex(col => col === 'mean')
    providers[s.tags.host] = {
      ...providers[s.tags.host],
      cpu: Math.round(Number(s.values[0][meanIndex]) * precision) / precision,
    }
  })

  winCPUSeries.forEach(s => {
    const isHasNotOwnProperty = getIsHasNotProperty(providers, s.tags)

    if (isHasNotOwnProperty) return

    const meanIndex = s.columns.findIndex(col => col === 'mean')
    providers[s.tags.host] = {
      ...providers[s.tags.host],
      cpu: Math.round(Number(s.values[0][meanIndex]) * precision) / precision,
    }
  })

  memUsedSeries.forEach(s => {
    const isHasNotOwnProperty = getIsHasNotProperty(providers, s.tags)

    if (isHasNotOwnProperty) return

    const meanIndex = s.columns.findIndex(col => col === 'memUsed')
    providers[s.tags.host] = {
      ...providers[s.tags.host],
      memory:
        Math.round(Number(s.values[0][meanIndex]) * precision) / precision,
    }
  })

  diskUsedSeries.forEach(s => {
    const isHasNotOwnProperty = getIsHasNotProperty(providers, s.tags)

    if (isHasNotOwnProperty) return

    const meanIndex = s.columns.findIndex(col => col === 'diskUsed')
    providers[s.tags.host] = {
      ...providers[s.tags.host],
      disk: Math.round(Number(s.values[0][meanIndex]) * precision) / precision,
    }
  })

  winDiskUsedSeries.forEach(s => {
    const isHasNotOwnProperty = getIsHasNotProperty(providers, s.tags)

    if (isHasNotOwnProperty) return

    const meanIndex = s.columns.findIndex(col => col === 'winDiskUsed')
    providers[s.tags.host] = {
      ...providers[s.tags.host],
      disk: Math.round(Number(s.values[0][meanIndex]) * precision) / precision,
    }
  })

  return providers
}

export const getCSPListInstancesApi = async (
  pUrl: string,
  pToken: string,
  pCsps: any[]
) => {
  try {
    const info = await getCSPListInstances(pUrl, pToken, pCsps)
    const cspHost = yaml.safeLoad(info.data)

    return cspHost
  } catch (error) {
    throw error
  }
}

export const getAWSInstancesApi = async (
  pUrl: string,
  pToken: string,
  pCsps: any[]
) => {
  try {
    const info = await getLocalBotoEc2DescribeInstances(pUrl, pToken, pCsps)
    const cspHost = yaml.safeLoad(info.data)

    return cspHost
  } catch (error) {
    throw error
  }
}

export const getGCPInstancesApi = async (
  pUrl: string,
  pToken: string,
  pCsps: any[]
) => {
  try {
    const info = await getRunnerCloudActionListInstances(pUrl, pToken, pCsps)
    const cspHost = yaml.safeLoad(info.data)

    return cspHost
  } catch (error) {
    throw error
  }
}

export const getAWSSecurityApi = async (
  pUrl: string,
  pToken: string,
  pCsps: any[],
  pGroupIds?: string[]
) => {
  try {
    const info = await getLocalBotoSecgroupGetAllSecurityGroups(
      pUrl,
      pToken,
      pCsps,
      pGroupIds
    )
    const cspHost = yaml.safeLoad(info.data)

    return cspHost
  } catch (error) {
    throw error
  }
}

export const getAWSVolumeApi = async (
  pUrl: string,
  pToken: string,
  pCsps: any[],
  pGroupIds?: string[]
) => {
  try {
    const info = await getLocalBoto2DescribeVolumes(
      pUrl,
      pToken,
      pCsps,
      pGroupIds
    )
    const cspHost = yaml.safeLoad(info.data)

    return cspHost
  } catch (error) {
    throw error
  }
}

export const getAWSInstanceTypesApi = async (
  pUrl: string,
  pToken: string,
  pCsps: any[],
  pTypes?: string[]
) => {
  try {
    const info = await getLocalBoto2DescribeInstanceTypes(
      pUrl,
      pToken,
      pCsps,
      pTypes
    )
    const cspHost = yaml.safeLoad(info.data)

    return cspHost
  } catch (error) {
    throw error
  }
}

export const getGCPInstanceTypesApi = async (
  pUrl: string,
  pToken: string,
  pCsps: any[],
  pTypes?: string[]
) => {
  try {
    const info = await getLocalBoto2DescribeInstanceTypes(
      pUrl,
      pToken,
      pCsps,
      pTypes
    )
    const cspHost = yaml.safeLoad(info.data)

    return cspHost
  } catch (error) {
    throw error
  }
}

export const fileWriteConfigApi = async (
  pUrl: string,
  pToken: string,
  pFileWrite: CSPFileWriteParam
) => {
  try {
    const info = await getCSPRunnerFileWrite(pUrl, pToken, pFileWrite)

    return info
  } catch (error) {
    throw error
  }
}

export const fileWriteKeyApi = async (
  pUrl: string,
  pToken: string,
  pFileWrite: CSPFileWriteParam
) => {
  try {
    const info = await getCSPRunnerFileWrite(pUrl, pToken, pFileWrite)

    return info
  } catch (error) {
    throw error
  }
}

export const getRunnerFileReadApi = async (
  pUrl: string,
  pToken: string,
  pFilePath: string[]
) => {
  try {
    const info = await getRunnerFileRead(pUrl, pToken, pFilePath)

    const fileRead = yaml.safeLoad(info.data)

    return fileRead
  } catch (error) {
    throw error
  }
}

export const setRunnerFileRemoveApi = async (
  pUrl: string,
  pToken: string,
  pFilePath: string[]
) => {
  try {
    const info = await setRunnerFileRemove(pUrl, pToken, pFilePath)

    const fileRemove = yaml.safeLoad(info.data)

    return fileRemove
  } catch (error) {
    throw error
  }
}

export const getHostsInfoWithIpmi = async (
  proxyLink: string,
  telegrafDB: string,
  tempVars: Template[],
  meRole: string
): Promise<HostsObject> => {
  const query = replaceTemplate(
    `SELECT mean("value") AS "ipmiCpu" FROM \":db:\".\":rp:\".\"ipmi_sensor\" WHERE "name" = 'cpu_usage' AND "hostname" != '' AND time > now() - 10m GROUP BY hostname fill(null);
     SELECT mean("value") AS "ipmiMemory" FROM \":db:\".\":rp:\".\"ipmi_sensor\" WHERE "name" = 'mem_usage' AND "hostname" != '' AND time > now() - 10m GROUP BY hostname;
     SHOW TAG VALUES FROM \":db:\".\":rp:\".\"ipmi_sensor\" WITH KEY = "hostname" WHERE TIME > now() - 10m AND "hostname" != '';
     SELECT max("inlet") AS "inlet" FROM ( SELECT last("value") AS "inlet" FROM \":db:\".\":rp:\".\"ipmi_sensor\" WHERE "hostname" != '' AND time > now() - 10m AND ("name" = 'inlet_temp' OR "name" = 'mb_cpu_in_temp' OR "name" = 'temp_mb_inlet') GROUP BY hostname ) GROUP BY hostname;
     SELECT max("inside") AS "inside", "name" as "cpu_count" FROM ( SELECT last("value") AS "inside"  FROM \":db:\".\":rp:\".\"ipmi_sensor\" WHERE "hostname" != '' AND time > now() - 10m AND ("name" =~ ${new RegExp(
       /cpu_temp|cpu\d+_temp|cpu_temp_\d+|cpu_dimmg\d+_temp|temp_cpu\d+/
     )}) GROUP BY hostname, "name" ) GROUP BY hostname;
     SELECT max("outlet") AS "outlet" FROM ( SELECT last("value") AS "outlet" FROM \":db:\".\":rp:\".\"ipmi_sensor\" WHERE "hostname" != '' AND time > now() - 10m AND ("name" =~ ${new RegExp(
       /system_temp|exhaust_temp|outlet_temp|mb_cpu_out_temp|temp_mb_outlet/
     )}) GROUP BY hostname ) GROUP BY hostname;
     SELECT last(value) as "ipmi_ip" FROM \":db:\".\":rp:\".\"ipmi_sensor\" WHERE time > now() - 10m GROUP BY  "hostname", "server" FILL(null);
     SELECT mean("value") AS "powerStatus" FROM \":db:\".\":rp:\".\"ipmi_sensor\" WHERE "name" = 'chassis_power_status' AND "hostname" != '' AND time > now() - 10m GROUP BY hostname, server fill(null);
     `,
    tempVars
  )

  const {data} = await proxy({
    source: proxyLink,
    query,
    db: telegrafDB,
  })

  const hosts: HostsObject = {}
  const precision = 100
  const ipmiCpuSeries = getDeep<IpmiSeries[]>(data, 'results.[0].series', [])
  const ipmiMemorySeries = getDeep<IpmiSeries[]>(data, 'results.[1].series', [])
  const allHostsSeries = getDeep<IpmiSeries[]>(data, 'results.[2].series', [])
  const ipmiInletSeries = getDeep<IpmiSeries[]>(data, 'results.[3].series', [])
  const ipmiInsideSeries = getDeep<IpmiSeries[]>(data, 'results.[4].series', [])
  const ipmiOutletSeries = getDeep<IpmiSeries[]>(data, 'results.[5].series', [])
  const ipmiHostsAndIp = getDeep<IpmiSeries[]>(data, 'results.[6].series', [])
  const ipmiPowerStatus = getDeep<IpmiSeries[]>(data, 'results.[7].series', [])

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

  ipmiCpuSeries.forEach(s => {
    const meanIndex = s.columns.findIndex(col => col === 'ipmiCpu')
    if (meanIndex !== -1) {
      hosts[s.tags.hostname] = {
        ...EmptyHost,
        name: s.tags.hostname,
        ipmiCpu:
          Math.round(Number(s.values[0][meanIndex]) * precision) / precision,
      }
    }
  })

  ipmiMemorySeries.forEach(s => {
    const meanIndex = s.columns.findIndex(col => col === 'ipmiMemory')
    if (meanIndex !== -1) {
      hosts[s.tags.hostname].ipmiMemory =
        Math.round(Number(s.values[0][meanIndex]) * precision) / precision
    }
  })
  ipmiInsideSeries.forEach(s => {
    const meanIndex = s.columns.findIndex(col => col === 'inside')
    const cpuCountIndex = s.columns.findIndex(col => col === 'cpu_count')
    if (meanIndex !== -1) {
      hosts[s.tags.hostname].inside = Number(s.values[0][meanIndex])
    }

    if (meanIndex !== -1) {
      const foundNumber =
        cpuCountIndex !== -1
          ? (s.values[0][cpuCountIndex]?.match(/\d/) || [])[0] || 0
          : 0
      hosts[s.tags.hostname].extraTag = {cpuCount: foundNumber}
    }
  })

  ipmiInletSeries.forEach(s => {
    const meanIndex = s.columns.findIndex(col => col === 'inlet')
    if (meanIndex !== -1) {
      hosts[s.tags.hostname].inlet = Number(s.values[0][meanIndex])
    }
  })
  ipmiOutletSeries.forEach(s => {
    const meanIndex = s.columns.findIndex(col => col === 'outlet')
    if (meanIndex !== -1) {
      hosts[s.tags.hostname].outlet = Number(s.values[0][meanIndex])
    }
  })
  ipmiHostsAndIp.forEach(s => {
    if (hosts.hasOwnProperty(s.tags.hostname)) {
      hosts[s.tags.hostname].extraTag = {
        ...hosts[s.tags.hostname].extraTag,
        ipmi_ip: s.tags['server'],
      }
    }
  })
  ipmiPowerStatus.forEach(s => {
    const meanIndex = s.columns.findIndex(col => col === 'powerStatus')
    if (meanIndex !== -1) {
      hosts[s.tags.hostname].powerStatus =
        Number(s.values[0][meanIndex]) === 1 ? 'on' : 'off'
    }
  })

  if (
    meRole !== SUPERADMIN_ROLE ||
    (meRole === SUPERADMIN_ROLE &&
      telegrafDB.toLocaleLowerCase() !==
        DEFAULT_ORGANIZATION.toLocaleLowerCase())
  ) {
    const hostsWithoutCollectorServer = _.reduce(
      hosts,
      (acc, host) => {
        if (!_.startsWith(host.name, COLLECTOR_SERVER)) {
          acc = {
            ...acc,
            [host.name]: host,
          }
        }
        return acc
      },
      {}
    )
    return hostsWithoutCollectorServer
  }

  return hosts
}
