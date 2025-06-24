// Library
import React from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'

// Actions
import {
  removeLogAnalysisKQLFilterClause,
  removeLogAnalysisMatchPhraseFilterClause,
  removeLogAnalysisRangeFilterClause,
} from 'src/log_analysis/actions'

// Type
import {FilteredLogsForLogAnalysis, TimeZones} from 'src/types'

// Components
import LogsFilterViewer from 'src/log_analysis/components/LogsFilterViewer'

interface Props {
  filteredLogsForLogAnalysis?: FilteredLogsForLogAnalysis
  timeZone?: TimeZones
  removeLogAnalysisMatchPhraseFilterClause?: (
    key: string,
    value: string | number
  ) => void
  removeLogAnalysisRangeFilterClause?: (field: string) => void
  removeLogAnalysisKQLFilterClause?: (kql: string) => void
}

function LogsFilterContainer({
  filteredLogsForLogAnalysis = [],
  timeZone,
  removeLogAnalysisMatchPhraseFilterClause,
  removeLogAnalysisRangeFilterClause,
  removeLogAnalysisKQLFilterClause,
}: Props) {
  return (
    <div className="logs-analysis-filter-container">
      {filteredLogsForLogAnalysis.map((clause, idx) => (
        <LogsFilterViewer
          key={idx}
          filter={{id: idx.toString(), ...clause}}
          timeZone={timeZone}
          onDelete={id => {
            const target = filteredLogsForLogAnalysis[Number(id)]
            if ('match_phrase' in target) {
              const k = Object.keys(target.match_phrase)[0]
              removeLogAnalysisMatchPhraseFilterClause?.(
                k,
                target.match_phrase[k]
              )
            } else if ('range' in target) {
              const f = Object.keys(target.range)[0]
              removeLogAnalysisRangeFilterClause?.(f)
            } else if ('kql' in target) {
              removeLogAnalysisKQLFilterClause?.(target.kql)
            }
          }}
        />
      ))}
    </div>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {timeZone},
    },
    logAnalysisDashboard: {filteredLogsForLogAnalysis},
  } = state
  return {
    filteredLogsForLogAnalysis,
    timeZone,
  }
}

const mdtp = dispatch => ({
  removeLogAnalysisMatchPhraseFilterClause: bindActionCreators(
    removeLogAnalysisMatchPhraseFilterClause,
    dispatch
  ),
  removeLogAnalysisRangeFilterClause: bindActionCreators(
    removeLogAnalysisRangeFilterClause,
    dispatch
  ),
  removeLogAnalysisKQLFilterClause: bindActionCreators(
    removeLogAnalysisKQLFilterClause,
    dispatch
  ),
})

const isEqual = (prev, next) => _.isEqual(prev, next)

export default React.memo(
  connect(mstp, mdtp, null)(LogsFilterContainer),
  isEqual
)
