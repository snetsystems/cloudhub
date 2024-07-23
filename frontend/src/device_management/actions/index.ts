import {TimeRange} from 'src/types'

export type Action = PredictionTimeRangeAction | PredictionFilteredHexbin

export enum ActionType {
  setPredictionTimeRange = 'SET_PREDICTION_DASHBOARD',
  setFilteredHexbin = 'SET_FILTERED_HEXBIN',
}

interface PredictionTimeRangeAction {
  type: ActionType.setPredictionTimeRange
  payload: {
    predictionTimeRange: TimeRange
  }
}

interface PredictionFilteredHexbin {
  type: ActionType.setFilteredHexbin
  payload: {
    filteredHexbinHost: string
  }
}

export const setPredictionTimeRange = (
  predictionTimeRange: TimeRange
): PredictionTimeRangeAction => ({
  type: ActionType.setPredictionTimeRange,
  payload: {
    predictionTimeRange,
  },
})

export const setFilteredHexbin = (
  filteredHexbinHost: string
): PredictionFilteredHexbin => ({
  type: ActionType.setFilteredHexbin,
  payload: {
    filteredHexbinHost,
  },
})

// export const setPredictionTimeRange = (timeRange: TimeRange) => (
//   dispatch: Dispatch<Action>
// ): void => {
//   try {
//     dispatch(predictionTimeRange(timeRange))
//   } catch (error) {
//     console.error(error)
//     dispatch(errorThrown(error))
//   }
// }
