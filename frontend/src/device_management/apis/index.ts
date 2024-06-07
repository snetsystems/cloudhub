import AJAX from 'src/utils/ajax'
import {AxiosResponse} from 'axios'
import {
  GetDeviceListRsponse,
  PatchDeviceResponse,
  DeleteDeviceParams,
  PatchDeviceParams,
} from 'src/types'
import {DeleteDeviceResponse} from 'src/types/deviceManagement'

//get device list api
export const getDeviceList = () => {
  try {
    return AJAX<GetDeviceListRsponse>({
      url: '/cloudhub/v1/ai/network/managements/devices',
      method: 'GET',
    }) as Promise<AxiosResponse<GetDeviceListRsponse>>
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const patchDevice = ({id, deviceData}: PatchDeviceParams) => {
  try {
    return AJAX<PatchDeviceResponse>({
      url: `/cloudhub/v1/ai/network/managements/devices/${id}`,
      method: 'PATCH',
      data: deviceData,
    }) as Promise<AxiosResponse<PatchDeviceResponse>>
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const deleteDevice = (parmas: DeleteDeviceParams) => {
  try {
    return AJAX<DeleteDeviceResponse>({
      url: `/cloudhub/v1/ai/network/managements/devices`,
      method: 'DELETE',
      data: parmas,
    }) as Promise<AxiosResponse<DeleteDeviceResponse>>
  } catch (error) {
    console.error(error)
    throw error
  }
}
