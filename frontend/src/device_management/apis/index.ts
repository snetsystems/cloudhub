// Library
import AJAX from 'src/utils/ajax'
import {AxiosResponse} from 'axios'
import _, {isEmpty} from 'lodash'

// Types
import {
  SNMPConnectionRequest,
  SNMPConnectionResponse,
  CreateDeviceListRequest,
  CreateDeviceListResponse,
  GetDeviceListResponse,
  DeleteDeviceParams,
  DeleteDeviceResponse,
  UpdateDeviceResponse,
  UpdateDeviceRequest,
  Template,
  DeviceMonitoringStatus,
  ApplyMonitoringRequest,
  ApplyMonitoringResponse,
  TimeRange,
  Layout,
  AppsForHost,
  Source,
  INPUT_TIME_TYPE,
} from 'src/types'

// Constants
import {
  APPLY_LEARNING_ENABLE_STATUS_URL,
  APPLY__MONITORING_URL,
  DEVICE_MANAGEMENT_SCRIPT_URL,
  DEVICE_MANAGEMENT_URL,
  NETWORK_MANAGEMENT_ORGANIZATIONS_URL,
  SNMP_CONNECTION_URL,
} from 'src/device_management/constants'

// API
import {
  getRule as getRuleAJAX,
  updateTask as updateTaskAJAX,
} from 'src/kapacitor/apis'

// Utils
import {proxy} from 'src/utils/queryUrlGenerator'
import replaceTemplate from 'src/tempVars/utils/replace'
import {getDeep} from 'src/utils/wrappers'
import {
  ApplyLearningEnableStatusRequest,
  CreateDeviceManagmenntScriptRequest,
  CreateDeviceManagmenntScriptResponse,
  CreateDeviceOrganizationOption,
  GetAllDevicesOrgResponse,
  UpdateDeviceManagmenntScriptRequest,
  UpdateDeviceManagmenntScriptResponse,
  UpdateDeviceOrganizationOption,
  UpdateDevicesOrgResponse,
} from 'src/types/deviceManagement'
import {decimalUnitNumber, parseSeries} from '../utils'
import {hasError} from 'apollo-client/core/ObservableQuery'

interface Series {
  name: string
  columns: string[]
  values: string[]
  tags: {
    agent_host: string
  }
}

export const fetchDeviceMonitoringStatus = async (
  proxyLink: string,
  telegrafDB: string,
  telegrafSystemInterval: string,
  tempVars: Template[]
): Promise<DeviceMonitoringStatus> => {
  const query = replaceTemplate(
    `SELECT sys_uptime FROM \":db:\".\":rp:\".\"snmp_nx\" WHERE time > now() - ${telegrafSystemInterval} * 10 GROUP BY agent_host LIMIT 1;`,
    tempVars
  )
  const {data} = await proxy({
    source: proxyLink,
    query,
    db: telegrafDB,
  })
  const deviceMonitoringStatus: DeviceMonitoringStatus = {}
  const uptimeSeries = getDeep<Series[]>(data, 'results.[0].series', [])

  if (Array.isArray(uptimeSeries)) {
    uptimeSeries.forEach(series => {
      if (
        series &&
        typeof series === 'object' &&
        series.tags &&
        typeof series.tags.agent_host === 'string'
      ) {
        const deviceIP = series.tags.agent_host

        if (deviceIP) {
          const hasValues = _.get(series, 'values.length', 0) > 0
          deviceMonitoringStatus[deviceIP] = hasValues
        }
      }
    })
  }

  return deviceMonitoringStatus
}

export const validateSNMPConnection = async (
  snmpConfig: SNMPConnectionRequest[]
) => {
  try {
    const response = await AJAX({
      data: snmpConfig,
      url: SNMP_CONNECTION_URL,
      method: 'POST',
    })
    const {data} = response as SNMPConnectionResponse

    return data
  } catch (error) {
    console.error(error)
    throw error
  }
}

//get device list api
export const createDevices = async (devicesInfo: CreateDeviceListRequest) => {
  try {
    const response = await AJAX({
      data: devicesInfo,
      url: DEVICE_MANAGEMENT_URL,
      method: 'POST',
    })
    const {data} = response as CreateDeviceListResponse

    return data
  } catch (error) {
    console.error(error)
    throw error
  }
}
export const getDeviceList = () => {
  try {
    return AJAX<GetDeviceListResponse>({
      url: DEVICE_MANAGEMENT_URL,
      method: 'GET',
    }) as Promise<AxiosResponse<GetDeviceListResponse>>
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const updateDevice = async ({id, deviceData}: UpdateDeviceRequest) => {
  try {
    const response = await AJAX({
      data: deviceData,
      url: `${DEVICE_MANAGEMENT_URL}/${id}`,
      method: 'PATCH',
    })
    const {data} = response as UpdateDeviceResponse

    return data
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const deleteDevice = (params: DeleteDeviceParams) => {
  try {
    return AJAX<DeleteDeviceResponse>({
      data: params,
      url: DEVICE_MANAGEMENT_URL,
      method: 'DELETE',
    }) as Promise<AxiosResponse<DeleteDeviceResponse>>
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const applyLearningEnableStatus = async (
  learning_devices: ApplyLearningEnableStatusRequest
) => {
  try {
    const response = await AJAX({
      data: learning_devices,
      url: APPLY_LEARNING_ENABLE_STATUS_URL,
      method: 'POST',
    })
    const {data} = response as ApplyMonitoringResponse

    return data
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const applyMonitoring = async (
  collecting_devices: ApplyMonitoringRequest
) => {
  try {
    const response = await AJAX({
      data: collecting_devices,
      url: APPLY__MONITORING_URL,
      method: 'POST',
    })
    const {data} = response as ApplyMonitoringResponse

    return data
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const getAllDevicesOrg = async () => {
  try {
    return AJAX<GetAllDevicesOrgResponse>({
      method: 'GET',
      url: NETWORK_MANAGEMENT_ORGANIZATIONS_URL,
    }) as Promise<AxiosResponse<GetAllDevicesOrgResponse>>
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const updateDeviceOrganization = async ({
  id,
  orgLearningModel,
}: UpdateDeviceOrganizationOption) => {
  try {
    const response = await AJAX<UpdateDevicesOrgResponse>({
      data: orgLearningModel,
      url: `${NETWORK_MANAGEMENT_ORGANIZATIONS_URL}/${id}`,
      method: 'PATCH',
    })
    const {data} = response as UpdateDevicesOrgResponse

    return data
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const createDeviceOrganization = async (
  orgLearningModel: CreateDeviceOrganizationOption
) => {
  try {
    const response = await AJAX<UpdateDevicesOrgResponse>({
      data: orgLearningModel.orgLearningModel,
      url: NETWORK_MANAGEMENT_ORGANIZATIONS_URL,
      method: 'POST',
    })
    const {data} = response as UpdateDevicesOrgResponse

    return data
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const getSpecificRule = async (kapacitor, ruleID) => {
  try {
    const response = await getRuleAJAX(kapacitor, ruleID)
    const {data: rule} = response

    return rule
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const updateTaskForDeviceManagement = async (
  kapacitor,
  task,
  ruleID
) => {
  try {
    const response = await updateTaskAJAX(kapacitor, task, ruleID)

    const {data} = response

    return data
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const createDeviceManagementTickScript = async (
  deviceManagementScript: CreateDeviceManagmenntScriptRequest
) => {
  try {
    const response = await AJAX<CreateDeviceManagmenntScriptResponse>({
      data: deviceManagementScript,
      url: DEVICE_MANAGEMENT_SCRIPT_URL,
      method: 'POST',
    })

    const {data} = response as CreateDeviceManagmenntScriptResponse

    return data
  } catch (error) {
    console.error(error)
    throw error
  }
}

const validateUpperTime = (upper: String) => {
  if (upper !== 'now()' && !!upper) {
    return `AND time <= '${upper}'`
  } else {
    return 'AND time <= now()'
  }
}

export const getPredictionAlert = (
  source: string,
  timeRange: TimeRange,
  limit: number,
  db: string
) => {
  if (timeRange.format === INPUT_TIME_TYPE.TIMESTAMP) {
    const query = `SELECT host, value, level, alertName, triggerType, agent_host FROM cloudhub_alerts WHERE time >= '${
      timeRange.lower
    }' ${validateUpperTime(timeRange.upper)} ORDER BY time desc ${
      limit ? `LIMIT ${limit}` : ''
    }`

    return proxy({
      source,
      query,
      db,
    })
  } else {
    const query = `SELECT host, value, level, alertName, triggerType, agent_host FROM cloudhub_alerts WHERE time >= ${
      timeRange.lower
    } AND time <= ${timeRange.upper ?? 'now()'} ORDER BY time desc ${
      limit ? `LIMIT ${limit}` : ''
    }`

    return proxy({
      source,
      query,
      db,
    })
  }
}

export const getLiveDeviceInfo = async (
  source: string,
  db: string,
  tempVars: Template[],
  meRole: string
) => {
  const query = replaceTemplate(
    `SELECT mean("cpu1min") FROM \":db:\".\"autogen\".\"snmp_nx\" WHERE time > now() - 5m GROUP BY agent_host;
    SELECT mean("mem_usage") FROM \":db:\".\"autogen\".\"snmp_nx\" WHERE time > now() - 5m GROUP BY agent_host;
    SELECT last("tff_volume") from (SELECT non_negative_derivative(sum("ifHCOutOctets"),1s) + non_negative_derivative(sum("ifHCInOctets"),1s) AS "tff_volume" FROM "Default"."autogen"."snmp_nx" WHERE "time" > now()-5m AND "ifDescr"=~/Ethernet/ GROUP BY time(1m), "agent_host") GROUP BY "agent_host";
    SHOW TAG VALUES FROM \"autogen\".\"snmp_nx\" WITH KEY IN ("agent_host")
      `,
    tempVars
  )

  const {data} = await proxy({
    source,
    query,
    db,
  })
  const cpuSeries = getDeep<Series[]>(data, 'results.[0].series', [])
  const memUsedSeries = getDeep<Series[]>(data, 'results.[1].series', [])
  const trafficSeries = getDeep<Series[]>(data, 'results.[2].series', [])
  const agentHost = getDeep<Series[]>(data, 'results.[3].series.[0].values', [])

  if (
    agentHost.length === memUsedSeries.length &&
    agentHost.length === cpuSeries.length &&
    agentHost.length === trafficSeries.length
  ) {
    const result = agentHost.map((host, idx) => {
      return {
        name: host[1] as string,
        cpu: Number(cpuSeries[idx].values[0][1]),
        memory: Number(memUsedSeries[idx].values[0][1]),
        traffic: decimalUnitNumber(trafficSeries[idx].values[0][1], 'bps'),
      }
    })

    return result
  } else {
    throw Error('cpu or memory data is not invalid')
  }
}

export const getDeviceManagementTickScript = async ruleID => {
  try {
    return await AJAX({
      method: 'GET',
      url: `${DEVICE_MANAGEMENT_SCRIPT_URL}/${ruleID}`,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const updateDeviceManagementTickScript = async (
  deviceManagementScript: UpdateDeviceManagmenntScriptRequest,
  organizationID: string
) => {
  try {
    const response = await AJAX<UpdateDeviceManagmenntScriptResponse>({
      data: deviceManagementScript,
      url: `${DEVICE_MANAGEMENT_SCRIPT_URL}/${organizationID}`,
      method: 'PATCH',
    })

    const {data} = response as UpdateDeviceManagmenntScriptResponse

    return data
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const getMeasurementsForPredictionInstance = async (
  source: Source,
  instance: string
): Promise<string[]> => {
  let query = ''

  query = `SHOW MEASUREMENTS WHERE "agent_host" = '${instance}'`

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

export const getAppsForAgentHost = async (
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

  let query = ''

  query = `show series from ${measurements} where host = '${host}'`

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
