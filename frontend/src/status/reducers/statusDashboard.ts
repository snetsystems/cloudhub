import {TimeRange} from 'src/types'
import {Action, ActionTypes} from 'src/status/actions'

interface StatusDashboardState {
  histogramDate: TimeRange | null
  selectedAnomaly: {host: string; time: string}
  alertHostList: {warning: string[]; critical: string[]}
}

const initialState: StatusDashboardState = {
  histogramDate: null,
  selectedAnomaly: {host: '', time: ''},
  alertHostList: {warning: [], critical: []},
}

const statusDashboard = (
  state: StatusDashboardState = initialState,
  action: Action
): StatusDashboardState => {
  switch (action.type) {
    case ActionTypes.SET_STATUS_HISTOGRAM_DATE: {
      const {histogramDate} = action.payload
      return {...state, histogramDate}
    }
    case ActionTypes.SET_STATUS_SELECTED_ANOMALY: {
      const {selectedAnomaly} = action.payload
      return {...state, selectedAnomaly}
    }
    case ActionTypes.SET_STATUS_ALERT_HOST_LIST: {
      const {alertHostList} = action.payload
      return {...state, alertHostList}
    }
    case ActionTypes.RESET_STATUS_DASHBOARD: {
      return initialState
    }
    default:
      return state
  }
}

export default statusDashboard
