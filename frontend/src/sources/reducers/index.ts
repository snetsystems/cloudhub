import _ from 'lodash'

import {Action, ActionTypes} from 'src/sources/actions'

export const initialState = {
  sourceID: null,
}

const source = (state = initialState, action: Action) => {
  switch (action.type) {
    case ActionTypes.ConnectedSource: {
      return {...state, sourceID: action.payload}
    }
    case ActionTypes.DeletedSource: {
      const sourceID = state.sourceID === action.payload ? null : state.sourceID
      return {...state, sourceID}
    }
    default: {
      return state
    }
  }
}

export default source
