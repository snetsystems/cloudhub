import {Dispatch} from 'redux'
import {errorThrown} from 'src/shared/actions/errors'

// APIs
import {
  getMinionKeyAcceptedList,
  getVSphereInfoSaltApi,
  getTicketRemoteConsoleApi,
} from 'src/hosts/apis'

export enum ActionType {
  MinionKeyAcceptedList = 'GET_MINION_KEY_ACCEPTED_LIST',
}

interface MinionKeyAcceptedListAction {
  type: ActionType.MinionKeyAcceptedList
}

export type Action = MinionKeyAcceptedListAction

export const loadMinionKeyAcceptedList = (): MinionKeyAcceptedListAction => ({
  type: ActionType.MinionKeyAcceptedList,
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
) => async (dispatch: Dispatch<Action>): Promise<String[]> => {
  try {
    const vSphereInfo = await getVSphereInfoSaltApi(
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
