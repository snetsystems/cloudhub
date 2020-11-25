import _ from 'lodash'
import {Dispatch} from 'redux'

import {getKubernetesAllNodes} from 'src/shared/apis/saltStack'
import {errorThrown} from 'src/shared/actions/errors'

export type KubernetesAction =
  | KubernetesAllNodesGetRequestedAction
  | KubernetesAllNodesGetCompletedAction
  | KubernetesAllNodesGetFailedAction

export enum KubernetesActionTypes {
  KubernetesAllNodesGetRequested = 'KUBERNETES_ALL_NODES_GET_REQUESTED',
  KubernetesAllNodesGetCompleted = 'KUBERNETES_ALL_NODES_GET_COMPLETED',
  KubernetesAllNodesGetFailed = 'KUBERNETES_ALL_NODES_GET_FAILED',
}

interface KubernetesAllNodesGetRequestedAction {
  type: KubernetesActionTypes.KubernetesAllNodesGetRequested
}

export const kubernetesAllNodesGetRequested = (): KubernetesAllNodesGetRequestedAction => ({
  type: KubernetesActionTypes.KubernetesAllNodesGetRequested,
})

interface KubernetesAllNodesGetCompletedAction {
  type: KubernetesActionTypes.KubernetesAllNodesGetCompleted
}

export const kubernetesAllNodesGetCompleted = (): KubernetesAllNodesGetCompletedAction => ({
  type: KubernetesActionTypes.KubernetesAllNodesGetCompleted,
})

interface KubernetesAllNodesGetFailedAction {
  type: KubernetesActionTypes.KubernetesAllNodesGetFailed
}

export const kubernetesAllNodesGetFailed = (): KubernetesAllNodesGetFailedAction => ({
  type: KubernetesActionTypes.KubernetesAllNodesGetFailed,
})

export const getKubernetesAllNodesAsync = (
  pUrl: string,
  pToken: string
) => async (dispatch: Dispatch<KubernetesAction>): Promise<string[]> => {
  const minions = []
  try {
    dispatch(kubernetesAllNodesGetRequested())
    const {data} = await getKubernetesAllNodes(pUrl, pToken)

    _.forEach(_.keys(data.return[0]), k => {
      if (Array.isArray(data.return[0][k]) && data.return[0][k]?.length) {
        minions.push(...data.return[0][k])
      }
    })
    dispatch(kubernetesAllNodesGetCompleted())
  } catch (error) {
    dispatch(errorThrown(error))
    dispatch(kubernetesAllNodesGetFailed())
  }
  return minions
}
