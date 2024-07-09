// Library
import AJAX from 'src/utils/ajax'
import {AxiosResponse} from 'axios'
import _ from 'lodash'

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
  UpdateDeviceOrganizationOption,
  UpdateDevicesOrgResponse,
} from 'src/types/deviceManagement'

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
    `SELECT non_negative_derivative(mean(uptime)) AS Uptime FROM \":db:\".\":rp:\".\"snmp_nx\" WHERE time > now() - ${telegrafSystemInterval} * 10 GROUP BY agent_host, time(${telegrafSystemInterval}) fill(0);`,
    tempVars
  )
  const {data} = await proxy({
    source: proxyLink,
    query,
    db: telegrafDB,
  })
  const deviceMonitoringStatus: DeviceMonitoringStatus = {}
  const uptimeSeries = getDeep<Series[]>(data, 'results.[0].series', [])

  _.forEach(uptimeSeries, s => {
    const deviceIP = _.get(s, 'tags.agent_host')
    if (deviceIP) {
      _.set(
        deviceMonitoringStatus,
        [deviceIP, 'uptime'],
        _.get(deviceMonitoringStatus, [deviceIP, 'uptime'], 0)
      )
      const uptimeIndex = _.findIndex(s.columns, col => col === 'Uptime')
      if (uptimeIndex !== -1) {
        const latestValue = _.last(s.values)
        if (_.isArray(latestValue) && latestValue.length > uptimeIndex) {
          _.set(
            deviceMonitoringStatus,
            [deviceIP, 'uptime'],
            Number(latestValue[uptimeIndex])
          )
        }
      }
    }
  })

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
