import {AnomalyFactor, TimeRange} from 'src/types'

export type Action =
  | PredictionTimeRangeAction
  | PredictionFilteredHexbin
  | AlertHostList
  | SelectedAnomaly
  | HistogramDateAction

export enum ActionType {
  setPredictionTimeRange = 'SET_PREDICTION_DASHBOARD',
  setFilteredHexbin = 'SET_FILTERED_HEXBIN',
  setAlertHostList = 'SET_ALERT_HOST_LIST',
  setSelectedAnomaly = 'SET_SELECTED_ANOMALY',
  setHistogramDate = 'SET_HISTOGRAM_DATE',
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

interface AlertHostList {
  type: ActionType.setAlertHostList
  payload: {
    alertHostList: string[]
  }
}
interface SelectedAnomaly {
  type: ActionType.setSelectedAnomaly
  payload: {
    selectedAnomaly: AnomalyFactor
  }
}
interface HistogramDateAction {
  type: ActionType.setHistogramDate
  payload: {
    histogramDate: TimeRange
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

export const setAlertHostList = (alertHostList: string[]): AlertHostList => ({
  type: ActionType.setAlertHostList,
  payload: {
    alertHostList,
  },
})

export const setSelectedAnomaly = (
  selectedAnomaly: AnomalyFactor
): SelectedAnomaly => ({
  type: ActionType.setSelectedAnomaly,
  payload: {
    selectedAnomaly,
  },
})

export const setHistogramDate = (
  histogramDate: TimeRange
): HistogramDateAction => ({
  type: ActionType.setHistogramDate,
  payload: {
    histogramDate,
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
