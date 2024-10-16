import React from 'react'
import {connect} from 'react-redux'
import PredictionDashBoard from '../components/PredictionDashBoard'
import {Me, Source} from 'src/types'
import _ from 'lodash'

interface Props {
  source: Source
  limit: number
  me: Me
}
function PredictionPage({me, source}: Props) {
  return (
    <>
      <PredictionDashBoard source={source} host="" sources={[source]} me={me} />
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
