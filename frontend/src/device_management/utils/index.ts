import {DeviceData, DeviceDataMonitoringStatus, Organization} from 'src/types'

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
