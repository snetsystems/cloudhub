import _ from 'lodash'

import {Action, ActionTypes} from 'src/hosts/actions/index'

export const initialState = {}

const vm = (state = initialState, action: Action) => {
  switch (action.type) {
    case ActionTypes.LoadVcenters: {
      const {payload} = action
      if (payload) {
      }

      return {
        ...state,
      }
    }

    case ActionTypes.AddVcenter: {
      const {payload} = action
      if (payload) {
      }

      return {
        ...state,
      }
    }

    case ActionTypes.RemoveVcenter: {
      const {payload} = action
      if (payload) {
      }

      return {
        ...state,
      }
    }

    case ActionTypes.UpdateVcenter: {
      const {payload} = action
      if (payload) {
      }

      return {
        ...state,
      }
    }

    default: {
      return state
    }
  }
}
export default vm
