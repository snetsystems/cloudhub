// Library
import React from 'react'

// Components
import KubernetesPowerFlexDashboard from 'src/clouds/components/KubernetesPowerFlexDashboard'

interface KubernetesPowerFlexDashboardSectionProps {
  source: any
  timeRange: any
  manualRefresh: any
}

const KubernetesPowerFlexDashboardSection: React.FC<KubernetesPowerFlexDashboardSectionProps> = ({
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

export default KubernetesPowerFlexDashboardSection
