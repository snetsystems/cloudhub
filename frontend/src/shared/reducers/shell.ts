import _ from 'lodash'

import {Action, ActionTypes} from 'src/shared/actions/shell'
import {Shells} from 'src/types'

export const initialState: Shells = {
  isVisible: false,
  shells: [],
}

const nodenameChecker = (state: Shells, nodename: string) => {
  const isNodeNameOverlap =
    _.findIndex(state.shells, s => s.nodename === nodename) < 0

  return isNodeNameOverlap
}

const shell = (state: Shells = initialState, action: Action): Shells => {
  switch (action.type) {
    case ActionTypes.ShellOpen: {
      const {payload} = action
      if (payload) {
        const isCheckNodeName = nodenameChecker(state, payload.nodename)

        if (isCheckNodeName) {
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
      }

      return {
        ...state,
        isVisible: true,
      }
    }

    case ActionTypes.ShellClose: {
      return {
        ...state,
        isVisible: false,
      }
    }

    case ActionTypes.ShellAdd: {
      const {isNewEditor, nodename} = action.payload
      const isCheckNodeName = nodenameChecker(state, nodename)

      if (isNewEditor && isCheckNodeName) {
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
      const {isNewEditor, nodename} = action.payload
      const isCheckNodeName = nodenameChecker(state, nodename)

      if (isNewEditor && nodename !== 'New' && isCheckNodeName) {
        const index = _.findIndex(state.shells, s => s.isNewEditor === true)
        Object.assign(state.shells[index], {
          ...action.payload,
          isNewEditor: false,
        })

        return {
          ...state,
          shells: [...state.shells],
        }
      } else {
        if (nodename !== 'New' && isCheckNodeName) {
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
      const copyCells = Object.values(Object.assign({}, state.shells))
      _.remove(copyCells, cell => cell.nodename === action.payload)

      return {
        ...state,
        shells: [...copyCells],
      }
    }

    default: {
      return state
    }
  }
}
export default shell
