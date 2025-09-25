// Library
import React from 'react'

// Components
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import {NoHostsState} from 'src/addon/128t/reusable'

// Types
import {FocuseNode} from 'src/clouds/types'
import {Source, TimeRange, Cell, Template} from 'src/types'

interface Props {
  source: Source
  sources: Source[]
  cells: Cell[]
  templates: Template[]
  timeRange: TimeRange
  manualRefresh: number
  host: string
  focuseNode: FocuseNode
}

const KubernetesDashboardSection: React.FC<Props> = ({
  source,
  sources,
  cells,
  templates,
  timeRange,
  manualRefresh,
  host,
  focuseNode,
}) => {
  if (focuseNode.name && cells.length > 0) {
    return (
      <div className="kubernetes-dashboard">
        <LayoutRenderer
          source={source}
          sources={sources}
          isStatusPage={false}
          isStaticPage={true}
          isEditable={false}
          cells={cells}
          templates={templates}
          timeRange={timeRange}
          manualRefresh={manualRefresh}
          host={host}
        />
      </div>
    )
  }

  return <NoHostsState style={{height: '50px'}} />
}

export default KubernetesDashboardSection
