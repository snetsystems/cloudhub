import {
  AiAgentsDrawerAction,
  AiAgentsDrawerActionTypes,
} from 'src/shared/actions/aiAgentsDrawer'

export interface AiAgentsDrawerState {
  isOpen: boolean
}

const initialState: AiAgentsDrawerState = {
  isOpen: false,
}

const aiAgentsDrawerReducer = (
  state = initialState,
  action: AiAgentsDrawerAction
): AiAgentsDrawerState => {
  switch (action.type) {
    case AiAgentsDrawerActionTypes.TOGGLE:
      return {...state, isOpen: !state.isOpen}
    case AiAgentsDrawerActionTypes.OPEN:
      return {...state, isOpen: true}
    default:
      return state
  }
}

export default aiAgentsDrawerReducer
