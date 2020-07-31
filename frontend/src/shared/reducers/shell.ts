import _ from 'lodash'

import {Action, ActionTypes} from 'src/shared/actions/shell'
import {Shells} from 'src/types'

export const initialState: Shells = {
  isVisible: false,
  tabIndex: 0,
  shells: [],
}

const nodenameIndex = (state: Shells, nodename: string): number =>
  _.findIndex(state.shells, s => s.nodename === nodename)

const nodenameChecker = (state: Shells, nodename: string) =>
  nodenameIndex(state, nodename) < 0

const shell = (state: Shells = initialState, action: Action): Shells => {
  switch (action.type) {
    case ActionTypes.ShellOpen: {
      const {payload} = action
      if (payload) {
        const isCheckNodeName = nodenameChecker(state, payload.nodename)

        if (isCheckNodeName) {
          return {
            ...state,
            tabIndex: state.shells.length,
            isVisible: true,
            shells: [...state.shells, payload],
          }
        } else {
          return {
            ...state,
            tabIndex: nodenameIndex(state, payload.nodename),
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
          tabIndex: state.shells.length,
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

        const index = nodenameIndex(state, nodename)
        Object.assign(state.shells[index], {
          ...action.payload,
          isNewEditor: false,
        })

        return state
      }
    }

    // remove logic test
    case ActionTypes.ShellRemove: {
      const index = nodenameIndex(state, action.payload)
      const currentSocket = state.shells[index].socket
      if (currentSocket) {
        currentSocket.close()
      }

      const copyCells = Object.values(Object.assign({}, state.shells))
      _.remove(copyCells, cell => cell.nodename === action.payload)

      return {
        ...state,
        tabIndex: index > 0 ? index - 1 : 0,
        shells: [...copyCells],
      }
    }

    case ActionTypes.ShellIndex: {
      return {
        ...state,
        tabIndex: action.payload,
      }
    }

    default: {
      return state
    }
  }
}
export default shell
