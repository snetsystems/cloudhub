import React from 'react'
import {connect} from 'react-redux'
import PredictionDashBoard from '../components/PredictionDashBoard'
import {PredictionManualRefresh, Source} from 'src/types'
import _ from 'lodash'
import {CloudAutoRefresh} from 'src/clouds/types/type'

interface Props {
  source: Source
  limit: number
  cloudAutoRefresh: CloudAutoRefresh
  manualRefresh: PredictionManualRefresh
}
function PredictionPage({source, cloudAutoRefresh, manualRefresh}: Props) {
  return (
    <>
      <PredictionDashBoard
        source={source}
        inPresentationMode={true}
        host=""
        sources={[source]}
        cloudAutoRefresh={cloudAutoRefresh}
        manualRefresh={manualRefresh.value}
      />
    </>
  )
}

const mstp = ({auth: {isUsingAuth}}) => {
  return {
    isUsingAuth,
  }
}

const mdtp = {}

const areEqual = (prevProps, nextProps) => {
  return prevProps.manualRefresh.value === nextProps.manualRefresh.value
}

export default React.memo(connect(mstp, mdtp, null)(PredictionPage), areEqual)

// export default AiSettingPage
