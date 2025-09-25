// Library
import React from 'react'

// Components
import KubernetesDetailDashboard from 'src/clouds/components/KubernetesDetailDashboard'

interface KubernetesDetailDashboardSectionProps {
  source: any
  timeRange: any
  manualRefresh: any
}

const KubernetesDetailDashboardSection: React.FC<KubernetesDetailDashboardSectionProps> = ({
  source,
  timeRange,
  manualRefresh,
}) => {
  return (
    <KubernetesDetailDashboard
      source={source}
      timeRange={timeRange}
      manualRefresh={manualRefresh}
    />
  )
}

export default KubernetesDetailDashboardSection
