type CloudAutoRefresh = {
  autoRefreshGroup: {
    [x: string]: number
  }
}

export enum CloudActionTypes {
  SetCloudAutoRefresh = 'SET_CLOUD_AUTOREFRESH',
}

export type CloudAction = SetCloudAutoRefreshAction

export type SetCloudAutoRefreshActionCreator = (
  cloudAutoRefresh: CloudAutoRefresh
) => SetCloudAutoRefreshAction

export interface SetCloudAutoRefreshAction {
  type: CloudActionTypes.SetCloudAutoRefresh
  payload: {
    cloudAutoRefresh: CloudAutoRefresh
  }
}
