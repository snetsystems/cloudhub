import {
  FilteredHostForGPUMonitoring,
  INPUT_TIME_TYPE,
  TimeRange,
} from 'src/types'
import {Action, ActionType} from 'src/gpu_monitoring/actions'
import {EMPTY_FILTERED_HOST_FOR_GPU_MONITORING} from 'src/gpu_monitoring/constants'

interface TimeRangeState {
  gpuMonitoringTimeRange: TimeRange
  filteredHostForGPUMonitoring: FilteredHostForGPUMonitoring
  gpuMonitoringManualRefresh: number
  statisticGraphHeight: number
  timeSeriesGraphHeight: number
}
const initialState: TimeRangeState = {
  gpuMonitoringTimeRange: {
    lower: 'now() - 30d',
    lowerFlux: '-30d',
    upper: null,
    format: INPUT_TIME_TYPE.RELATIVE_TIME,
  },
  filteredHostForGPUMonitoring: EMPTY_FILTERED_HOST_FOR_GPU_MONITORING,
  gpuMonitoringManualRefresh: 0,
  statisticGraphHeight: 81,
  timeSeriesGraphHeight: 49,
}

const gpuMonitoringDashboard = (
  state: TimeRangeState = initialState,
  action: Action
) => {
  switch (action.type) {
    case ActionType.setGPUMonitoringTimeRange: {
      const {gpuMonitoringTimeRange} = action.payload
      return {...state, gpuMonitoringTimeRange}
    }
    case ActionType.setFilteredHostForGPUMonitoring: {
      const {filteredHostForGPUMonitoring} = action.payload
      return {...state, filteredHostForGPUMonitoring}
    }
    case ActionType.setGPUMonitoringManualRefresh: {
      const {gpuMonitoringManualRefresh} = action.payload
      return {...state, gpuMonitoringManualRefresh}
    }
    case ActionType.setStatisticGraphHeightAction: {
      const {statisticGraphHeight} = action.payload
      return {...state, statisticGraphHeight}
    }
    case ActionType.setTimeSeriesGraphHeightAction: {
      const {timeSeriesGraphHeight} = action.payload
      return {...state, timeSeriesGraphHeight}
    }
    case ActionType.setGPUMonitoringStateInit: {
      return {
        ...state,
        filteredHostForGPUMonitoring: EMPTY_FILTERED_HOST_FOR_GPU_MONITORING,
      }
    }
    default:
      return state
  }
}

export default gpuMonitoringDashboard
