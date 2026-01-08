// Libraries
import {LogAnalysisAction, ActionType} from 'src/log_analysis/actions'
import {
  FilteredLogsForLogAnalysis,
  MatchPhraseFilterClause,
  RangeFilterClause,
} from 'src/types'

// Types
interface LogAnalysisState {
  filteredLogsForLogAnalysis: FilteredLogsForLogAnalysis
  logAnalysisManualRefresh: number
}

// Constants
const initialState: LogAnalysisState = {
  filteredLogsForLogAnalysis: [],
  logAnalysisManualRefresh: 0,
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
    case ActionType.setLogAnalysisManualRefresh: {
      const {logAnalysisManualRefresh} = action.payload
      return {...state, logAnalysisManualRefresh}
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
    case ActionType.clearLogAnalysisMatchPhraseFilterClauses: {
      return {
        ...state,
        filteredLogsForLogAnalysis: state.filteredLogsForLogAnalysis.filter(
          c => !('match_phrase' in c)
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
    case ActionType.clearLogAnalysisRangeFilterClauses: {
      return {
        ...state,
        filteredLogsForLogAnalysis: state.filteredLogsForLogAnalysis.filter(
          c => !('range' in c)
        ),
      }
    }
    case ActionType.addLogAnalysisKQLFilterClause: {
      const {clause} = action.payload

      const withoutKql = state.filteredLogsForLogAnalysis.filter(
        f => !('kql' in f)
      )
      return {
        ...state,
        filteredLogsForLogAnalysis: [...withoutKql, clause],
      }
    }

    case ActionType.removeLogAnalysisKQLFilterClause: {
      return {
        ...state,
        filteredLogsForLogAnalysis: state.filteredLogsForLogAnalysis.filter(
          f => !('kql' in f)
        ),
      }
    }

    default:
      return state
  }
}

export default logAnalysisDashboard
