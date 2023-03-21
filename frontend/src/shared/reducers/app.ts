// library
import {combineReducers} from 'redux'

// constants
import {
  AUTOREFRESH_DEFAULT,
  SHOW_TEMP_VAR_CONTROL_BAR_DEFAULT,
} from 'src/shared/constants'
import {CLOUD_AUTO_REFRESH} from 'src/clouds/constants/autoRefresh'

// actions
import {ActionTypes, Action} from 'src/types/actions/app'
import {CloudAction, CloudActionTypes} from 'src/clouds/types/actions/clouds'

// types
import {TimeZones} from 'src/types'
import {CloudAutoRefresh} from 'src/clouds/types/type'

interface State {
  ephemeral: {
    inPresentationMode: boolean
  }
  persisted: {
    autoRefresh: number
    cloudAutoRefresh: CloudAutoRefresh
    showTemplateVariableControlBar: boolean
    timeZone: TimeZones
  }
}

const initialState: State = {
  ephemeral: {
    inPresentationMode: false,
  },
  persisted: {
    autoRefresh: AUTOREFRESH_DEFAULT,
    cloudAutoRefresh: CLOUD_AUTO_REFRESH,
    showTemplateVariableControlBar: SHOW_TEMP_VAR_CONTROL_BAR_DEFAULT,
    timeZone: TimeZones.Local,
  },
}

const {
  ephemeral: initialAppEphemeralState,
  persisted: initialAppPersistedState,
} = initialState

const appEphemeralReducer = (
  state = initialAppEphemeralState,
  action: Action
) => {
  switch (action.type) {
    case ActionTypes.EnablePresentationMode: {
      return {
        ...state,
        inPresentationMode: true,
      }
    }

    case ActionTypes.DisablePresentationMode: {
      return {
        ...state,
        inPresentationMode: false,
      }
    }

    default:
      return state
  }
}

const appPersistedReducer = (
  state = initialAppPersistedState,
  action: Action | CloudAction
) => {
  switch (action.type) {
    case ActionTypes.SetAutoRefresh: {
      return {
        ...state,
        autoRefresh: action.payload.milliseconds,
      }
    }

    case ActionTypes.ToggleTemplateVariableControlBar: {
      const update = !state.showTemplateVariableControlBar
      return {
        ...state,
        showTemplateVariableControlBar: update,
      }
    }

    case ActionTypes.SetTimeZone: {
      const {timeZone} = action.payload

      return {
        ...state,
        timeZone,
      }
    }
    case CloudActionTypes.SetCloudAutoRefresh: {
      return {
        ...state,
        cloudAutoRefresh: {
          ...state.cloudAutoRefresh,
          ...action.payload.cloudAutoRefresh,
        },
      }
    }

    default:
      return state
  }
}

const appReducer = combineReducers<State>({
  ephemeral: appEphemeralReducer,
  persisted: appPersistedReducer,
})

export default appReducer
