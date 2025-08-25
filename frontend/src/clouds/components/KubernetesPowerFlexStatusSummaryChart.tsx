// Library
import React from 'react'

// Components
import KubernetesPowerFlexDashboardHeader from 'src/clouds/components/KubernetesPowerFlexDashboardHeader'

// Constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

const KubernetesPowerFlexStatusSummaryChart: React.FC = () => {
  return (
    <div className="panel" style={{height: '100%', backgroundColor: '#292933'}}>
      <KubernetesPowerFlexDashboardHeader
        cellName="Pod Status Summary"
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
      >
        <></>
      </KubernetesPowerFlexDashboardHeader>

      <div className="panel-body" style={{backgroundColor: '#292933'}}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '12px',
          }}
        >
          Pod Status Summary Chart Area
        </div>
      </div>

      <div className="dash-graph--gradient-border">
        <div className="dash-graph--gradient-top-left" />
        <div className="dash-graph--gradient-top-right" />
        <div className="dash-graph--gradient-bottom-left" />
        <div className="dash-graph--gradient-bottom-right" />
      </div>
    </div>
  )
}

export default KubernetesPowerFlexStatusSummaryChart
