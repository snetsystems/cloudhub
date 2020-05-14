import {Dispatch} from 'redux'
import {AxiosResponse} from 'axios'
import {errorThrown} from 'src/shared/actions/errors'

// Types
import {MinionsObject} from 'src/agent_admin/type'
import {Source} from 'src/types'

// APIs
import {
  getMinionKeyListAllAdmin,
  getMinionKeyListAll,
  getMinionsIP,
  getMinionsOS,
} from 'src/agent_admin/apis'

// SaltStack
import {
  getLocalGrainsItem,
  runAcceptKey,
  runRejectKey,
  runDeleteKey,
} from 'src/shared/apis/saltStack'

export enum ActionType {
  MinionKeyListAllAdmin = 'GET_MINION_KEY_LIST_ALL_ADMIN',
  MinionKeyListAll = 'GET_MINION_KEY_LIST_ALL',
  MinionsIP = 'GET_MINION_IP',
  MinionsOS = 'GET_MINION_OS',
  LocalGrainsItem = 'LOCAL_GRAINS_ITEM',
  RunAcceptKey = 'RUN_ACCEEPT_KEY',
  RunRejectKey = 'RUN_REJECT_KEY',
  RunDeleteKey = 'RUN_DELETE_KEY',
}

interface MinionKeyListAllActionAdmin {
  type: ActionType.MinionKeyListAllAdmin
}

interface MinionKeyListAllAction {
  type: ActionType.MinionKeyListAll
}

interface MinionIPAction {
  type: ActionType.MinionsIP
}

interface MinionOSAction {
  type: ActionType.MinionsOS
}

interface LocalGrainsItemAction {
  type: ActionType.LocalGrainsItem
}

interface RunAcceptKeyAction {
  type: ActionType.RunAcceptKey
}

interface RunRejectKeyAction {
  type: ActionType.RunRejectKey
}

interface RunDeleteKeyAction {
  type: ActionType.RunDeleteKey
}

export type Action =
  | MinionKeyListAllActionAdmin
  | MinionKeyListAllAction
  | MinionIPAction
  | MinionOSAction
  | LocalGrainsItemAction
  | RunAcceptKeyAction
  | RunRejectKeyAction
  | RunDeleteKeyAction

export const loadMinionKeyListAllAdmin = (): MinionKeyListAllActionAdmin => ({
  type: ActionType.MinionKeyListAllAdmin,
})

export const loadMinionKeyListAll = (): MinionKeyListAllAction => ({
  type: ActionType.MinionKeyListAll,
})

export const loadMinionIP = (): MinionIPAction => ({
  type: ActionType.MinionsIP,
})

export const loadMinionOS = (): MinionOSAction => ({
  type: ActionType.MinionsOS,
})

export const loadLocalGrainsItem = (): LocalGrainsItemAction => ({
  type: ActionType.LocalGrainsItem,
})

export const cmdRunAcceptKey = (): RunAcceptKeyAction => ({
  type: ActionType.RunAcceptKey,
})

export const cmdRunRejectKey = (): RunRejectKeyAction => ({
  type: ActionType.RunRejectKey,
})

export const cmdRunDeleteKey = (): RunDeleteKeyAction => ({
  type: ActionType.RunDeleteKey,
})

export const getMinionKeyListAllAsyncAdmin = (
  pUrl: string,
  pToken: string,
  pSource: Source,
  meRole: string
) => async (dispatch: Dispatch<Action>): Promise<MinionsObject> => {
  try {
    const minions: MinionsObject = await getMinionKeyListAllAdmin(
      pUrl,
      pToken,
      pSource,
      meRole
    )

    dispatch(loadMinionKeyListAllAdmin())
    return minions
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error, `${error.status}: ${error.statusText}`))
  }
}

export const getMinionKeyListAllAsync = (
  pUrl: string,
  pToken: string
) => async (dispatch: Dispatch<Action>): Promise<MinionsObject> => {
  try {
    const minions: MinionsObject = await getMinionKeyListAll(pUrl, pToken)

    dispatch(loadMinionKeyListAll())
    return minions
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error, `${error.status}: ${error.statusText}`))
  }
}

export const getMinionsIPAsync = (
  pUrl: string,
  pToken: string,
  pMinions: MinionsObject
) => async (dispatch: Dispatch<Action>): Promise<MinionsObject> => {
  try {
    const minions: MinionsObject = await getMinionsIP(pUrl, pToken, pMinions)

    dispatch(loadMinionIP())
    return minions
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getMinionsOSAsync = (
  pUrl: string,
  pToken: string,
  pMinions: MinionsObject
) => async (dispatch: Dispatch<Action>): Promise<MinionsObject> => {
  try {
    const minions: MinionsObject = await getMinionsOS(pUrl, pToken, pMinions)

    dispatch(loadMinionOS())
    return minions
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalGrainsItemAsync = (
  pUrl: string,
  pToken: string,
  pMinions: string
) => async (dispatch: Dispatch<Action>): Promise<AxiosResponse> => {
  try {
    const minions: AxiosResponse = await getLocalGrainsItem(
      pUrl,
      pToken,
      pMinions
    )

    dispatch(loadLocalGrainsItem())
    return minions
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const runAcceptKeyAsync = (
  pUrl: string,
  pToken: string,
  pMinions: string
) => async (dispatch: Dispatch<Action>): Promise<AxiosResponse> => {
  try {
    const minions: AxiosResponse = await runAcceptKey(pUrl, pToken, pMinions)

    dispatch(cmdRunAcceptKey())
    return minions
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const runRejectKeyAsync = (
  pUrl: string,
  pToken: string,
  pMinions: string
) => async (dispatch: Dispatch<Action>): Promise<AxiosResponse> => {
  try {
    const minions: AxiosResponse = await runRejectKey(pUrl, pToken, pMinions)

    dispatch(cmdRunRejectKey())
    return minions
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const runDeleteKeyAsync = (
  pUrl: string,
  pToken: string,
  pMinions: string
) => async (dispatch: Dispatch<Action>): Promise<AxiosResponse> => {
  try {
    const minions: AxiosResponse = await runDeleteKey(pUrl, pToken, pMinions)

    dispatch(cmdRunDeleteKey())
    return minions
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}
