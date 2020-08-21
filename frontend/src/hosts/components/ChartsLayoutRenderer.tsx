import React from 'react'
import classnames from 'classnames'

import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import LayoutVMRenderer from 'src/shared/components/LayoutVMRenderer'

const ChartsLayoutRenderer = ({
  source,
  layoutCells,
  tempVars,
  timeRange,
  manualRefresh,
  hostID,
  isVMware,
  vmParam,
  vmParentChartField,
  vmParentName,
}) => {
  return (
    <FancyScrollbar
      className={classnames({
        'page-contents': true,
        // 'presentation-mode': inPresentationMode,
      })}
    >
      <div className="container-fluid full-width dashboard">
        <LayoutVMRenderer
          source={source}
          sources={[source]}
          isStatusPage={false}
          isStaticPage={true}
          isEditable={false}
          cells={layoutCells}
          templates={tempVars}
          timeRange={timeRange}
          manualRefresh={manualRefresh}
          host={hostID}
          isVMware={isVMware}
          vmParam={vmParam}
          vmParentChartField={vmParentChartField}
          vmParentName={vmParentName}
        />
      </div>
    </FancyScrollbar>
  )
}

export default ChartsLayoutRenderer
