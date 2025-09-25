import {Dispatch} from 'redux'

import {getElasticSearchInfo} from 'src/shared/apis/elasticSearch'

import {errorThrown} from 'src/shared/actions/errors'
import {BaseElasticSearchData} from 'src/types'

export enum ElasticSearchActionTypes {
  ElasticSearchGetRequested = 'ELASTICSEARCH_GET_REQUESTED',
  ElasticSearchGetCompleted = 'ELASTICSEARCH_GET_COMPLETED',
  ElasticSearchGetFailed = 'ELASTICSEARCH_GET_FAILED',
  ElasticSearchUpdateRequested = 'ELASTICSEARCH_UPDATE_REQUESTED',
  ElasticSearchConnect = 'ELASTICSEARCH_CONNECT',
  ElasticSearchDisconnect = 'ELASTICSEARCH_DISCONNECT',
}

export type ElasticSearchAction =
  | ElasticSearchGetRequestedAction
  | ElasticSearchGetCompletedAction
  | ElasticSearchGetFailedAction
  | ElasticSearchUpdateRequestedAction
  | ElasticSearchConnectAction
  | ElasticSearchDisconnectAction
export interface ElasticSearchGetRequestedAction {
  type: ElasticSearchActionTypes.ElasticSearchGetRequested
}
const elasticSearchGetRequested = (): ElasticSearchGetRequestedAction => ({
  type: ElasticSearchActionTypes.ElasticSearchGetRequested,
})

export interface ElasticSearchGetCompletedAction {
  type: ElasticSearchActionTypes.ElasticSearchGetCompleted
  payload: {
    elasticSearchInfo: BaseElasticSearchData[]
  }
}
export const elasticSearchGetCompleted = (payload: {
  elasticSearchInfo: BaseElasticSearchData[]
}): ElasticSearchGetCompletedAction => ({
  type: ElasticSearchActionTypes.ElasticSearchGetCompleted,
  payload,
})

export interface ElasticSearchGetFailedAction {
  type: ElasticSearchActionTypes.ElasticSearchGetFailed
}
const elasticSearchGetFailed = (): ElasticSearchGetFailedAction => ({
  type: ElasticSearchActionTypes.ElasticSearchGetFailed,
})

export const getElasticSearchInfoAsync = () => async (
  dispatch: Dispatch<
    | ElasticSearchGetRequestedAction
    | ElasticSearchGetCompletedAction
    | ElasticSearchGetFailedAction
  >
): Promise<void> => {
  dispatch(elasticSearchGetRequested())
  try {
    const elasticSearchInfo = await getElasticSearchInfo()
    dispatch(elasticSearchGetCompleted({elasticSearchInfo}))
  } catch (error) {
    const message = `Failed to retrieve ElasticSearch information`
    dispatch(elasticSearchGetFailed())
    dispatch(errorThrown(error, message))
  }
}

export interface ElasticSearchUpdateRequestedAction {
  type: ElasticSearchActionTypes.ElasticSearchUpdateRequested
  payload: {
    elasticSearchInfo: BaseElasticSearchData
  }
}

export const updateElasticSearchInfo = (payload: {
  elasticSearchInfo: BaseElasticSearchData
}): ElasticSearchUpdateRequestedAction => ({
  type: ElasticSearchActionTypes.ElasticSearchUpdateRequested,
  payload,
})

export interface ElasticSearchConnectAction {
  type: ElasticSearchActionTypes.ElasticSearchConnect
  payload: {
    elasticSearchInfo: BaseElasticSearchData
  }
}

export const connectElasticSearch = (payload: {
  elasticSearchInfo: BaseElasticSearchData
}): ElasticSearchConnectAction => ({
  type: ElasticSearchActionTypes.ElasticSearchConnect,
  payload,
})

export interface ElasticSearchDisconnectAction {
  type: ElasticSearchActionTypes.ElasticSearchDisconnect
}

export const disconnectElasticSearch = (): ElasticSearchDisconnectAction => ({
  type: ElasticSearchActionTypes.ElasticSearchDisconnect,
})
