import {
  CloudActionTypes,
  SetCloudAutoRefreshActionCreator,
  SetCloudTimeRangeActionCreator,
} from 'src/clouds/types/actions/clouds'

export const setCloudAutoRefresh: SetCloudAutoRefreshActionCreator = cloudAutoRefresh => ({
  type: CloudActionTypes.SetCloudAutoRefresh,
  payload: {
    cloudAutoRefresh,
  },
})

export const setCloudTimeRange: SetCloudTimeRangeActionCreator = cloudTimeRange => ({
  type: CloudActionTypes.SetCloudTimeRange,
  payload: {
    cloudTimeRange,
  },
})
