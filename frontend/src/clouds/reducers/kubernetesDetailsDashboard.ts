import {Action, ActionType} from 'src/clouds/actions/kubernetesProxy'

interface ProxyState {
  proxyMetricsChartHeight: number
  selectedPersistentVolume: string[] | null

  podChartHeight: number
  volumeChartHeight: number
}

const initialState: ProxyState = {
  proxyMetricsChartHeight: 34,
  selectedPersistentVolume: null,
  podChartHeight: 17,
  volumeChartHeight: 34,
}

const kubernetesDetailsDashboard = (
  state: ProxyState = initialState,
  action: Action
) => {
  switch (action.type) {
    case ActionType.setProxyMetricsChartHeight: {
      const {proxyMetricsChartHeight} = action.payload
      return {...state, proxyMetricsChartHeight}
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

export default kubernetesDetailsDashboard
