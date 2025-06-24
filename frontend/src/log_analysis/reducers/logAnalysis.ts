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
      const {clause} = (action as any).payload as {
        clause: MatchPhraseFilterClause
      }
      const key = Object.keys(clause.match_phrase)[0]
      const value = clause.match_phrase[key]
      const exists = state.filteredLogsForLogAnalysis.some(
        c =>
          'match_phrase' in c &&
          Object.keys(c.match_phrase)[0] === key &&
          c.match_phrase[key] === value
      )
      if (exists) {
        return state
      }
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
      const {clause} = (action as any).payload as {clause: RangeFilterClause}
      const field = Object.keys(clause.range)[0]
      const filtered = state.filteredLogsForLogAnalysis.filter(
        c =>
          !(
            'range' in c &&
            Object.keys((c as RangeFilterClause).range)[0] === field
          )
      )
      return {
        ...state,
        filteredLogsForLogAnalysis: [...filtered, clause as RangeFilterClause],
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
    case ActionType.addLogAnalysisKQLFilterClause: {
      const {clause} = action.payload
      if (
        state.filteredLogsForLogAnalysis.some(
          c => 'kql' in c && c.kql === clause.kql
        )
      )
        return state
      return {
        ...state,
        filteredLogsForLogAnalysis: [
          ...state.filteredLogsForLogAnalysis,
          clause,
        ],
      }
    }

    case ActionType.removeLogAnalysisKQLFilterClause: {
      const {kql} = action.payload
      return {
        ...state,
        filteredLogsForLogAnalysis: state.filteredLogsForLogAnalysis.filter(
          c => !('kql' in c && c.kql === kql)
        ),
      }
    }

    default:
      return state
  }
}

export default logAnalysisDashboard
