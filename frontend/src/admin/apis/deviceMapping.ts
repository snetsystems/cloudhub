import AJAX from 'src/utils/ajax'
import {AxiosResponse} from 'axios'
import {DeviceMapping, DeviceMeta, Organization} from 'src/types'

export const fetchDeviceList = async (
  esSourceId: string
): Promise<DeviceMapping> => {
  const response = await AJAX({
    url: `/cloudhub/v1/device-mappings?es-source=${esSourceId}`,
    method: 'GET',
  })

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
  ip: string,
  hostName: string
): Promise<AxiosResponse> => {
  const response = await AJAX({
    url: `/cloudhub/v1/device-mappings`,
    method: 'POST',
    data: {
      ip,
      hostName,
    },
  })

  return response
}

export const updateDeviceMapping = async (
  hostName: string,
  data: {
    aliasName: string
    deviceType: string
    ip: string
    orgId: string
  },
  orgList: Organization[]
): Promise<AxiosResponse> => {
  const orgId = orgNameToId(data.orgId, orgList)

  const param = {
    aliasName: data.aliasName,
    deviceType: data.deviceType,
    ip: data.ip,
    orgId: orgId,
  }

  const response = await AJAX({
    url: `/cloudhub/v1/device-mappings/devices/${hostName}`,
    method: 'PATCH',
    data: param,
  })

  return response
}

export const saveDeviceMapping = async (
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
    url: `/cloudhub/v1/device-mappings`,
    method: 'POST',
    data: param,
  })

  return response
}

const orgNameToId = (orgName: string, orgList: Organization[]) => {
  return orgList.find(org => org.name === orgName)?.id
}
