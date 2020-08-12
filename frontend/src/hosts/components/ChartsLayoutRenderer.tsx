import React from 'react'
import classnames from 'classnames'

import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'

const ChartsLayoutRenderer = ({
  source,
  layoutCells,
  tempVars,
  timeRange,
  manualRefresh,
  hostID,
}) => {
  return (
    <FancyScrollbar
      className={classnames({
        'page-contents': true,
        // 'presentation-mode': inPresentationMode,
      })}
    >
      <div className="container-fluid full-width dashboard">
        <LayoutRenderer
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
        />
      </div>
    </FancyScrollbar>
  )
}

export default ChartsLayoutRenderer
