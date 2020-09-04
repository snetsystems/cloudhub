import {Dispatch, bindActionCreators} from 'redux'
import {errorThrown} from 'src/shared/actions/errors'
import _ from 'lodash'

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
import {notifyConnectVCenterFailed} from 'src/shared/copy/notifications'

export enum ActionTypes {
  MinionKeyAcceptedList = 'GET_MINION_KEY_ACCEPTED_LIST',
  LoadVcenters = 'LOAD_VCENTERS',
  AddVcenter = 'ADD_VCENTER',
  RemoveVcenter = 'REMOVE_VCENTER',
  UpdateVcenter = 'UPDATE_VCENTER',
}

export type Action =
  | MinionKeyAcceptedListAction
  | LoadVcentersAction
  | AddVcenterAction
  | RemoveVcenterAction
  | UpdateVcenterAction

interface MinionKeyAcceptedListAction {
  type: ActionTypes.MinionKeyAcceptedList
}

export const loadMinionKeyAcceptedList = (): MinionKeyAcceptedListAction => ({
  type: ActionTypes.MinionKeyAcceptedList,
})

interface LoadVcentersAction {
  type: ActionTypes.LoadVcenters
  payload: any
}
interface vSphere {
  id: number
  tgt: string
  address: string
  user: string
  password: string
  port: string
  protocol: string
  interval: string
}

interface vSpheres {
  [name: string]: vSphere
}

export const loadVcentersList = (vSpheres: vSpheres): LoadVcentersAction => ({
  type: ActionTypes.LoadVcenters,
  payload: vSpheres,
})

interface AddVcenterAction {
  type: ActionTypes.AddVcenter
  payload: any
}

export const addVcenterAction = (props): AddVcenterAction => ({
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
  payload: any
}

export const updateVcenter = (payload: any): UpdateVcenterAction => {
  return {
    type: ActionTypes.UpdateVcenter,
    payload,
  }
}

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
) => async (dispatch: Dispatch<Action>): Promise<any> => {
  try {
    const vSphereInfo = await getVSphereInfoSaltApi(
      pUrl,
      pToken,
      tgt,
      address,
      user,
      password,
      port,
      protocol
    )

    if (typeof _.values(vSphereInfo.return[0])[0] === 'string') {
      let error = Error(_.values(vSphereInfo.return[0])[0])
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

    dispatch(loadMinionKeyAcceptedList())
    return vSphereInfo
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

// CH DB VSHPERE API
export const getVSpheresAsync = () => async (dispatch: Dispatch<Action>) => {
  try {
    const data = await getVSpheresApi()

    let vSpheres = {}
    _.values(data).forEach(v => {
      vSpheres[v.host] = {
        ...v,
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

interface updateParams {
  id: number
  tgt?: string
  address?: string
  user?: string
  password?: string
  port?: string
  protocol?: string
  interval?: string
}

export const updateVSphereAsync = ({
  id,
  tgt,
  address,
  user,
  password,
  port,
  protocol,
  interval,
}: updateParams) => async (dispatch: Dispatch<Action>) => {
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

    // DB UPDATE 성공시
    // REDUX도 DISPATCH
    // dispatch()
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
    }
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}
