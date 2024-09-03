import {AnomalyFactor, TimeRange} from 'src/types'

export type Action =
  | PredictionTimeRangeAction
  | PredictionFilteredHexbin
  | AlertHostList
  | SelectedAnomaly
  | HistogramDateAction
  | PredictionManualRefreshAction
  | StateInitAction

export enum ActionType {
  setPredictionTimeRange = 'SET_PREDICTION_DASHBOARD',
  setFilteredHexbin = 'SET_FILTERED_HEXBIN',
  setAlertHostList = 'SET_ALERT_HOST_LIST',
  setSelectedAnomaly = 'SET_SELECTED_ANOMALY',
  setHistogramDate = 'SET_HISTOGRAM_DATE',
  setPredictionManualRefresh = 'SET_PREDICTION_MANUAL_REFRESH',
  setStateInit = 'SET_STATE_INIT',
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

interface PredictionManualRefreshAction {
  type: ActionType.setPredictionManualRefresh
  payload: {
    predictionManualRefresh: number
  }
}

interface StateInitAction {
  type: ActionType.setStateInit
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

export const setPredictionManualRefresh = (): PredictionManualRefreshAction => ({
  type: ActionType.setPredictionManualRefresh,
  payload: {
    predictionManualRefresh: Date.now(),
  },
})

export const setStateInitAction = (): StateInitAction => ({
  type: ActionType.setStateInit,
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
