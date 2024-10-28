import {
  AlertHostList,
  AnomalyFactor,
  INPUT_TIME_TYPE,
  TimeRange,
} from 'src/types'
import {Action, ActionType} from '../actions'
import {ANOMALY_INITIAL} from '../constants'

interface TimeRangeState {
  predictionTimeRange: TimeRange
  filteredHexbinHost: string
  alertHostList: AlertHostList
  selectedAnomaly: AnomalyFactor
  histogramDate: TimeRange
  predictionManualRefresh: number
}
const initialState: TimeRangeState = {
  predictionTimeRange: {
    lower: 'now() - 30d',
    lowerFlux: '-30d',
    upper: null,
    format: INPUT_TIME_TYPE.RELATIVE_TIME,
  },
  filteredHexbinHost: '',
  alertHostList: {warning: [], critical: []},
  selectedAnomaly: ANOMALY_INITIAL,
  histogramDate: null,
  predictionManualRefresh: 0,
}

const predictionDashboard = (
  state: TimeRangeState = initialState,
  action: Action
) => {
  switch (action.type) {
    case ActionType.setPredictionTimeRange: {
      const {predictionTimeRange} = action.payload
      return {...state, predictionTimeRange}
    }
    case ActionType.setFilteredHexbin: {
      const {filteredHexbinHost} = action.payload
      return {...state, filteredHexbinHost}
    }
    case ActionType.setAlertHostList: {
      const {alertHostList} = action.payload
      return {...state, alertHostList}
    }
    case ActionType.setSelectedAnomaly: {
      const {selectedAnomaly} = action.payload
      return {...state, selectedAnomaly}
    }
    case ActionType.setHistogramDate: {
      const {histogramDate} = action.payload
      return {...state, histogramDate}
    }
    case ActionType.setPredictionManualRefresh: {
      const {predictionManualRefresh} = action.payload
      return {...state, predictionManualRefresh}
    }
    case ActionType.setStateInit: {
      return {
        ...state,
        filteredHexbinHost: '',
        selectedAnomaly: ANOMALY_INITIAL,
        histogramDate: null,
      }
    }
    default:
      return state
  }
}

export default predictionDashboard
