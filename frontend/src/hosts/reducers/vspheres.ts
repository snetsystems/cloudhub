import _ from 'lodash'

import {Action, ActionTypes} from 'src/hosts/actions/index'
import {VcenterStatus, reducerVSphere} from 'src/hosts/types'

export const initialState = {
  vspheres: {},
  status: VcenterStatus.Request,
}

const vspheres = (state: reducerVSphere = initialState, action: Action) => {
  switch (action.type) {
    case ActionTypes.RequestLoadVcenters: {
      return {...state, ...initialState}
    }

    case ActionTypes.LoadVcenters: {
      let loadVcenters = {...state}

      loadVcenters = {
        ...loadVcenters,
        vspheres: {
          ...loadVcenters.vspheres,
          ...action.payload,
        },
      }

      return loadVcenters
    }

    case ActionTypes.AddVcenter: {
      let addVcenter = {...state}

      addVcenter = {
        ...addVcenter,
        vspheres: {
          ...addVcenter.vspheres,
          ...action.payload,
        },
      }

      return addVcenter
    }

    case ActionTypes.RemoveVcenter: {
      let removeState = {...state}
      delete removeState.vspheres[action.payload.host]

      return {
        ...removeState,
      }
    }

    case ActionTypes.UpdateVcenter: {
      const {payload} = action
      let updateState = {...state}
      if (payload?.id) {
        _.forEach(_.keys(updateState.vspheres), key => {
          if (updateState.vspheres[key].id === payload.id) {
            delete updateState.vspheres[key]
            updateState.vspheres[payload.host] = {
              ...payload,
            }
          }
        })
      }

      return updateState
    }

    case ActionTypes.UpdateVcenters: {
      const {payload} = action
      const updateState = {...state}

      _.forEach(payload, p => {
        if (
          p.host === updateState.vspheres[p.host].host &&
          p.minion === updateState.vspheres[p.host].minion
        ) {
          updateState.vspheres[p.host] = {
            ...updateState.vspheres[p.host],
            ...p,
          }
        }
      })

      return updateState
    }

    case ActionTypes.RequestVcenter: {
      return {
        ...state,
        status: VcenterStatus.Request,
      }
    }

    case ActionTypes.ResponseVcenter: {
      return {
        ...state,
        status: VcenterStatus.Response,
      }
    }

    case ActionTypes.RequestPauseVcenter: {
      const {host, isPause} = action.payload
      const pauseVcenter = {...state.vspheres}
      pauseVcenter[host] = {
        ...pauseVcenter[host],
        isPause,
      }

      return {
        ...state,
        vspheres: pauseVcenter,
      }
    }

    case ActionTypes.RequestRunVcenter: {
      const {host, isPause} = action.payload
      const runVcenter = {...state.vspheres}
      runVcenter[host] = {
        ...runVcenter[host],
        isPause,
      }
      return {
        ...state,
        vspheres: runVcenter,
      }
    }

    default: {
      return state
    }
  }
}
export default vspheres
