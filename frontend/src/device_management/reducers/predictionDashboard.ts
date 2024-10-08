import {AnomalyFactor, INPUT_TIME_TYPE, TimeRange} from 'src/types'
import {Action, ActionType} from '../actions'

interface TimeRangeState {
  predictionTimeRange: TimeRange
  filteredHexbinHost: string
  alertHostList: string[]
  selectedAnomaly: AnomalyFactor
  histogramDate: TimeRange
}
const initialState: TimeRangeState = {
  predictionTimeRange: {
    lower: 'now() - 30d',
    lowerFlux: '-30d',
    upper: null,
    format: INPUT_TIME_TYPE.RELATIVE_TIME,
  },
  filteredHexbinHost: '',
  alertHostList: [],
  selectedAnomaly: {
    host: '',
    time: '',
  },
  histogramDate: null,
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
    default:
      return state
  }
}

export default predictionDashboard
