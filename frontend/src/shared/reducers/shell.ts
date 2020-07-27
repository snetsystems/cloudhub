import {Action, ActionTypes} from 'src/shared/actions/shell'
import {Shell} from 'src/types'

export const initialState: Shell = {
  isVisible: false,
  address: '',
}

const shell = (state: Shell = initialState, action: Action): Shell => {
  switch (action.type) {
    case ActionTypes.ShellOpen: {
      console.log('shell open')
      return {
        ...state,
        isVisible: true,
        address: action.payload.address,
      }
    }
    case ActionTypes.ShellClose: {
      console.log('shell close')
      return {
        ...state,
        isVisible: false,
      }
    }

    default: {
      return state
    }
  }
}
export default shell
