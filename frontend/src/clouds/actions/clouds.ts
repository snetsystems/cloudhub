import {
  CloudActionTypes,
  SetCloudAutoRefreshActionCreator,
} from 'src/clouds/types/actions/clouds'

export const setCloudAutoRefresh: SetCloudAutoRefreshActionCreator = cloudAutoRefresh => ({
  type: CloudActionTypes.SetCloudAutoRefresh,
  payload: {
    cloudAutoRefresh,
  },
})
