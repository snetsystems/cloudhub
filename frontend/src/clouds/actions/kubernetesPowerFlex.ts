export type Action =
  | PowerFlexMetricsChartHeightAction
  | SelectedPersistentVolumeAction
  | PodChartHeightAction
  | VolumeChartHeightAction
export enum ActionType {
  setPowerFlexMetricsChartHeight = 'SET_POWERFLEX_METRICS_CHART_HEIGHT',
  setSelectedPersistentVolume = 'SET_SELECTED_PERSISTENT_VOLUME',
  setPodChartHeight = 'SET_POD_CHART_HEIGHT',
  setVolumeChartHeight = 'SET_VOLUME_CHART_HEIGHT',
}

interface PowerFlexMetricsChartHeightAction {
  type: ActionType.setPowerFlexMetricsChartHeight
  payload: {
    powerFlexMetricsChartHeight: number
  }
}

interface SelectedPersistentVolumeAction {
  type: ActionType.setSelectedPersistentVolume
  payload: {
    selectedPersistentVolume: string | null
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

export const setPowerFlexMetricsChartHeight = (
  height: number
): PowerFlexMetricsChartHeightAction => ({
  type: ActionType.setPowerFlexMetricsChartHeight,
  payload: {
    powerFlexMetricsChartHeight: height,
  },
})

export const setSelectedPersistentVolume = (
  persistentVolumeName: string | null
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
