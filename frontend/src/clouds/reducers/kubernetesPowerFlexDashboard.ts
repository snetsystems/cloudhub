import {Action, ActionType} from 'src/clouds/actions/kubernetesPowerFlex'

interface PowerFlexState {
  powerFlexMetricsChartHeight: number
  selectedPersistentVolume: string[] | null

  podChartHeight: number
  volumeChartHeight: number
}

const initialState: PowerFlexState = {
  powerFlexMetricsChartHeight: 34,
  selectedPersistentVolume: null,
  podChartHeight: 17,
  volumeChartHeight: 34,
}

const kubernetesPowerFlexDashboard = (
  state: PowerFlexState = initialState,
  action: Action
) => {
  switch (action.type) {
    case ActionType.setPowerFlexMetricsChartHeight: {
      const {powerFlexMetricsChartHeight} = action.payload
      return {...state, powerFlexMetricsChartHeight}
    }
    case ActionType.setSelectedPersistentVolume: {
      const {selectedPersistentVolume} = action.payload
      return {...state, selectedPersistentVolume}
    }
    case ActionType.setPodChartHeight: {
      const {podChartHeight} = action.payload
      return {
        ...state,
        podChartHeight,
      }
    }
    case ActionType.setVolumeChartHeight: {
      const {volumeChartHeight} = action.payload
      return {
        ...state,
        volumeChartHeight,
      }
    }
    default:
      return state
  }
}

export default kubernetesPowerFlexDashboard
