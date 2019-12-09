// libraries
import _ from 'lodash'

import {ActionType} from 'src/agent_admin/actions/index'

export const initialState = {
  masterAddress: 'http://',
  masterId: 'AgentMaster',
  masterPassword: 'AgentPassword',
  masterToken: 'INEEDTOKEN',
}

export default (state = initialState, action) => {
  console.log('action?', action)
  switch (action.type) {
    case ActionType.UpdateMasterAddress: {
      return {
        ...state,
        masterAddress: action.payload.value,
      }
    }
  }
  return state
}
