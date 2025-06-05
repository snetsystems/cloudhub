export type Action = LogAnalysisFilteredLogAction | LogAnalysisInitAction

export enum ActionType {
  setFilteredLogForLogAnalysis = 'SET_LOG_ANALYSIS_FILTERED_LOG',
  setLogAnalysisStateInit = 'SET_LOG_ANALYSIS_STATE_INIT',
}

interface LogAnalysisFilteredLogAction {
  type: ActionType.setFilteredLogForLogAnalysis
  payload: {
    filteredLogsForLogAnalysis: string[]
  }
}

export const setFilteredLogForLogAnalysis = (
  filteredLogsForLogAnalysis: string[]
): LogAnalysisFilteredLogAction => ({
  type: ActionType.setFilteredLogForLogAnalysis,
  payload: {
    filteredLogsForLogAnalysis,
  },
})

interface LogAnalysisInitAction {
  type: ActionType.setLogAnalysisStateInit
}

export const setLogAnalysisStateInit = (): LogAnalysisInitAction => ({
  type: ActionType.setLogAnalysisStateInit,
})
