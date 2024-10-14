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
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'
import {CLOUD_TIME_RANGE} from '../data/timeRanges'

interface State {
  ephemeral: {
    inPresentationMode: boolean
  }
  persisted: {
    autoRefresh: number
    cloudAutoRefresh: CloudAutoRefresh
    showTemplateVariableControlBar: boolean
    timeZone: TimeZones
    cloudTimeRange: CloudTimeRange
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
    cloudTimeRange: CLOUD_TIME_RANGE,
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
    case CloudActionTypes.SetCloudTimeRange: {
      return {
        ...state,
        cloudTimeRange: {
          ...state.cloudTimeRange,
          ...action.payload.cloudTimeRange,
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
