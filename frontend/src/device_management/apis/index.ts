import AJAX from 'src/utils/ajax'
import {AxiosResponse} from 'axios'
import {
  SNMPConnectionRequest,
  SNMPConnectionResponse,
  CreateDeviceListRequest,
  CreateDeviceListResponse,
  GetDeviceListRsponse,
  DeleteDeviceParams,
  DeleteDeviceResponse,
  UpdateDeviceResponse,
  UpdateDeviceRequest,
} from 'src/types'
import {
  DEVICE_MANAGEMENT_URL,
  SNMP_CONNECTION_URL,
} from 'src/device_management/constants'

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
    return AJAX<GetDeviceListRsponse>({
      url: DEVICE_MANAGEMENT_URL,
      method: 'GET',
    }) as Promise<AxiosResponse<GetDeviceListRsponse>>
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const updateDevice = async ({id, devicesInfo}: UpdateDeviceRequest) => {
  try {
    const response = await AJAX({
      data: devicesInfo,
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

export const deleteDevice = (parmas: DeleteDeviceParams) => {
  try {
    return AJAX<DeleteDeviceResponse>({
      data: parmas,
      url: DEVICE_MANAGEMENT_URL,
      method: 'DELETE',
    }) as Promise<AxiosResponse<DeleteDeviceResponse>>
  } catch (error) {
    console.error(error)
    throw error
  }
}
