import _ from 'lodash'
import {DeviceData, DeviceDataMonitoringStatus, Organization} from 'src/types'
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
