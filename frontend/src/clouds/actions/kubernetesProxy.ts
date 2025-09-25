export type Action =
  | ProxyMetricsChartHeightAction
  | SelectedPersistentVolumeAction
  | PodChartHeightAction
  | VolumeChartHeightAction
export enum ActionType {
  setProxyMetricsChartHeight = 'SET_PROXY_METRICS_CHART_HEIGHT',
  setSelectedPersistentVolume = 'SET_SELECTED_PERSISTENT_VOLUME',
  setPodChartHeight = 'SET_POD_CHART_HEIGHT',
  setVolumeChartHeight = 'SET_VOLUME_CHART_HEIGHT',
}

interface ProxyMetricsChartHeightAction {
  type: ActionType.setProxyMetricsChartHeight
  payload: {
    proxyMetricsChartHeight: number
  }
}

interface SelectedPersistentVolumeAction {
  type: ActionType.setSelectedPersistentVolume
  payload: {
    selectedPersistentVolume: string[] | null
  }
}

interface PodChartHeightAction {
  type: ActionType.setPodChartHeight
  payload: {
    podChartHeight: number
  }
}

interface VolumeChartHeightAction {
  type: ActionType.setVolumeChartHeight
  payload: {
    volumeChartHeight: number
  }
}

export const setProxyMetricsChartHeight = (
  height: number
): ProxyMetricsChartHeightAction => ({
  type: ActionType.setProxyMetricsChartHeight,
  payload: {
    proxyMetricsChartHeight: height,
  },
})

export const setSelectedPersistentVolume = (
  persistentVolumeName: string[] | null
): SelectedPersistentVolumeAction => ({
  type: ActionType.setSelectedPersistentVolume,
  payload: {
    selectedPersistentVolume: persistentVolumeName,
  },
})

export const setPodChartHeight = (height: number): PodChartHeightAction => ({
  type: ActionType.setPodChartHeight,
  payload: {
    podChartHeight: height,
  },
})

export const setVolumeChartHeight = (
  height: number
): VolumeChartHeightAction => ({
  type: ActionType.setVolumeChartHeight,
  payload: {
    volumeChartHeight: height,
  },
})
