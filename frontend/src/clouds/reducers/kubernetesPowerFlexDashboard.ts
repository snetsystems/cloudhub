import {Action, ActionType} from 'src/clouds/actions/kubernetesPowerFlex'

interface PowerFlexState {
  powerFlexMetricsChartHeight: number
}

const initialState: PowerFlexState = {
  powerFlexMetricsChartHeight: 17,
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
    default:
      return state
  }
}

export default kubernetesPowerFlexDashboard
