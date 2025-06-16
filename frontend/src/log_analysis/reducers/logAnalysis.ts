// src/log_analysis/reducers/logAnalysisDashboard.ts
import {LogAnalysisAction, ActionType} from 'src/log_analysis/actions'
import {
  FilteredLogsForLogAnalysis,
  MatchPhraseFilterClause,
  RangeFilterClause,
} from 'src/types'

interface LogAnalysisState {
  filteredLogsForLogAnalysis: FilteredLogsForLogAnalysis
}

const initialState: LogAnalysisState = {
  filteredLogsForLogAnalysis: [],
}

const logAnalysisDashboard = (
  state: LogAnalysisState = initialState,
  action: LogAnalysisAction
): LogAnalysisState => {
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
    case ActionType.addLogAnalysisMatchPhraseFilterClause: {
      const {clause} = (action as any).payload
      return {
        ...state,
        filteredLogsForLogAnalysis: [
          ...state.filteredLogsForLogAnalysis,
          clause as MatchPhraseFilterClause,
        ],
      }
    }
    case ActionType.removeLogAnalysisMatchPhraseFilterClause: {
      const {key, value} = (action as any).payload
      return {
        ...state,
        filteredLogsForLogAnalysis: state.filteredLogsForLogAnalysis.filter(
          c =>
            !(
              'match_phrase' in c &&
              (c as MatchPhraseFilterClause).match_phrase[key] === value
            )
        ),
      }
    }
    case ActionType.addLogAnalysisRangeFilterClause: {
      const {clause} = (action as any).payload
      return {
        ...state,
        filteredLogsForLogAnalysis: [
          ...state.filteredLogsForLogAnalysis,
          clause as RangeFilterClause,
        ],
      }
    }
    case ActionType.removeLogAnalysisRangeFilterClause: {
      const {field} = (action as any).payload
      return {
        ...state,
        filteredLogsForLogAnalysis: state.filteredLogsForLogAnalysis.filter(
          c =>
            !(
              'range' in c &&
              Object.keys((c as RangeFilterClause).range)[0] === field
            )
        ),
      }
    }
    default:
      return state
  }
}

export default logAnalysisDashboard
