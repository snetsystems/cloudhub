import {
  ElasticSearchActionTypes,
  ElasticSearchConnectAction,
  ElasticSearchGetCompletedAction,
  ElasticSearchGetFailedAction,
  ElasticSearchGetRequestedAction,
  ElasticSearchUpdateRequestedAction,
} from 'src/shared/actions/elasticSearch'
import {ElasticSearchState} from 'src/types'

const initialState: ElasticSearchState = {
  isFetching: false,
  error: null,
  esSources: [],
}

const esSourcesReducer = (
  state = initialState,
  action:
    | ElasticSearchGetRequestedAction
    | ElasticSearchGetCompletedAction
    | ElasticSearchGetFailedAction
    | ElasticSearchUpdateRequestedAction
    | ElasticSearchConnectAction
): ElasticSearchState => {
  switch (action.type) {
    case ElasticSearchActionTypes.ElasticSearchGetRequested: {
      return {
        ...state,
        isFetching: true,
        error: null,
      }
    }

    case ElasticSearchActionTypes.ElasticSearchGetCompleted: {
      const {elasticSearchInfo} = action.payload
      return {
        ...state,
        isFetching: false,
        error: null,
        esSources: elasticSearchInfo,
      }
    }

    case ElasticSearchActionTypes.ElasticSearchGetFailed: {
      return {
        ...state,
        isFetching: false,
        error: 'Failed to fetch ElasticSearch info',
      }
    }

    case ElasticSearchActionTypes.ElasticSearchUpdateRequested: {
      const {elasticSearchInfo} = action.payload
      return {
        ...state,
        esSources: [...state.esSources, elasticSearchInfo],
      }
    }

    default:
      return state
  }
}

export default esSourcesReducer
