import _ from 'lodash'

import {Action, ActionTypes} from 'src/hosts/actions/index'

export const initialState = {}

const vspheres = (state = initialState, action: Action) => {
  switch (action.type) {
    case ActionTypes.LoadVcenters: {
      state = {
        ...state,
        ...action.payload,
      }
      return state
    }

    case ActionTypes.AddVcenter: {
      return {
        ...state,
        ...action.payload,
      }
    }

    case ActionTypes.RemoveVcenter: {
      let removeState = {...state}
      delete removeState[action.payload.host]

      return {
        ...removeState,
      }
    }

    case ActionTypes.UpdateVcenter: {
      const {payload} = action
      if (payload) {
      }

      let updateState = {...state}
      updateState[payload.host] = {
        ...updateState[payload.host],
        ...payload,
      }

      return updateState
    }

    case ActionTypes.UpdateVcenters: {
      const {payload} = action
      const updateState = {...state}

      payload.forEach((p: any) => {
        if (
          p.host === updateState[p.host].host &&
          p.minion === updateState[p.host].minion
        ) {
          updateState[p.host] = {
            ...updateState[p.host],
            nodes: p.nodes,
          }
        }
      })

      return updateState
    }

    default: {
      return state
    }
  }
}
export default vspheres
