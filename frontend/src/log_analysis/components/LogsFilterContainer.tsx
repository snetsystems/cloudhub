// Library
import React from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'

// Actions
import {
  removeLogAnalysisMatchPhraseFilterClause,
  removeLogAnalysisRangeFilterClause,
} from 'src/log_analysis/actions'

// Type
import {FilteredLogsForLogAnalysis} from 'src/types'

// Components
import LogsFilterViewer from 'src/log_analysis/components/LogsFilterViewer'

interface Props {
  filteredLogsForLogAnalysis?: FilteredLogsForLogAnalysis
  removeLogAnalysisMatchPhraseFilterClause?: (
    key: string,
    value: string | number
  ) => void
  removeLogAnalysisRangeFilterClause?: (field: string) => void
}

function LogsFilterContainer({
  filteredLogsForLogAnalysis,
  removeLogAnalysisMatchPhraseFilterClause,
  removeLogAnalysisRangeFilterClause,
}: Props) {
  return (
    <>
      <div className="logs-analysis-filter-container">
        {filteredLogsForLogAnalysis.map((clause, idx) => (
          <LogsFilterViewer
            key={idx}
            filter={{id: idx.toString(), ...clause}}
            onDelete={id => {
              const index = Number(id)
              const target = filteredLogsForLogAnalysis[index]
              if ('match_phrase' in target) {
                const k = Object.keys(target.match_phrase)[0]
                removeLogAnalysisMatchPhraseFilterClause(
                  k,
                  target.match_phrase[k]
                )
              } else if ('range' in target) {
                const f = Object.keys(target.range)[0]
                removeLogAnalysisRangeFilterClause(f)
              }
            }}
          />
        ))}
      </div>
    </>
  )
}

const mstp = state => {
  const {
    logAnalysisDashboard: {filteredLogsForLogAnalysis},
  } = state

  return {
    filteredLogsForLogAnalysis,
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
})

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(
  connect(mstp, mdtp, null)(LogsFilterContainer),
  isEqual
)
