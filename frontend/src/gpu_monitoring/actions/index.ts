import {FilteredHostForGPUMonitoring, TimeRange} from 'src/types'

export type Action =
  | GPUMonitoringTimeRangeAction
  | GPUMonitoringFilteredHostAction
  | GPUMonitoringManualRefreshAction
  | StateGPUMonitoringInitAction
  | TimeSeriesGraphHeightAction
  | StatisticGraphHeightAction

export enum ActionType {
  setGPUMonitoringTimeRange = 'SET_GPU_MONITORING_TIME_RANGE',
  setFilteredHostForGPUMonitoring = 'SET_GPU_MONITORING_FILTERED_HOST',
  setGPUMonitoringManualRefresh = 'SET_GPU_MONITORING_MANUAL_REFRESH',
  setGPUMonitoringStateInit = 'SET_GPU_MONITORING_STATE_INIT',
  setTimeSeriesGraphHeightAction = 'SET_TIME_SERIES_GRAPH',
  setStatisticGraphHeightAction = 'SET_STATISTIC_GRAPH',
}

interface GPUMonitoringTimeRangeAction {
  type: ActionType.setGPUMonitoringTimeRange
  payload: {
    gpuMonitoringTimeRange: TimeRange
  }
}

interface GPUMonitoringFilteredHostAction {
  type: ActionType.setFilteredHostForGPUMonitoring
  payload: {
    filteredHostForGPUMonitoring: FilteredHostForGPUMonitoring
  }
}

interface GPUMonitoringManualRefreshAction {
  type: ActionType.setGPUMonitoringManualRefresh
  payload: {
    gpuMonitoringManualRefresh: number
  }
}

interface StateGPUMonitoringInitAction {
  type: ActionType.setGPUMonitoringStateInit
}

interface TimeSeriesGraphHeightAction {
  type: ActionType.setTimeSeriesGraphHeightAction
  payload: {
    timeSeriesGraphHeight: number
  }
}

interface StatisticGraphHeightAction {
  type: ActionType.setStatisticGraphHeightAction
  payload: {
    statisticGraphHeight: number
  }
}

export const setGPUMonitoringTimeRange = (
  gpuMonitoringTimeRange: TimeRange
): GPUMonitoringTimeRangeAction => ({
  type: ActionType.setGPUMonitoringTimeRange,
  payload: {
    gpuMonitoringTimeRange,
  },
})

export const setFilteredHostForGPUMonitoring = (
  filteredHostForGPUMonitoring: FilteredHostForGPUMonitoring
): GPUMonitoringFilteredHostAction => ({
  type: ActionType.setFilteredHostForGPUMonitoring,
  payload: {
    filteredHostForGPUMonitoring,
  },
})

export const setGPUMonitoringManualRefresh = (): GPUMonitoringManualRefreshAction => ({
  type: ActionType.setGPUMonitoringManualRefresh,
  payload: {
    gpuMonitoringManualRefresh: Date.now(),
  },
})

export const setGPUMonitoringStateInit = (): StateGPUMonitoringInitAction => ({
  type: ActionType.setGPUMonitoringStateInit,
})

export const setTimeSeriesGraphHeight = (
  height: number
): TimeSeriesGraphHeightAction => ({
  type: ActionType.setTimeSeriesGraphHeightAction,
  payload: {
    timeSeriesGraphHeight: height,
  },
})

export const setStatisticGraphHeight = (
  height: number
): StatisticGraphHeightAction => ({
  type: ActionType.setStatisticGraphHeightAction,
  payload: {
    statisticGraphHeight: height,
  },
})
