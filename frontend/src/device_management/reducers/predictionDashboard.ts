import {INPUT_TIME_TYPE, TimeRange} from 'src/types'
import {Action, ActionType} from '../actions'

interface TimeRangeState {
  predictionTimeRange: TimeRange
}
const initialState: TimeRangeState = {
  predictionTimeRange: {
    lower: 'now() - 30d',
    lowerFlux: '-30d',
    upper: null,
    format: INPUT_TIME_TYPE.RELATIVE_TIME,
  },
}

const predictionTimeRange = (
  state: TimeRangeState = initialState,
  action: Action
) => {
  switch (action.type) {
    case ActionType.setPredictionTimeRange: {
      const {predictionTimeRange} = action.payload
      return {...state, predictionTimeRange}
    }
    default:
      return state
  }
}

export default predictionTimeRange
