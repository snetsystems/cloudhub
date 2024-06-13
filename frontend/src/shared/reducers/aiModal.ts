import {ComponentColor} from 'src/reusable_ui'
import {AiModal} from 'src/types'
import {Action, ActionTypes} from '../actions/aiModal'

const initialState: AiModal = {
  isVisible: false,
  message: '',
  confirmText: '',
  cancelText: '',
  isOneBtn: false,
  btnColor: ComponentColor.Success,
}

const aiModal = (state: AiModal = initialState, action: Action) => {
  switch (action.type) {
    case ActionTypes.ModalOpen: {
      const {payload} = action
      return {
        ...state,
        ...payload,
        isVisible: true,
      }
    }

    case ActionTypes.ModalClose: {
      return {
        ...initialState,
      }
    }

    default: {
      return state
    }
  }
}
export default aiModal
