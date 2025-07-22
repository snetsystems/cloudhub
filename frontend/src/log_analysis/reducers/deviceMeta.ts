import {DeviceToOrgMapping} from 'src/types'
import {
  SelectedDeviceAction,
  SelectedDeviceActionType,
} from 'src/log_analysis/actions'

interface SelectedDeviceState {
  selectedDevice: DeviceToOrgMapping | {}
}

const initialState: SelectedDeviceState = {
  selectedDevice: {},
}

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
