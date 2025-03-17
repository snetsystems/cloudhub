import React from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'

import {Me, Source} from 'src/types'
import GPUMonitoringDashBoard from 'src/gpu_monitoring/components/GPUMonitoringDashBoard'

interface Props {
  source: Source
  limit: number
  me: Me
}
function GPUMonitoringPage({me, source}: Props) {
  return (
    <>
      <GPUMonitoringDashBoard source={source} sources={[source]} me={me} />
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

export default React.memo(
  connect(mstp, mdtp, null)(GPUMonitoringPage),
  areEqual
)
