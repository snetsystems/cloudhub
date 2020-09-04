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
import {
  notifyConnectVCenterFailed,
  notifyConnectRemoteConsoleFailed,
} from 'src/shared/copy/notifications'

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

export const loadVcentersList = (vSpheres: vSphere[]): LoadVcentersAction => ({
  type: ActionTypes.LoadVcenters,
  payload: vSpheres,
})

interface AddVcenterAction {
  type: ActionTypes.AddVcenter
  payload: any
}

export const addVcenter = (): AddVcenterAction => ({
  type: ActionTypes.AddVcenter,
  payload: {},
})

interface RemoveVcenterAction {
  type: ActionTypes.RemoveVcenter
  payload: {
    id: number
  }
}

export const removeVcenter = (id: number): RemoveVcenterAction => ({
  type: ActionTypes.RemoveVcenter,
  payload: {
    id,
  },
})

interface UpdateVcenterAction {
  type: ActionTypes.UpdateVcenter
  payload: any
}

export const updateVcenter = (): UpdateVcenterAction => ({
  type: ActionTypes.UpdateVcenter,
  payload: {},
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
  protocol: string,
  interval: string
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

export const getVSpheresAsync = () => async (dispatch: Dispatch<Action>) => {
  try {
    const vSpheres = await getVSpheresApi()

    dispatch(loadVcentersList(vSpheres))
    return vSpheres
  } catch (error) {
    console.log(error)
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
    console.log(error)
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
    const vSpheres = await addVSphereApi(
      tgt,
      address,
      user,
      password,
      port,
      protocol,
      interval
    )
    return vSpheres
  } catch (error) {
    console.log(error)
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
    return vSpheres
  } catch (error) {
    console.log(error)
    dispatch(errorThrown(error))
  }
}

export const deleteVSphereAsync = (id: number) => async (
  dispatch: Dispatch<Action>
) => {
  try {
    const vSpheres = await deleteVSphereApi(id)
    return vSpheres
  } catch (error) {
    console.log(error)
    dispatch(errorThrown(error))
  }
}
