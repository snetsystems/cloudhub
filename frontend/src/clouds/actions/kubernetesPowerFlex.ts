export type Action = PowerFlexMetricsChartHeightAction

export enum ActionType {
  setPowerFlexMetricsChartHeight = 'SET_POWERFLEX_METRICS_CHART_HEIGHT',
}

interface PowerFlexMetricsChartHeightAction {
  type: ActionType.setPowerFlexMetricsChartHeight
  payload: {
    powerFlexMetricsChartHeight: number
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
