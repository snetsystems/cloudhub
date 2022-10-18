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
  paramsUpdateCSP,
  getAWSInstancesApi,
  getAWSSecurityApi,
  getAWSVolumeApi,
  getAWSInstanceTypesApi,
  getGCPInstanceTypesApi,
  getCSPListInstancesApi,
  getGCPInstancesApi,
  fileWriteConfigApi,
  fileWriteKeyApi,
  getRunnerFileReadApi,
  getOSPProjectsApi,
} from 'src/hosts/apis'

// Types
import {Links, Ipmi, IpmiCell} from 'src/types'

// Notification Action
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  notifyIpmiConnectionFailed,
  notifygetCSPListInstancesFailed,
  notifygetAWSInstancesFailed,
  notifygetGCPInstancesFailed,
} from 'src/shared/copy/notifications'
import {IpmiSetPowerStatus} from 'src/shared/apis/saltStack'
import {CloudServiceProvider, CSPFileWriteParam} from 'src/hosts/types'

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
  GetCSPListInstances = 'GET_CSP_LIST_INSTANCES',
  GetAWSInstances = 'GET_AWS_INSTANCES',
  GetGCPInstances = 'GET_GCP_INSTANCES',
  GetAWSSecurity = 'GET_AWS_SECURITY',
  GetAWSVolume = 'GET_AWS_VOLUME',
  GetAWSInstanceTypes = 'GET_AWS_INSTANCE_TYPES',
  GetGCPInstanceTypes = 'GET_GCP_INSTANCE_TYPES',
  WriteCSPConfig = 'WRITE_CSP_CONFIG',
  WriteCSPKey = 'WRITE_CSP_KEY',
  GetRunnerFileRead = 'GET_RUNNER_FILE_READ',
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
  | GetCSPListInstancesAction
  | GetAWSInstancesAction
  | GetGCPInstancesAction
  | GetAWSSecurityAction
  | GetAWSInstanceTypesAction
  | GetGCPInstanceTypesAction
  | WriteCSPConfigAction
  | WriteCSPKeyAction
  | GetRunnerFileReadAction
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

interface GetCSPListInstancesAction {
  type: ActionTypes.GetCSPListInstances
}

export const getCSPListInstancesAction = (): GetCSPListInstancesAction => {
  return {
    type: ActionTypes.GetCSPListInstances,
  }
}
interface GetAWSInstancesAction {
  type: ActionTypes.GetAWSInstances
}

export const getAWSInstancesAction = (): GetAWSInstancesAction => {
  return {
    type: ActionTypes.GetAWSInstances,
  }
}

interface GetGCPInstancesAction {
  type: ActionTypes.GetGCPInstances
}

export const getGCPInstancesAction = (): GetGCPInstancesAction => {
  return {
    type: ActionTypes.GetGCPInstances,
  }
}

interface GetAWSSecurityAction {
  type: ActionTypes.GetAWSSecurity
}

export const getAWSSecurityAction = (): GetAWSSecurityAction => {
  return {
    type: ActionTypes.GetAWSSecurity,
  }
}

interface GetAWSVolumeAction {
  type: ActionTypes.GetAWSVolume
}

export const getAWSVolumeAction = (): GetAWSVolumeAction => {
  return {
    type: ActionTypes.GetAWSVolume,
  }
}

interface GetAWSInstanceTypesAction {
  type: ActionTypes.GetAWSInstanceTypes
}

export const getAWSInstanceTypesAction = (): GetAWSInstanceTypesAction => {
  return {
    type: ActionTypes.GetAWSInstanceTypes,
  }
}

interface GetGCPInstanceTypesAction {
  type: ActionTypes.GetGCPInstanceTypes
}

export const getGCPInstanceTypesAction = (): GetGCPInstanceTypesAction => {
  return {
    type: ActionTypes.GetGCPInstanceTypes,
  }
}

interface WriteCSPConfigAction {
  type: ActionTypes.WriteCSPConfig
}

export const writeCSPConfigAction = (): WriteCSPConfigAction => {
  return {
    type: ActionTypes.WriteCSPConfig,
  }
}

interface WriteCSPKeyAction {
  type: ActionTypes.WriteCSPKey
}

export const writeCSPKeyAction = (): WriteCSPKeyAction => {
  return {
    type: ActionTypes.WriteCSPKey,
  }
}

interface GetRunnerFileReadAction {
  type: ActionTypes.GetRunnerFileRead
}

export const getRunnerFileReadAction = (): GetRunnerFileReadAction => {
  return {
    type: ActionTypes.GetRunnerFileRead,
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
    throw error
  }
}

export const loadCloudServiceProviderAsync = (id: string) => async (
  dispatch: Dispatch<any>
) => {
  try {
    const data = await loadCloudServiceProviderAPI(id)
    dispatch(loadCloudServiceProviderAction())
    return data
  } catch (error) {
    dispatch(errorThrown(error))
    throw error
  }
}

export const createCloudServiceProviderAsync = ({
  provider,
  namespace,
  accesskey,
  secretkey,
}) => async (dispatch: Dispatch<any>) => {
  try {
    const data = await createCloudServiceProviderAPI({
      provider,
      namespace,
      accesskey,
      secretkey,
    })

    dispatch(createCloudServiceProviderAction())
    return data
  } catch (error) {
    dispatch(errorThrown(error, error.message))
    throw error
  }
}

export const updateCloudServiceProviderAsync = (
  params: paramsUpdateCSP
) => async (dispatch: Dispatch<any>) => {
  try {
    const data = await updateCloudServiceProviderAPI(params)
    dispatch(updateCloudServiceProviderAction())
    return data
  } catch (error) {
    dispatch(errorThrown(error))
    throw error
  }
}

export const deleteCloudServiceProviderAsync = (id: string) => async (
  dispatch: Dispatch<any>
) => {
  try {
    const resp = await deleteCloudServiceProviderAPI(id)
    dispatch(deleteCloudServiceProviderAction())
    return resp
  } catch (error) {
    dispatch(errorThrown(error))
    throw error
  }
}

export const getCSPListInstancesAsync = (
  pUrl: string,
  pToken: string,
  pCsps: any[]
) => async (dispatch: Dispatch<Action>) => {
  try {
    const cspInstances = await getCSPListInstancesApi(pUrl, pToken, pCsps)

    _.forEach(cspInstances.return, (host, index) => {
      if (pCsps[index].provider === CloudServiceProvider.AWS) {
        if (!_.isArray(_.values(host[0]))) {
          const {provider, namespace} = pCsps[index]
          const error = new Error(
            `<br/>PROVIDER: ${provider} <br/>REGION: ${namespace}`
          )
          dispatch(notifyAction(notifygetCSPListInstancesFailed(error)))
        }
      } else if (pCsps[index].provider === CloudServiceProvider.GCP) {
        if (!_.isObject(host)) {
          const {provider, namespace} = pCsps[index]
          const error = new Error(
            `<br/>PROVIDER: ${provider} <br/>PRPJECT: ${namespace}`
          )
          dispatch(notifyAction(notifygetCSPListInstancesFailed(error)))
        }
      }
    })

    dispatch(getCSPListInstancesAction())

    return cspInstances
  } catch (error) {
    dispatch(errorThrown(error))
  }
}

export const getAWSInstancesAsync = (
  pUrl: string,
  pToken: string,
  pCsps: any[]
) => async (dispatch: Dispatch<Action>) => {
  try {
    const awsInstances = await getAWSInstancesApi(pUrl, pToken, pCsps)

    _.forEach(awsInstances.return, (host, index) => {
      if (!_.isArray(_.values(host[0]))) {
        const {provider, namespace} = pCsps[index]
        const error = new Error(
          `<br/>PROVIDER: ${provider} <br/>REGION: ${namespace}`
        )
        dispatch(notifyAction(notifygetAWSInstancesFailed(error)))
      }
    })

    dispatch(getAWSInstancesAction())

    return awsInstances
  } catch (error) {
    dispatch(errorThrown(error))
  }
}

export const getGCPInstancesAsync = (
  pUrl: string,
  pToken: string,
  pCsps: any[]
) => async (dispatch: Dispatch<Action>) => {
  try {
    const gcpInstances = await getGCPInstancesApi(pUrl, pToken, pCsps)

    let convertedGcpInstances = {return: []}

    _.map(gcpInstances.return, item => {
      if (typeof item !== 'string') {
        _.reduce(
          item,
          (_before, current) => {
            let GcpInstancesItem = [null]
            Object.keys(current.gce).forEach((key, _) => {
              GcpInstancesItem.push(current.gce[key])
            })
            convertedGcpInstances.return.push(GcpInstancesItem)
            return false
          },
          {}
        )
      }
    })

    _.forEach(convertedGcpInstances.return, (host, index) => {
      if (!_.isArray(_.values(host))) {
        const {provider, namespace} = pCsps[index]
        const error = new Error(
          `<br/>PROVIDER: ${provider} <br/>PROJECT: ${namespace}`
        )
        dispatch(notifyAction(notifygetGCPInstancesFailed(error)))
      }
    })

    dispatch(getGCPInstancesAction())
    return convertedGcpInstances
  } catch (error) {
    dispatch(errorThrown(error))
  }
}

export const getOpenStackProjectsAsync = (
  pUrl: string,
  pToken: string,
  pCsps: any[]
) => async (dispatch: Dispatch<Action>) => {
  try {
    const ospProjects = await getOSPProjectsApi(pUrl, pToken, pCsps)

    return ospProjects
  } catch (error) {
    dispatch(errorThrown(error))
  }
}

export const getAWSSecurityAsync = (
  pUrl: string,
  pToken: string,
  pCsps: any[],
  pGroupIds: string[]
) => async (dispatch: Dispatch<Action>) => {
  try {
    const awsSecurity = await getAWSSecurityApi(pUrl, pToken, pCsps, pGroupIds)

    dispatch(getAWSSecurityAction())

    return awsSecurity
  } catch (error) {
    dispatch(errorThrown(error))
  }
}

export const getAWSVolumeAsync = (
  pUrl: string,
  pToken: string,
  pCsps: any[],
  pGroupIds: string[]
) => async (dispatch: Dispatch<Action>) => {
  try {
    const awsSecurity = await getAWSVolumeApi(pUrl, pToken, pCsps, pGroupIds)

    dispatch(getAWSVolumeAction())

    return awsSecurity
  } catch (error) {
    dispatch(errorThrown(error))
  }
}

export const getAWSInstanceTypesAsync = (
  pUrl: string,
  pToken: string,
  pCsps: any[],
  pTypes: string[]
) => async (dispatch: Dispatch<Action>) => {
  try {
    const awsSecurity = await getAWSInstanceTypesApi(
      pUrl,
      pToken,
      pCsps,
      pTypes
    )

    dispatch(getAWSInstanceTypesAction())

    return awsSecurity
  } catch (error) {
    dispatch(errorThrown(error))
  }
}

export const getGCPInstanceTypesAsync = (
  pUrl: string,
  pToken: string,
  pCsps: any[],
  pTypes: string[]
) => async (dispatch: Dispatch<Action>) => {
  try {
    const awsSecurity = await getGCPInstanceTypesApi(
      pUrl,
      pToken,
      pCsps,
      pTypes
    )

    dispatch(getGCPInstanceTypesAction())

    return awsSecurity
  } catch (error) {
    dispatch(errorThrown(error))
  }
}

export const writeCSPConfigAsync = (
  pUrl: string,
  pToken: string,
  pFileWrite: CSPFileWriteParam
) => async (dispatch: Dispatch<Action>) => {
  try {
    const config = await fileWriteConfigApi(pUrl, pToken, pFileWrite)

    dispatch(writeCSPConfigAction())

    return config
  } catch (error) {
    dispatch(errorThrown(error))
  }
}

export const writeCSPKeyAsync = (
  pUrl: string,
  pToken: string,
  pFileWrite: CSPFileWriteParam
) => async (dispatch: Dispatch<Action>) => {
  try {
    const key = await fileWriteKeyApi(pUrl, pToken, pFileWrite)

    dispatch(writeCSPKeyAction())

    return key
  } catch (error) {
    dispatch(errorThrown(error))
  }
}

export const getRunnerFileReadAsync = (
  pUrl: string,
  pToken: string,
  pFilePath: []
) => async (dispatch: Dispatch<Action>) => {
  try {
    const key = await getRunnerFileReadApi(pUrl, pToken, pFilePath)

    dispatch(getRunnerFileReadAction())

    return key
  } catch (error) {
    dispatch(errorThrown(error))
  }
}
