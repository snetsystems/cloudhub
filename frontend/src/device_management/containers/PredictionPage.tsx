import React, {useEffect} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import PredictionDashBoard from 'src/device_management/components/PredictionDashBoard'
import {Me, Source} from 'src/types'
import {resetStatusDashboard} from 'src/status/actions'
import _ from 'lodash'

interface Props {
  source: Source  
  me: Me
  onResetStatusDashboard?: typeof resetStatusDashboard
}
function PredictionPage({me, source, onResetStatusDashboard}: Props) {
  useEffect(() => {
    onResetStatusDashboard()
  }, [])

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

const mdtp = (dispatch: any) => ({
  onResetStatusDashboard: bindActionCreators(resetStatusDashboard, dispatch),
})

const areEqual = (prevProps, nextProps) => {
  return prevProps === nextProps
}

export default React.memo(connect(mstp, mdtp, null)(PredictionPage), areEqual)
