import React, {useEffect} from 'react'
import {connect} from 'react-redux'
import {BaseElasticSearchData, ToggleEsWizard} from 'src/types'
import {getElasticSearchInfoAsync} from 'src/shared/actions/elasticSearch'
import ElasticTableRow from './ElasticTableRow'
import ElasticTableHeader from './ElasticTableHeader'
import ElasticTableHead from './ElasticTableHead'

interface Props {
  toggleEsWizard: ToggleEsWizard
  esSource?: BaseElasticSearchData
  esSources?: BaseElasticSearchData[]
  fetchElasticSearchInfo?: () => void
}

function ElasticTable({
  toggleEsWizard,
  esSources,
  fetchElasticSearchInfo,
  esSource,
}: Props) {
  useEffect(() => {
    fetchElasticSearchInfo()
  }, [])

  return (
    <div className="panel">
      <ElasticTableHeader toggleEsWizard={toggleEsWizard} />
      <div className="panel-body">
        <table className="table v-center margin-bottom-zero table-highlight">
          <ElasticTableHead />
          <tbody>
            {esSources?.map(i => {
              return (
                <ElasticTableRow
                  key={i.id}
                  esSource={i}
                  connectedEsSource={esSource}
                  toggleEsWizard={toggleEsWizard}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const mstp = state => {
  const {
    esSources: {esSources},
    app: {
      persisted: {esSource},
    },
  } = state

  return {
    esSources,
    esSource,
  }
}

const mdtp = dispatch => {
  return {
    fetchElasticSearchInfo: () => dispatch(getElasticSearchInfoAsync()),
  }
}

export default connect(mstp, mdtp, null)(ElasticTable)
