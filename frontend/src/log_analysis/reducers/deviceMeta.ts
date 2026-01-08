// Libraries
import {DeviceMeta} from 'src/types'

// Types
import {
  SelectedDeviceAction,
  SelectedDeviceActionType,
} from 'src/log_analysis/actions'

// Types
interface SelectedDeviceState {
  selectedDevice: DeviceMeta | {}
}

// Constants
const initialState: SelectedDeviceState = {
  selectedDevice: {},
}

// Reducer
const selectedDeviceReducer = (
  state: SelectedDeviceState = initialState,
  action: SelectedDeviceAction
): SelectedDeviceState => {
  switch (action.type) {
    case SelectedDeviceActionType.setSelectedDevice: {
      const {selectedDevice} = action.payload
      return {...state, selectedDevice}
    }
    case SelectedDeviceActionType.resetSelectedDevice: {
      return {
        ...state,
        selectedDevice: {},
      }
    }
    default:
      return state
  }
}

export default selectedDeviceReducer
