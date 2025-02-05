import {TimeRange} from 'src/types'

type CloudAutoRefresh = {
  autoRefreshGroup: {
    [x: string]: number
  }
}

type CloudTimeRange = {
  timeRangeGroup: {
    [x: string]: TimeRange
  }
}

export enum CloudActionTypes {
  SetCloudAutoRefresh = 'SET_CLOUD_AUTOREFRESH',
  SetCloudTimeRange = 'SET_CLOUD_TIMERANGE',
}

export type CloudAction = SetCloudAutoRefreshAction | SetCloudTimeRangeAction

export type SetCloudAutoRefreshActionCreator = (
  cloudAutoRefresh: CloudAutoRefresh
) => SetCloudAutoRefreshAction

export type SetCloudTimeRangeActionCreator = (
  cloudTimeRange: CloudTimeRange
) => SetCloudTimeRangeAction

export interface SetCloudAutoRefreshAction {
  type: CloudActionTypes.SetCloudAutoRefresh
  payload: {
    cloudAutoRefresh: CloudAutoRefresh
  }
}

export interface SetCloudTimeRangeAction {
  type: CloudActionTypes.SetCloudTimeRange
  payload: {
    cloudTimeRange: CloudTimeRange
  }
}
