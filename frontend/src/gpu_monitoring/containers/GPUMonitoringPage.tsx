import React from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'

import {Source} from 'src/types'
import GPUMonitoringDashBoard from 'src/gpu_monitoring/components/GPUMonitoringDashBoard'

interface Props {
  source: Source
}
function GPUMonitoringPage({source}: Props) {
  return (
    <>
      <GPUMonitoringDashBoard source={source} sources={[source]} />
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
