import {Dispatch, bindActionCreators} from 'redux'
import {errorThrown} from 'src/shared/actions/errors'
import _ from 'lodash'

// APIs
import {
  getMinionKeyAcceptedList,
  getVSphereInfoSaltApi,
  getTicketRemoteConsoleApi,
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

export const loadVcentersList = (): LoadVcentersAction => ({
  type: ActionTypes.LoadVcenters,
  payload: {},
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
  payload: any
}

export const removeVcenter = (): RemoveVcenterAction => ({
  type: ActionTypes.RemoveVcenter,
  payload: {},
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
  password: string
) => async (dispatch: Dispatch<Action>): Promise<any> => {
  try {
    const vSphereInfo = await getVSphereInfoSaltApi(
      pUrl,
      pToken,
      tgt,
      address,
      user,
      password
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
