import {TimeRange} from 'src/types'

export type Action = PredictionTimeRangeAction

export enum ActionType {
  setPredictionTimeRange = 'SET_PREDICTION_DASHBOARD',
}

interface PredictionTimeRangeAction {
  type: ActionType.setPredictionTimeRange
  payload: {
    predictionTimeRange: TimeRange
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
