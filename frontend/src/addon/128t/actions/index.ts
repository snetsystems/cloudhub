import {Dispatch} from 'redux'
import {errorThrown} from 'src/shared/actions/errors'

// Types
import {Source} from 'src/types'

// APIs
import {getAllHosts} from 'src/shared/apis/multiTenant'
import {HostNames} from 'src/types/hosts'

export enum ActionType {
  AllHosts = 'GET_ALL_HOSTS',
}

interface AllHostsAction {
  type: ActionType.AllHosts
}

export type Action = AllHostsAction

export const loadAllHosts = (): AllHostsAction => ({
  type: ActionType.AllHosts,
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
    dispatch(errorThrown(error, `${error.status}: ${error.statusText}`))
  }
}
