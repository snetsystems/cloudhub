import {
  FilteredLogsForLogAnalysis,
  MatchPhraseFilterClause,
  RangeFilterClause,
  KQLFilterClause,
} from 'src/types'
import {KqlDslWrapper, LogFilterClause} from 'src/types/logAnalysis'

export enum ActionType {
  setFilteredLogForLogAnalysis = 'SET_LOG_ANALYSIS_FILTERED_LOG',
  setLogAnalysisStateInit = 'SET_LOG_ANALYSIS_STATE_INIT',
  addLogAnalysisMatchPhraseFilterClause = 'ADD_LOG_ANALYSIS_MATCH_PHRASE_FILTER_CLAUSE',
  removeLogAnalysisMatchPhraseFilterClause = 'REMOVE_LOG_ANALYSIS_MATCH_PHRASE_FILTER_CLAUSE',
  addLogAnalysisRangeFilterClause = 'ADD_LOG_ANALYSIS_RANGE_FILTER_CLAUSE',
  removeLogAnalysisRangeFilterClause = 'REMOVE_LOG_ANALYSIS_RANGE_FILTER_CLAUSE',
  addLogAnalysisKQLFilterClause = 'ADD_LOG_ANALYSIS_KQL_FILTER_CLAUSE',
  removeLogAnalysisKQLFilterClause = 'REMOVE_LOG_ANALYSIS_KQL_FILTER_CLAUSE',
}

export type LogAnalysisAction =
  | LogAnalysisFilteredLogAction
  | LogAnalysisInitAction
  | AddLogAnalysisMatchPhraseFilterClauseAction
  | RemoveLogAnalysisMatchPhraseFilterClauseAction
  | AddLogAnalysisRangeFilterClauseAction
  | RemoveLogAnalysisRangeFilterClauseAction
  | AddLogAnalysisKQLFilterClauseAction
  | RemoveLogAnalysisKQLFilterClauseAction

interface LogAnalysisFilteredLogAction {
  type: ActionType.setFilteredLogForLogAnalysis
  payload: {filteredLogsForLogAnalysis: FilteredLogsForLogAnalysis}
}

export const setFilteredLogForLogAnalysis = (
  filteredLogsForLogAnalysis: FilteredLogsForLogAnalysis
): LogAnalysisFilteredLogAction => ({
  type: ActionType.setFilteredLogForLogAnalysis,
  payload: {filteredLogsForLogAnalysis},
})

interface LogAnalysisInitAction {
  type: ActionType.setLogAnalysisStateInit
}

export const setLogAnalysisStateInit = (): LogAnalysisInitAction => ({
  type: ActionType.setLogAnalysisStateInit,
})

interface AddLogAnalysisMatchPhraseFilterClauseAction {
  type: ActionType.addLogAnalysisMatchPhraseFilterClause
  payload: {clause: MatchPhraseFilterClause}
}

export const addLogAnalysisMatchPhraseFilterClause = (
  key: string,
  value: string | number
): AddLogAnalysisMatchPhraseFilterClauseAction => ({
  type: ActionType.addLogAnalysisMatchPhraseFilterClause,
  payload: {clause: {match_phrase: {[key]: value}}},
})

interface RemoveLogAnalysisMatchPhraseFilterClauseAction {
  type: ActionType.removeLogAnalysisMatchPhraseFilterClause
  payload: {key: string; value: string | number}
}

export const removeLogAnalysisMatchPhraseFilterClause = (
  key: string,
  value: string | number
): RemoveLogAnalysisMatchPhraseFilterClauseAction => ({
  type: ActionType.removeLogAnalysisMatchPhraseFilterClause,
  payload: {key, value},
})

interface AddLogAnalysisRangeFilterClauseAction {
  type: ActionType.addLogAnalysisRangeFilterClause
  payload: {clause: RangeFilterClause}
}

export const addLogAnalysisRangeFilterClause = (
  field: string,
  gte?: string,
  lte?: string,
  format?: string
): AddLogAnalysisRangeFilterClauseAction => ({
  type: ActionType.addLogAnalysisRangeFilterClause,
  payload: {
    clause: {
      range: {
        [field]: {
          ...(format !== undefined ? {format} : {}),
          ...(gte !== undefined ? {gte} : {}),
          ...(lte !== undefined ? {lte} : {}),
        },
      },
    },
  },
})

interface RemoveLogAnalysisRangeFilterClauseAction {
  type: ActionType.removeLogAnalysisRangeFilterClause
  payload: {field: string}
}

export const removeLogAnalysisRangeFilterClause = (
  field: string
): RemoveLogAnalysisRangeFilterClauseAction => ({
  type: ActionType.removeLogAnalysisRangeFilterClause,
  payload: {field},
})

interface AddLogAnalysisKQLFilterClauseAction {
  type: ActionType.addLogAnalysisKQLFilterClause
  payload: {clause: KQLFilterClause}
}

export const addLogAnalysisKQLFilterClause = (
  kql: string,
  dsl: LogFilterClause
) => ({
  type: ActionType.addLogAnalysisKQLFilterClause as const,
  payload: {clause: {kql, dsl} as KqlDslWrapper},
})

export const removeLogAnalysisKQLFilterClause = () => ({
  type: ActionType.removeLogAnalysisKQLFilterClause as const,
  payload: {},
})
export type RemoveLogAnalysisKQLFilterClauseAction = ReturnType<
  typeof removeLogAnalysisKQLFilterClause
>
