import {Action, ActionType} from 'src/clouds/actions/kubernetesPowerFlex'

interface PowerFlexState {
  powerFlexMetricsChartHeight: number
  selectedPersistentVolume: string | null
}

const initialState: PowerFlexState = {
  powerFlexMetricsChartHeight: 17,
  selectedPersistentVolume: null,
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
    default:
      return state
  }
}

export default kubernetesPowerFlexDashboard
