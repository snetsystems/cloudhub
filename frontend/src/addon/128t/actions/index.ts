import {Dispatch} from 'redux'
import {errorThrown} from 'src/shared/actions/errors'

// Types
import {Source} from 'src/types'

// APIs
import {getAllHosts, getAllHostsAndStatus} from 'src/shared/apis/multiTenant'
import {HostNames} from 'src/types/hosts'

interface HostsObject {
  [x: string]: Host
}

export interface Host {
  name: string
  deltaUptime?: number
  winDeltaUptime?: number
}

export enum ActionType {
  AllHosts = 'GET_ALL_HOSTS',
  AllHostsAndStatus = 'GET_ALL_HOSTS_STATUS',
}

interface AllHostsAction {
  type: ActionType.AllHosts
}
interface AllHostsAndStatusAction {
  type: ActionType.AllHostsAndStatus
}

export type Action = AllHostsAction | AllHostsAndStatusAction

export const loadAllHosts = (): AllHostsAction => ({
  type: ActionType.AllHosts,
})

export const loadAllHostsAndStatus = (): AllHostsAndStatusAction => ({
  type: ActionType.AllHostsAndStatus,
})

export const getAllHostsAsync = (pSource: Source) => async (
  dispatch: Dispatch<Action>
): Promise<HostNames> => {
  try {
    const hosts: HostNames = await getAllHosts(pSource)

    dispatch(loadAllHosts())
    return hosts
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getAllHostsAndStatusAsync = (pSource: Source) => async (
  dispatch: Dispatch<Action>
): Promise<HostsObject> => {
  try {
    const hosts: HostsObject = await getAllHostsAndStatus(pSource)

    dispatch(loadAllHostsAndStatus())
    return hosts
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}
