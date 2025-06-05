import {Action, ActionType} from 'src/log_analysis/actions'
import {FilteredLogsForLogAnalysis} from 'src/types'

interface LogAnalysisState {
  filteredLogsForLogAnalysis: FilteredLogsForLogAnalysis
}
const initialState: LogAnalysisState = {
  filteredLogsForLogAnalysis: [],
}

const logAnalysisDashboard = (
  state: LogAnalysisState = initialState,
  action: Action
) => {
  switch (action.type) {
    case ActionType.setFilteredLogForLogAnalysis: {
      const {filteredLogsForLogAnalysis} = action.payload
      return {...state, filteredLogsForLogAnalysis}
    }
    case ActionType.setLogAnalysisStateInit: {
      return {
        ...state,
        filteredLogsForLogAnalysis: [],
      }
    }
    default:
      return state
  }
}

export default logAnalysisDashboard
