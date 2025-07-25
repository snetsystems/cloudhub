import AJAX from 'src/utils/ajax'
import {AxiosResponse} from 'axios'
import {DeviceMapping, DeviceMeta, Organization} from 'src/types'
import {orgNameToId} from 'src/admin/utils/deviceMapping'

export const fetchDeviceList = async (
  esSourceId: string
): Promise<DeviceMapping> => {
  const response = await AJAX({
    url: `/cloudhub/v1/device-mappings/devices?es-source=${esSourceId}`,
    method: 'GET',
  })

  console.log('error: ', response)

  return response.data
}

export const deleteDeviceMapping = async (
  hostName: string
): Promise<AxiosResponse> => {
  const response = await AJAX({
    url: `/cloudhub/v1/device-mappings/devices/${hostName}`,
    method: 'DELETE',
  })

  return response
}

export const createDeviceMapping = async (
  data: DeviceMeta,
  orgList: Organization[]
): Promise<AxiosResponse> => {
  const orgId = orgNameToId(data.orgId, orgList)

  const param = {
    ip: data.ip,
    hostName: data.hostname,
    aliasName: data.aliasName,
    deviceType: data.deviceType,
    orgId: orgId,
  }

  const response = await AJAX({
    url: `/cloudhub/v1/device-mappings/devices`,
    method: 'POST',
    data: param,
  })

  return response
}

export const updateDeviceMapping = async (
  data: DeviceMeta
): Promise<AxiosResponse> => {
  const param = {
    aliasName: data.aliasName,
    deviceType: data.deviceType,
    ip: data.ip,
    orgId: data.orgId,
    vendor: data.vendor,
  }

  const response = await AJAX({
    url: `/cloudhub/v1/device-mappings/devices/${data.hostname}`,
    method: 'PATCH',
    data: param,
  })

  return response
}

export const ensureDeviceMapping = async (
  hostName: string,
  esSourceID: string
): Promise<DeviceMeta> => {
  const data: {
    hostname: string
    esSource?: string
  } = {
    hostname: hostName,
    esSource: esSourceID,
  }

  const response = await AJAX({
    url: `/cloudhub/v1/device-mappings/ensure`,
    method: 'POST',
    data,
  })

  return response?.data?.meta || {}
}
