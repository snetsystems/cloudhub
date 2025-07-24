import AJAX from 'src/utils/ajax'
import {AxiosResponse} from 'axios'
import {DeviceMapping, DeviceMeta, Organization} from 'src/types'
import {
  notifyDeleteDeviceFailed,
  notifyDeleteDeviceSucceeded,
  notifyFetchDeviceListError,
  notifyUpdateDeviceFailed,
  notifyUpdateDeviceSucceeded,
  notifyCreateDeviceSucceeded,
  notifyCreateDeviceFailed,
} from 'src/shared/copy/notifications'
import {notify} from 'src/shared/actions/notifications'

export const fetchDeviceList = async (
  esSourceId: string
): Promise<DeviceMapping> => {
  const response = await AJAX({
    url: `/cloudhub/v1/device-mappings/devices?es-source=${esSourceId}`,
    method: 'GET',
  })

  console.log('error: ', response)

  if (response.status !== 200) {
    notify(notifyFetchDeviceListError(response.data.message))
    throw new Error(notifyFetchDeviceListError(response.data.message).message)
  }

  return response.data
}

export const deleteDeviceMapping = async (
  hostName: string
): Promise<AxiosResponse> => {
  const response = await AJAX({
    url: `/cloudhub/v1/device-mappings/devices/${hostName}`,
    method: 'DELETE',
  })

  if (response.status !== 200) {
    notify(notifyDeleteDeviceFailed(response.data.message))
    throw new Error(notifyDeleteDeviceFailed(response.data.message).message)
  }

  notify(notifyDeleteDeviceSucceeded())
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

  if (response.status !== 200) {
    notify(notifyCreateDeviceFailed(response.data.message))
    throw new Error(notifyCreateDeviceFailed(response.data.message).message)
  }

  notify(notifyCreateDeviceSucceeded())
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

  if (response.status !== 200) {
    notify(notifyUpdateDeviceFailed(response.data.message))
    throw new Error(notifyUpdateDeviceFailed(response.data.message).message)
  }

  notify(notifyUpdateDeviceSucceeded())
  return response
}

const orgNameToId = (orgName: string, orgList: Organization[]) => {
  return orgList.find(org => org.name === orgName)?.id
}
