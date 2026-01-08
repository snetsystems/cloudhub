import {
  SidePanelActionTypes,
  SidePanelAction,
} from 'src/shared/actions/sidePanel'
import {SidePanelState} from 'src/types'

const initialState: SidePanelState = {
  isOpen: false,
  panelProps: null,
  width: 300,
}

const sidePanelReducer = (
  state = initialState,
  action: SidePanelAction
): SidePanelState => {
  switch (action.type) {
    case SidePanelActionTypes.OPEN_PANEL:
      return {
        ...state,
        isOpen: true,
        panelProps: action.payload.panelProps || null,
        width: action.payload.width,
      }
    case SidePanelActionTypes.CLOSE_PANEL:
      return {
        ...state,
        isOpen: false,
        width: 300,
      }
    default:
      return state
  }
}

export default sidePanelReducer
