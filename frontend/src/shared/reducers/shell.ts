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
      return {
        ...state,
        isVisible: true,
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
      // console.log({shell})

      if (isNewEditor && isCheckNodeName < 0) {
        return {
          ...state,
          shells: [...state.shells, {isNewEditor: true, nodename}],
        }
      }
      // console.log(shell.isNewEditor)

      // if (state.shells.length > 1) {
      //   const isEqualNodeName = _.find(
      //     state.shells,
      //     s => s.nodename === shell.nodename
      //   )
      //   if (isEqualNodeName) {
      //     return {
      //       ...state,
      //       isVisible: true,
      //     }
      //   } else {
      //     return {
      //       ...state,
      //       isVisible: true,
      //       shells: [...state.shells, shell],
      //     }
      //   }
      // } else {
      //   return {
      //     ...state,
      //     isVisible: true,
      //     shells: [...state.shells, shell],
      //   }
      // }
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
