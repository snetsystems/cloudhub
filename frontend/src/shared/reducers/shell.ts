import _ from 'lodash'

import {Action, ActionTypes} from 'src/shared/actions/shell'
import {Shells, ShellInfo} from 'src/types'

export const initialState: Shells = {
  isVisible: false,
  shells: [],
}

const shell = (state: Shells = initialState, action: Action): Shells => {
  switch (action.type) {
    case ActionTypes.ShellOpen: {
      const {shell} = action.payload
      console.log(shell)
      if (state.shells.length > 1) {
        const isEqualNodeName = _.find(
          state.shells,
          s => s.nodename === shell.nodename
        )
        if (isEqualNodeName) {
          return {
            ...state,
            isVisible: true,
          }
        } else {
          return {
            ...state,
            isVisible: true,
            shells: [...state.shells, shell],
          }
        }
      } else {
        return {
          ...state,
          isVisible: true,
          shells: [...state.shells, shell],
        }
      }
    }
    case ActionTypes.ShellClose: {
      return {
        ...state,
        isVisible: false,
      }
    }

    // remove logic test
    case ActionTypes.ShellRemove: {
      const {payload} = action

      return {
        ...state,
        isVisible: true,
      }
    }

    default: {
      return state
    }
  }
}
export default shell
