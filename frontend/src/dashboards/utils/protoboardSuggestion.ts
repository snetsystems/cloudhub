// Libraries
import _ from 'lodash'
// Utils
import {proxy} from 'src/utils/queryUrlGenerator'
import replaceTemplate from 'src/tempVars/utils/replace'
// Types
import {Source, Protoboard, Template} from 'src/types'

// Constants
import {COLLECTOR_SERVER} from 'src/shared/constants'

interface SeriesObject {
  measurement: string
  host: string
}

interface ParseMeasurementResponse {
  workingString: string
  measurement: string
}

interface ParseHostResponse {
  workingString: string
  host: string
}

interface Hosts {
  [x: string]: {apps: string[]}
}

interface HostsSeries {
  name: string
  columns: string[]
  values: string[][]
}

export const getSuggestedProtoboards = async (
  source: Source,
  protoboards: Protoboard[],
  tempVars: Template[]
): Promise<string[]> => {
  const hosts = await getHosts(source)

  if (!hosts) {
    return []
  }

  const newHosts = await addAppsToHosts(source, hosts, protoboards, tempVars)

  const suggestedProtoboards = _.reduce(
    newHosts,
    (acc: string[], host) => {
      if (host.apps && host.apps.length) {
        return _.union(acc, host.apps)
      }
      return acc
    },
    []
  )

  return suggestedProtoboards
}

export const addAppsToHosts = async (
  source: Source,
  hosts: Hosts,
  protoboards: Protoboard[],
  tempVars: Template[]
) => {
  const measurementsList: string[] = []
  const measurementsToProtoboards = {}

  _.forEach(protoboards, pb => {
    _.forEach(pb.meta.measurements, m => {
      measurementsToProtoboards[m] = pb.meta.name
      measurementsList.push(m)
    })
  })

  const joinedMeasurements = measurementsList
    .map(m => `\":db:\".\":rp:\".\"${m}\"`)
    .join(',')

  const newHosts = {...hosts}

  const allSeries = await getAllSeries(source, joinedMeasurements, tempVars)

  allSeries.forEach(series => {
    const {measurement, host} = parseSeries(series)
    if (!newHosts[host]) {
      return
    }

    const existingApps = newHosts[host].apps || []

    newHosts[host].apps = _.uniq([
      ...existingApps,
      measurementsToProtoboards[measurement],
    ])
  })

  return newHosts
}

export const getHosts = async (source: Source): Promise<Hosts> => {
  const hosts = {}

  const query = `SHOW TAG VALUES WITH KEY = "host" WHERE TIME > now() - 10m and "host" !~ /^${COLLECTOR_SERVER}/;`

  const resp = await proxy({
    source: source.links.proxy,
    query,
    db: source.telegraf,
  })

  const allHostsSeries: HostsSeries[] = _.get(
    resp,
    ['data', 'results', '0', 'series'],
    []
  )
  allHostsSeries.forEach(s => {
    const hostnameIndex = s.columns.findIndex(col => col === 'value')
    s.values.forEach(v => {
      const hostname = v[hostnameIndex]
      hosts[hostname] = {}
    })
  })

  return hosts
}

const getAllSeries = async (
  source: Source,
  joinedMeasurements: string,
  tempVars: Template[]
): Promise<string[]> => {
  const resp = await proxy({
    source: source.links.proxy,
    query: replaceTemplate(
      `show series from ${joinedMeasurements} where time > now() - 10m`,
      tempVars
    ),
    db: source.telegraf,
  })

  const allSeries: string[] = _.flatten(
    _.get(resp, ['data', 'results', '0', 'series', '0', 'values'], [])
  )
  return allSeries
}

const parseSeries = (series: string): SeriesObject => {
  let workingString = series.slice()

  const parseMeasurementResult = parseMeasurement(workingString)
  workingString = parseMeasurementResult.workingString
  const measurement = parseMeasurementResult.measurement

  let host = ''
  while (workingString.length) {
    const parseHostResult = parseHost(workingString)
    workingString = parseHostResult.workingString
    if (parseHostResult.host) {
      host = parseHostResult.host
    }
  }

  return {measurement, host}
}

const parseMeasurement = (s: string): ParseMeasurementResponse => {
  const word = /[^,]+/
  const match = word.exec(s)
  const measurement = match[0]

  const workingString = s.slice(match.index + measurement.length)

  return {workingString, measurement}
}

const parseHost = (s: string): ParseHostResponse => {
  const tag = /,?([^=]+)=([^,]+)/
  const match = tag.exec(s)

  let host = ''
  let workingString = ''

  if (match) {
    const kv = match[0]
    const key = match[1]
    const value = match[2]

    if (key === 'host') {
      host = value
    }

    workingString = s.slice(match.index + kv.length)
  }

  return {workingString, host}
}
