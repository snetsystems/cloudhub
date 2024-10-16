import _ from 'lodash'
import moment from 'moment'

import {
  DeviceData,
  DeviceDataMonitoringStatus,
  Organization,
  SeriesObj,
  DevicesOrgData,
  DropdownItem,
  Source,
  DeviceOrganizationStatus,
  HostState,
  TimeZones,
  AlertHostList,
} from 'src/types'
import {OrganizationID, PredictionTooltipNode} from 'src/types/deviceManagement'
import {MLFunctionMsg} from 'src/device_management/constants'

export const hasMonitoringDevice = (
  devicesData: DeviceDataMonitoringStatus[]
): boolean => {
  return devicesData.some(device => device.isMonitoring === true)
}

export const convertDeviceDataOrganizationNameToID = (
  devicesData: DeviceData | DeviceData[],
  organizations: Organization[]
): DeviceData | DeviceData[] => {
  const mapOrganization = (deviceData: DeviceData): DeviceData => {
    const organization = organizations
      ? organizations.find(org => org.name === deviceData.organization)
      : null
    return {
      ...deviceData,
      organization: organization ? organization.id : '',
    }
  }

  if (Array.isArray(devicesData)) {
    return devicesData.map(mapOrganization)
  } else {
    return mapOrganization(devicesData)
  }
}

export const convertDeviceDataOrganizationIDToName = (
  devicesData: DeviceData | DeviceData[],
  organizations: Organization[]
): DeviceData | DeviceData[] => {
  const mapOrganization = (deviceData: DeviceData): DeviceData => {
    const organization = organizations
      ? organizations.find(org => org.id === deviceData.organization)
      : null
    return {
      ...deviceData,
      organization: organization ? organization.name : '',
    }
  }

  if (Array.isArray(devicesData)) {
    return devicesData.map(mapOrganization)
  } else {
    return mapOrganization(devicesData)
  }
}

export const selectedArrayById = (
  array: any[],
  checkedArray: string[],
  key: string
) => {
  const validArray = array.filter(
    i => checkedArray.includes(`${i[key]}`)
    //create monitoring sql is_modeling_generated=> is_monitoring
  )

  return validArray
}

export const getOrganizationIdByName = (
  organizations: Organization[],
  organizationName: string
): string | '' => {
  const organization = organizations.find(org => org.name === organizationName)
  return organization ? organization.id : ''
}

export const getOrganizationNameByID = (
  organizations: Organization[],
  organizationID: string
): string | '' => {
  const organization = organizations.find(org => org.id === organizationID)
  return organization ? organization.name : ''
}

export const formatMLKey = (
  mlFunctionKey: keyof typeof MLFunctionMsg
): typeof MLFunctionMsg[keyof typeof MLFunctionMsg] => {
  if (!mlFunctionKey || !MLFunctionMsg.hasOwnProperty(mlFunctionKey)) {
    return MLFunctionMsg.ml_gaussian_std
  }

  return MLFunctionMsg[mlFunctionKey]
}

export const parseSeries = (seriesString: string): SeriesObj => {
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

export const decimalUnitNumber = (value: string, unit: string) => {
  const length = Number(value).toFixed().length
  const kUnit =
    length >= 13
      ? 'T'
      : length >= 10
      ? 'G'
      : length >= 7
      ? 'M'
      : length >= 4
      ? 'K'
      : ''

  let number
  if (!!Number(value)) {
    switch (kUnit) {
      case 'T':
        number = Number(value) / 1000000000000
        break
      case 'G':
        number = Number(value) / 1000000000
        break
      case 'M':
        number = Number(value) / 1000000
        break
      case 'K':
        number = Number(value) / 1000
        break
      default:
        number = Number(value)
    }

    return number.toFixed() + ' ' + kUnit + unit
  } else {
    return 'unknown'
  }
}

export const convertSourcesToDropdownItems = (
  sources: Source[]
): DropdownItem[] => {
  return sources
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(source => ({
      ...source,
      text: source.name,
    }))
}

export const getSourceByName = (
  sources: Source[],
  sourceName: string
): Source | undefined => {
  return sources.find(s => s.name === sourceName)
}

export const getSourceByTelegrafDatabase = (
  sources: Source[],
  organizationName: string
): Source | undefined => {
  return sources.find(s => s.telegraf === organizationName)
}

export const getSourceBySourceID = (
  sources: Source[],
  sourceID: string
): Source | undefined => {
  return sources.find(s => s.id === sourceID)
}

export const getOrganizationFromSource = (source: Source): string => {
  return source?.organization || ''
}

export const isNetworkDeviceOrganizationCreatedWithSrcId = (
  orgLearningModel: DevicesOrgData[],
  organizationID: OrganizationID
) => {
  const foundOrg = _.find(orgLearningModel, {organization: organizationID})

  const srcId = _.get(foundOrg, 'ai_kapacitor.srcId', '')
  const kapaId = _.get(foundOrg, 'ai_kapacitor.kapaId', '')

  return srcId !== '0' && kapaId !== '0'
}

export const getNetworkDeviceOrganizationStatus = (
  orgLearningModel: DevicesOrgData[],
  organizations: Organization[]
): DeviceOrganizationStatus => {
  if (!Array.isArray(orgLearningModel)) {
    throw new Error(
      'Invalid input: Network Device Organization should be an array'
    )
  }

  return _.reduce(
    orgLearningModel,
    (acc, org) => {
      if (typeof org.organization !== 'string' || !org.organization) {
        throw new Error('Invalid organization ID')
      }
      const organizationName = getOrganizationNameByID(
        organizations,
        org.organization
      )
      const srcId = _.get(org, 'ai_kapacitor.srcId', '')
      const kapaId = _.get(org, 'ai_kapacitor.kapaId', '')
      acc[organizationName] = srcId !== '0' && kapaId !== '0'
      return acc
    },
    {} as DeviceOrganizationStatus
  )
}

export const checkNetworkDeviceOrganizationStatus = (
  data: DeviceData[],
  orgStatus: DeviceOrganizationStatus
): boolean => {
  if (!Array.isArray(data)) {
    throw new Error('Invalid input: Network Device List should be an array')
  }
  if (typeof orgStatus !== 'object' || orgStatus === null) {
    throw new Error(
      'Invalid input: Network Device Organization Status should be an object'
    )
  }

  const organizations = Array.from(
    new Set(
      data.map(device => {
        if (typeof device.organization !== 'string' || !device.organization) {
          throw new Error('Invalid organization ID')
        }
        return device.organization
      })
    )
  )

  return organizations.every(org => orgStatus[org] === true)
}

export const parseErrorMessage = (error): string => {
  if (error?.message) {
    return error.message
  }

  if (error?.data) {
    if (typeof error.data === 'string') {
      try {
        const s = error.data.slice(0, -5) // Remove 'null\n' at the end of these responses
        const data = JSON.parse(s)

        return data?.message || 'Unknown Error'
      } catch (e) {
        return 'Unknown Error'
      }
    } else if (typeof error.data === 'object') {
      return error?.data?.message || 'Unknown Error'
    }
  }

  if (error?.statusText) {
    return error.statusText
  }

  return 'Unknown Error'
}

export const setArrayHostList = (
  aryList: HostState[],
  prevList: AlertHostList
): AlertHostList => {
  const {critical: prevCritical, warning: prevWarning} = prevList

  const {critical, warning} = aryList.reduce(
    (acc, item) => {
      if (item.isOk) {
        acc.critical.delete(item.host)
        acc.warning.delete(item.host)
      } else if (item.level === 'CRITICAL') {
        acc.critical.add(item.host)
        acc.warning.delete(item.host) // CRITICAL should not be in warning
      } else if (item.level === 'WARNING') {
        acc.warning.add(item.host)
        acc.critical.delete(item.host) // WARNING should not be in critical
      }
      return acc
    },
    {
      critical: new Set(prevCritical),
      warning: new Set(prevWarning),
    }
  )

  return {
    critical: Array.from(critical),
    warning: Array.from(warning),
  }
}

export const formatDateTimeForDeviceData = (
  dateTime: string | '',
  timeZone: TimeZones
): string => {
  if (!dateTime) {
    return '–'
  }

  if (timeZone === TimeZones.UTC) {
    return moment.utc(dateTime).format('YYYY-MM-DD HH:mm:ss')
  } else {
    return moment.utc(dateTime).local().format('YYYY-MM-DD HH:mm:ss')
  }
}

export const statusCal = (valueUsage: number) => {
  if (typeof valueUsage === 'number') {
    const status =
      valueUsage < 0
        ? 'invalid'
        : valueUsage < 50
        ? 'normal'
        : valueUsage < 70
        ? 'warning'
        : valueUsage < 80
        ? 'danger'
        : valueUsage < 90
        ? 'critical'
        : valueUsage >= 90
        ? 'emergency'
        : 'invalid'
    return status
  } else {
    return 'invalid'
  }
}

export const statusHexColor = (status: string) => {
  //color change - prediction.scss
  switch (status) {
    case 'invalid':
      return '#545667'
    case 'normal':
      return '#2de5a5'
    case 'warning':
      return '#ffb94a'
    case 'danger':
      return '#e85b1c'
    case 'critical':
      return '#ff0000'
    case 'emergency':
      return '#ab0000'
    default:
      return '#545667'
  }
}

export const returnCriticalValue = (host: PredictionTooltipNode): number => {
  const result = [host.cpu, host.memory]?.sort((a, b) => b - a)[0] ?? 0

  return result
}

export const hslColorValue = (value: string) => {
  //validation check with 0
  if (!(Number(value) + 100)) {
    return statusHexColor('invalid')
  }
  const result = ((100 - Number(value)) * 110) / 100

  return `hsl(${result ?? 0}, 78%, 54%)`
}
