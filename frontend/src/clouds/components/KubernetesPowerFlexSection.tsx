import React from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import {Source} from 'src/types'
import KubernetesPowerFlexDashboard from 'src/clouds/components/KubernetesPowerFlexDashboard'

interface KubernetesPowerFlexSectionProps {
  source: Source
  timeRange: any
  manualRefresh: any
}

const KubernetesPowerFlexSection: React.FC<KubernetesPowerFlexSectionProps> = ({
  source,
  timeRange,
  manualRefresh,
}) => {
  return (
    <KubernetesPowerFlexDashboard
      source={source}
      timeRange={timeRange}
      manualRefresh={manualRefresh}
    />
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
  connect(mstp, mdtp, null)(KubernetesPowerFlexSection),
  areEqual
)
