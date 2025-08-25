export type Action =
  | PowerFlexMetricsChartHeightAction
  | SelectedPersistentVolumeAction

export enum ActionType {
  setPowerFlexMetricsChartHeight = 'SET_POWERFLEX_METRICS_CHART_HEIGHT',
  setSelectedPersistentVolume = 'SET_SELECTED_PERSISTENT_VOLUME',
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
