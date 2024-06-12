import {DeviceData, Organization} from 'src/types'

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
