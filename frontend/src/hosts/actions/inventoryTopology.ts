import {Dispatch, bindActionCreators} from 'redux'
import {errorThrown} from 'src/shared/actions/errors'
import _ from 'lodash'

// APIs
import {
  loadInventoryTopology,
  createInventoryTopology,
  updateInventoryTopology,
  getIpmiStatusSaltApi,
  getIpmiGetSensorDataApi,
  setIpmiSetPowerApi,
  loadCloudServiceProvidersAPI,
  loadCloudServiceProviderAPI,
  createCloudServiceProviderAPI,
  updateCloudServiceProviderAPI,
  deleteCloudServiceProviderAPI,
} from 'src/hosts/apis'

// Types
import {Links, Ipmi, IpmiCell} from 'src/types'

// Notification Action
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {notifyIpmiConnectionFailed} from 'src/shared/copy/notifications'
import {IpmiSetPowerStatus} from 'src/shared/apis/saltStack'

export enum ActionTypes {
  LoadInventoryTopology = 'LOAD_INVENTORY_TOPOLOGY',
  CreateInventoryTopology = 'CREATE_INVENTORY_TOPOLOGY',
  UpdateInventoryTopology = 'UPDATE_INVENTORY_TOPOLOGY',
  GetIpmiStatus = 'GET_IPMI_STATUS',
  LoadCloudServiceProvider = 'LOAD_CLOUD_SERVICE_PROVIDER',
  LoadCloudServiceProviders = 'LOAD_CLOUD_SERVICE_PROVIDERS',
  CreateCloudServiceProvider = 'CREATE_CLOUD_SERVICE_PROVIDER',
  UpdateCloudServiceProvider = 'UPDATE_CLOUD_SERVICE_PROVIDER',
  DeleteCloudServiceProvider = 'DELETE_CLOUD_SERVICE_PROVIDER',
}

export type Action =
  | LoadInventoryTopologyAction
  | CreateInventoryTopologyAction
  | UpdateInventoryTopologyAction
  | GetIpmiStatusAction
  | LoadCloudServiceProviderAction
  | LoadCloudServiceProvidersAction
  | CreateCloudServiceProviderAction
  | UpdateCloudServiceProviderAction
  | DeleteCloudServiceProviderAction

interface LoadInventoryTopologyAction {
  type: ActionTypes.LoadInventoryTopology
}

interface CreateInventoryTopologyAction {
  type: ActionTypes.CreateInventoryTopology
}

interface UpdateInventoryTopologyAction {
  type: ActionTypes.UpdateInventoryTopology
}

interface GetIpmiStatusAction {
  type: ActionTypes.GetIpmiStatus
}

export const loadInventoryTopologyAction = (): LoadInventoryTopologyAction => ({
  type: ActionTypes.LoadInventoryTopology,
})

export const createInventoryTopologyAction = (): CreateInventoryTopologyAction => ({
  type: ActionTypes.CreateInventoryTopology,
})

export const updateInventoryTopologyAction = (): UpdateInventoryTopologyAction => ({
  type: ActionTypes.UpdateInventoryTopology,
})

export const getIpmiStatusAction = (): GetIpmiStatusAction => ({
  type: ActionTypes.GetIpmiStatus,
})

export const loadInventoryTopologyAsync = (links: Links) => async (
  dispatch: Dispatch<Action>
) => {
  try {
    const resultLoadInventoryTopology = await loadInventoryTopology(links)

    return resultLoadInventoryTopology
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const createInventoryTopologyAsync = (
  links: Links,
  cells: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const resultCreateInventoryTopology = await createInventoryTopology(
      links,
      cells
    )

    return resultCreateInventoryTopology
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const updateInventoryTopologyAsync = (
  links: Links,
  cellsId: string,
  cells: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const resultUpdateInventoryTopology = await updateInventoryTopology(
      links,
      cellsId,
      cells
    )

    return resultUpdateInventoryTopology
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getIpmiStatusAsync = (
  pUrl: string,
  pToken: string,
  pIpmis: IpmiCell[]
) => async (dispatch: Dispatch<Action>) => {
  try {
    const ipmis = await getIpmiStatusSaltApi(pUrl, pToken, pIpmis)

    let error = ''
    let resultIpmis: IpmiCell[] = pIpmis

    _.map(ipmis.return, (ipmi, index) => {
      if (_.values(ipmi)[0] !== 'on' && _.values(ipmi)[0] !== 'off') {
        if (error !== null) {
          error += '\n'
        }
        error += `[${pIpmis[index].host}] ` + JSON.stringify(_.values(ipmi)[0])

        resultIpmis[index].powerStatus = ''
      } else {
        resultIpmis[index].powerStatus = _.values(ipmi)[0]
      }
    })

    if (!_.isEmpty(error)) {
      const notify = bindActionCreators(notifyAction, dispatch)
      notify(notifyIpmiConnectionFailed(Error(error)))
      console.error(error)
    }

    dispatch(getIpmiStatusAction())
    return resultIpmis
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const setIpmiStatusAsync = (
  pUrl: string,
  pToken: string,
  pIpmis: Ipmi,
  pState: IpmiSetPowerStatus
) => async (dispatch: Dispatch<Action>) => {
  try {
    const responseSetPower = await setIpmiSetPowerApi(
      pUrl,
      pToken,
      pIpmis,
      pState
    )

    return responseSetPower
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getIpmiSensorDataAsync = (
  pUrl: string,
  pToken: string,
  pIpmis: Ipmi
) => async (dispatch: Dispatch<Action>) => {
  try {
    const responseSensorData = await getIpmiGetSensorDataApi(
      pUrl,
      pToken,
      pIpmis
    )
    const sensorData = responseSensorData.return[0]
    const isSensorData =
      _.isObject(sensorData[pIpmis.target]) &&
      !_.isArray(sensorData[pIpmis.target]) &&
      _.keys(sensorData[pIpmis.target]).length > 0

    if (!isSensorData) {
      throw new Error(`[${pIpmis.target}]: ${sensorData[pIpmis.target]}`)
    }

    return sensorData
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

interface LoadCloudServiceProviderAction {
  type: ActionTypes.LoadCloudServiceProvider
}

export const loadCloudServiceProviderAction = (): LoadCloudServiceProviderAction => {
  return {
    type: ActionTypes.LoadCloudServiceProvider,
  }
}

interface LoadCloudServiceProvidersAction {
  type: ActionTypes.LoadCloudServiceProviders
}

export const loadCloudServiceProviderActions = (): LoadCloudServiceProvidersAction => {
  return {
    type: ActionTypes.LoadCloudServiceProviders,
  }
}

interface CreateCloudServiceProviderAction {
  type: ActionTypes.CreateCloudServiceProvider
}

export const createCloudServiceProviderAction = (): CreateCloudServiceProviderAction => {
  return {
    type: ActionTypes.CreateCloudServiceProvider,
  }
}

interface UpdateCloudServiceProviderAction {
  type: ActionTypes.UpdateCloudServiceProvider
}

export const updateCloudServiceProviderAction = (): UpdateCloudServiceProviderAction => {
  return {
    type: ActionTypes.UpdateCloudServiceProvider,
  }
}

interface DeleteCloudServiceProviderAction {
  type: ActionTypes.DeleteCloudServiceProvider
}

export const deleteCloudServiceProviderAction = (): DeleteCloudServiceProviderAction => {
  return {
    type: ActionTypes.DeleteCloudServiceProvider,
  }
}

export const loadCloudServiceProvidersAsync = () => async (
  dispatch: Dispatch<any>
) => {
  try {
    const data = await loadCloudServiceProvidersAPI()
    return data
  } catch (error) {
    dispatch(errorThrown(error))
  }
}

export const loadCloudServiceProviderAsync = (id: string) => async (
  dispatch: Dispatch<any>
) => {
  try {
    const url = `/cloudhub/v1/csp/${id}`
    const data = await loadCloudServiceProviderAPI(url)
    dispatch(loadCloudServiceProviderAction())
    return data
  } catch (error) {
    dispatch(errorThrown(error))
  }
}

export const createCloudServiceProviderAsync = ({
  provider,
  region,
  accesskey,
  secretkey,
}) => async (dispatch: Dispatch<any>) => {
  try {
    const data = await createCloudServiceProviderAPI({
      provider,
      region,
      accesskey,
      secretkey,
    })

    dispatch(createCloudServiceProviderAction())
    return data
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const updateCloudServiceProviderAsync = ({
  id,
  provider,
  region,
  accesskey,
  secretkey,
}) => async (dispatch: Dispatch<any>) => {
  try {
    const data = await updateCloudServiceProviderAPI({
      id,
      provider,
      region,
      accesskey,
      secretkey,
    })
    dispatch(updateCloudServiceProviderAction())
    return data
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const deleteCloudServiceProviderAsync = (id: string) => async (
  dispatch: Dispatch<any>
) => {
  try {
    deleteCloudServiceProviderAPI(id).then(() => {
      dispatch(deleteCloudServiceProviderAction())
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}
