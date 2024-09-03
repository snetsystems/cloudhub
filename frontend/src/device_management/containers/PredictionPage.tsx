import React from 'react'
import {connect} from 'react-redux'
import PredictionDashBoard from '../components/PredictionDashBoard'
import {Me, Source} from 'src/types'
import _ from 'lodash'
import {CloudAutoRefresh} from 'src/clouds/types/type'

interface Props {
  source: Source
  limit: number
  cloudAutoRefresh: CloudAutoRefresh
  me: Me
}
function PredictionPage({me, source, cloudAutoRefresh}: Props) {
  return (
    <>
      <PredictionDashBoard
        source={source}
        inPresentationMode={true}
        host=""
        sources={[source]}
        cloudAutoRefresh={cloudAutoRefresh}
        me={me}
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
  return prevProps === nextProps
}

export default React.memo(connect(mstp, mdtp, null)(PredictionPage), areEqual)

// export default AiSettingPage
