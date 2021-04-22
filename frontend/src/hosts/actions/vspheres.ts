import {Dispatch, bindActionCreators} from 'redux'
import {errorThrown} from 'src/shared/actions/errors'
import _ from 'lodash'

// Types
import {ResponseVSphere, reducerVSphere} from 'src/hosts/types'

// APIs
import {
  getMinionKeyAcceptedList,
  getVSphereInfoSaltApi,
  getTicketRemoteConsoleApi,
  getVSpheresApi,
  getVSphereApi,
  addVSphereApi,
  updateVSphereApi,
  deleteVSphereApi,
} from 'src/hosts/apis'

// Notification Action
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  notifyConnectVCenterFailed,
  notifyConnectRemoteConsoleFailed,
} from 'src/shared/copy/notifications'

export enum ActionTypes {
  MinionKeyAcceptedList = 'GET_MINION_KEY_ACCEPTED_LIST',
  RequestLoadVcenters = 'REQUEST_LOAD_VCENTERS',
  LoadVcenters = 'LOAD_VCENTERS',
  AddVcenter = 'ADD_VCENTER',
  RemoveVcenter = 'REMOVE_VCENTER',
  UpdateVcenter = 'UPDATE_VCENTER',
  UpdateVcenters = 'UPDATE_VCENTERS',
  RequestVcenter = 'REQUEST_VCENTER',
  ResponseVcenter = 'RESPONE_VCENTER',
  RequestPauseVcenter = 'Request_PAUSE_VCENTER',
  RequestRunVcenter = 'Request_RUN_VCENTER',
}

export type Action =
  | MinionKeyAcceptedListAction
  | RequestLoadVcentersAction
  | LoadVcentersAction
  | AddVcenterAction
  | RemoveVcenterAction
  | UpdateVcenterAction
  | UpdateVcentersAction
  | RequestVcenterAction
  | ResponseVcenterAction
  | RequestPauseVcenterAction
  | RequestRunVcenterAction

interface RequestPauseVcenterAction {
  type: ActionTypes.RequestPauseVcenter
  payload: {
    host: string
    id: string
    isPause: boolean
  }
}

export const RequestPauseVcenterAction = (
  host: string,
  id: string
): RequestPauseVcenterAction => {
  return {
    type: ActionTypes.RequestPauseVcenter,
    payload: {
      host,
      id,
      isPause: true,
    },
  }
}

interface RequestRunVcenterAction {
  type: ActionTypes.RequestRunVcenter
  payload: {
    host: string
    id: string
    isPause: boolean
  }
}

export const RequestRunVcenterAction = (
  host: string,
  id: string
): RequestRunVcenterAction => {
  return {
    type: ActionTypes.RequestRunVcenter,
    payload: {
      host,
      id,
      isPause: false,
    },
  }
}

interface MinionKeyAcceptedListAction {
  type: ActionTypes.MinionKeyAcceptedList
}

export const loadMinionKeyAcceptedList = (): MinionKeyAcceptedListAction => ({
  type: ActionTypes.MinionKeyAcceptedList,
})

interface LoadVcentersAction {
  type: ActionTypes.LoadVcenters
  payload: reducerVSphere['vspheres']
}

export const loadVcentersList = (
  payload: LoadVcentersAction['payload']
): LoadVcentersAction => ({
  type: ActionTypes.LoadVcenters,
  payload,
})

interface RequestLoadVcentersAction {
  type: ActionTypes.RequestLoadVcenters
}

export const requestVcenterList = () => ({
  type: ActionTypes.RequestLoadVcenters,
})

interface AddVcenterAction {
  type: ActionTypes.AddVcenter
  payload: reducerVSphere['vspheres']
}

export const addVcenterAction = (
  props: AddVcenterAction['payload']
): AddVcenterAction => ({
  type: ActionTypes.AddVcenter,
  payload: props,
})

interface RemoveVcenterAction {
  type: ActionTypes.RemoveVcenter
  payload: {
    host: string
  }
}

export const removeVcenter = (host: string): RemoveVcenterAction => ({
  type: ActionTypes.RemoveVcenter,
  payload: {
    host,
  },
})

interface UpdateVcenterAction {
  type: ActionTypes.UpdateVcenter
  payload: reducerVSphere['vspheres']['host']
}

export const updateVcenterAction = (
  payload: UpdateVcenterAction['payload']
): UpdateVcenterAction => {
  return {
    type: ActionTypes.UpdateVcenter,
    payload,
  }
}

// interface UpdateVcentersActionPayload {
//   id?: string
//   host?: string
//   username?: string
//   password?: string
//   protocol?: string
//   port?: string
//   interval?: number
//   organization?: string
//   minion?: string
//   links?: {
//     self: string
//   }
//   nodes?: ResponseVSphere
// }

interface UpdateVcentersAction {
  type: ActionTypes.UpdateVcenters
  payload: reducerVSphere['vspheres']['host'][]
}

export const updateVcentersAction = (
  payload: reducerVSphere['vspheres']['host'][]
): UpdateVcentersAction => {
  return {
    type: ActionTypes.UpdateVcenters,
    payload,
  }
}

interface RequestVcenterAction {
  type: ActionTypes.RequestVcenter
}

export const RequestVcenterAction = (): RequestVcenterAction => ({
  type: ActionTypes.RequestVcenter,
})

interface ResponseVcenterAction {
  type: ActionTypes.ResponseVcenter
}

export const ResponseVcenterAction = (): ResponseVcenterAction => ({
  type: ActionTypes.ResponseVcenter,
})

export const getMinionKeyAcceptedListAsync = (
  pUrl: string,
  pToken: string
) => async (dispatch: Dispatch<Action>): Promise<String[]> => {
  try {
    const minions = await getMinionKeyAcceptedList(pUrl, pToken)

    dispatch(loadMinionKeyAcceptedList())
    return minions
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getVSphereInfoSaltApiAsync = (
  pUrl: string,
  pToken: string,
  tgt: string,
  address: string,
  user: string,
  password: string,
  port: string,
  protocol: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const vSphereInfo: ResponseVSphere = await getVSphereInfoSaltApi(
      pUrl,
      pToken,
      tgt,
      address,
      user,
      password,
      port,
      protocol
    )

    if (
      typeof _.values(vSphereInfo.return[0])[0] === 'string' ||
      typeof _.values(vSphereInfo.return[0])[0] === 'boolean'
    ) {
      let error = Error(JSON.stringify(_.values(vSphereInfo.return[0])[0]))
      const notify = bindActionCreators(notifyAction, dispatch)
      notify(notifyConnectVCenterFailed(error))
      return
    }

    dispatch(loadMinionKeyAcceptedList())
    return vSphereInfo
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getTicketRemoteConsoleAsync = (
  pUrl: string,
  pToken: string,
  tgt: string,
  address: string,
  user: string,
  password: string
) => async (dispatch: Dispatch<Action>): Promise<String[]> => {
  try {
    const vSphereInfo = await getTicketRemoteConsoleApi(
      pUrl,
      pToken,
      tgt,
      address,
      user,
      password
    )

    if (_.isEmpty(vSphereInfo)) {
      return
    }

    const remoteConsoleUrl = _.get(vSphereInfo, `return[0].${tgt}`, '')
    const isError = remoteConsoleUrl.indexOf('ERROR:')
    if (isError > -1) {
      const error = Error(remoteConsoleUrl)
      const notify = bindActionCreators(notifyAction, dispatch)
      notify(notifyConnectRemoteConsoleFailed(error))
      return
    }

    dispatch(loadMinionKeyAcceptedList())
    return remoteConsoleUrl
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

// CH DB VSHPERE API
export const getVSpheresAsync = ({shouldResetVSphere = false} = {}) => async (
  dispatch: Dispatch<Action>
) => {
  let vSpheres = {}

  if (shouldResetVSphere) {
    dispatch(requestVcenterList())
  }

  try {
    const data = await getVSpheresApi()

    _.values(data).forEach((v) => {
      vSpheres[v.host] = {
        ...v,
        isPause: true,
      }
    })

    dispatch(loadVcentersList(vSpheres))
    return vSpheres
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getVSphereAsync = (id: number) => async (
  dispatch: Dispatch<Action>
) => {
  try {
    const vSpheres = await getVSphereApi(id)
    return vSpheres
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const addVCenterAsync = (
  tgt: string,
  address: string,
  user: string,
  password: string,
  port: string,
  protocol: string,
  interval: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const resultAddVCenterAsync = await addVSphereApi(
      tgt,
      address,
      user,
      password,
      port,
      protocol,
      interval
    )

    return resultAddVCenterAsync
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const updateVSphereAsync = (
  id: number,
  tgt: string,
  address: string,
  user: string,
  password: string,
  port: string,
  protocol: string,
  interval: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const vSpheres = await updateVSphereApi({
      id,
      tgt,
      address,
      user,
      password,
      port,
      protocol,
      interval,
    })

    return vSpheres
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const deleteVSphereAsync = (id: number, host: string) => async (
  dispatch: Dispatch<Action>
) => {
  try {
    const {status, statusText} = await deleteVSphereApi(id)

    if (status === 204 && statusText === 'No Content') {
      dispatch(removeVcenter(host))
      return 'DELETE_SUCCESS'
    }
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}
