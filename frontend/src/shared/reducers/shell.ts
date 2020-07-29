import _ from 'lodash'

import {Action, ActionTypes} from 'src/shared/actions/shell'
import {Shells, ShellInfo, ShellLoad} from 'src/types'

export const initialState: Shells = {
  isVisible: false,
  shells: [],
}

const shell = (state: Shells = initialState, action: Action): Shells => {
  switch (action.type) {
    // open
    case ActionTypes.ShellOpen: {
      const {payload} = action

      if (payload) {
        const isCheckNodeName = _.findIndex(
          state.shells,
          (s: ShellLoad['shell']) => s.nodename === payload.nodename
        )

        if (isCheckNodeName < 0) {
          return {
            ...state,
            isVisible: true,
            shells: [...state.shells, payload],
          }
        } else {
          return {
            ...state,
            isVisible: true,
          }
        }
      } else {
        return {
          ...state,
          isVisible: true,
        }
      }
    }

    // close
    case ActionTypes.ShellClose: {
      return {
        ...state,
        isVisible: false,
      }
    }
    // add logic
    case ActionTypes.ShellAdd: {
      const {isNewEditor, nodename}: ShellInfo = action.payload

      const isCheckNodeName = _.findIndex(
        state.shells,
        (s: ShellLoad['shell']) => s.nodename === nodename
      )

      console.log(isNewEditor && !isCheckNodeName, {isCheckNodeName})

      if (isNewEditor && isCheckNodeName < 0) {
        return {
          ...state,
          shells: [...state.shells, {isNewEditor: true, nodename}],
        }
      }

      return {
        ...state,
        isVisible: true,
      }
    }

    // updatel log
    case ActionTypes.ShellUpdate: {
      const {payload} = action
      const isCheckNodeName =
        _.findIndex(state.shells, s => s.nodename === payload.nodename) < 0

      if (
        payload.isNewEditor &&
        payload.nodename !== 'New' &&
        isCheckNodeName
      ) {
        const index = _.findIndex(state.shells, s => s.isNewEditor === true)
        Object.assign(state.shells[index], {...payload, isNewEditor: false})

        return {
          ...state,
          shells: [...state.shells],
        }
      } else {
        if (payload.nodename !== 'New' && isCheckNodeName) {
          return {
            ...state,
            shells: [...state.shells],
          }
        }
        return state
      }
    }

    // remove logic test
    case ActionTypes.ShellRemove: {
      const {payload} = action
      const index = _.findIndex(state.shells, s => s.nodename === payload)
      state.shells.splice(index, 1)
      return {
        ...state,
        shells: [...state.shells],
      }
    }

    default: {
      return state
    }
  }
}
export default shell
