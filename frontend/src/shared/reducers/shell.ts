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

const getTabkey = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min)) + min

const shell = (state: Shells = initialState, action: Action): Shells => {
  switch (action.type) {
    case ActionTypes.ShellOpen: {
      const {payload} = action
      if (payload) {
        const isCheckNodeName = nodenameChecker(state, payload.nodename)

        if (isCheckNodeName) {
          const tabkey = getTabkey(1, 99999)
          return {
            ...state,
            tabIndex: state.shells.length,
            isVisible: true,
            shells: [...state.shells, Object.assign(payload, {tabkey})],
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
        const tabkey = getTabkey(1, 99999)
        return {
          ...state,
          tabIndex: state.shells.length,
          shells: [...state.shells, {isNewEditor: true, nodename, tabkey}],
        }
      }

      return {
        ...state,
        isVisible: true,
      }
    }

    case ActionTypes.ShellUpdate: {
      const payload = action.payload
      let nodename = payload.nodename
      const isCheckNodeName = nodenameChecker(state, nodename)

      if (isCheckNodeName) {
        nodename = action.payload.preNodename
      }
      const index = nodenameIndex(state, nodename)
      Object.assign(state.shells[index], {
        ...action.payload,
        isNewEditor: true,
      })

      return state
    }

    case ActionTypes.ShellRemove: {
      const index = nodenameIndex(state, action.payload)
      const currentSocket = state.shells[index].socket
      if (currentSocket) {
        currentSocket.close()
      }

      const dummyShellIndex = state.shells.length - 2
      const nodeIndex = dummyShellIndex > index ? index : dummyShellIndex

      const copyCells = Object.values(Object.assign({}, state.shells))
      _.remove(copyCells, cell => cell.nodename === action.payload)

      return {
        ...state,
        tabIndex: nodeIndex,
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
