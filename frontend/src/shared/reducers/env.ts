import {ActionTypes, Action} from 'src/types/actions/app'
import {Env} from 'src/types/'

const initialState: Env = {
  telegrafSystemInterval: '1m',
}

const envReducer = (state = initialState, action: Action) => {
  switch (action.type) {
    case ActionTypes.SetTelegrafSystemInterval: {
      const {telegrafSystemInterval} = action.payload
      return {
        ...state,
        telegrafSystemInterval,
      }
    }

    default:
      return state
  }
}

export default envReducer
