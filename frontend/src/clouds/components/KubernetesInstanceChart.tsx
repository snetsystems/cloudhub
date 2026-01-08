// Library
import React, {useEffect, useState} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import ReactObserver from 'react-resize-observer'

// Types
import {Cell, Layout, Source, TimeRange} from 'src/types'
import {CloudAutoRefresh} from 'src/clouds/types/type'

// Constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
  GRAPH_BG_COLOR,
} from 'src/dashboards/constants'

// Utils
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {generateForHostsForStatisticalGraph} from 'src/utils/tempVars'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {getCellsReactive} from 'src/hosts/utils/getCellsReactive'

// Components
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import KubernetesPowerFlexDashboardHeader from './KubernetesPowerFlexDashboardHeader'

interface Props {
  source: Source
  title: string
  timeRange: TimeRange
  manualRefresh: number
  layout: Layout[]
  cloudAutoRefresh?: CloudAutoRefresh
  podChartHeight?: number
}

function KubernetesInstanceChart({
  source,
  title,
  timeRange,
  manualRefresh,
  layout,
  cloudAutoRefresh,
  podChartHeight,
}: Props) {
  const [layoutCells, setLayoutCells] = useState<Cell[]>([])

  const instance = []
  let intervalID

  useEffect(() => {
    const ratio = {
      xNum: 4,
      yNum: 1,
      height: podChartHeight,
    }

    if (!!layout) {
      setLayoutCells(getCellsReactive(layout, source, {}, ratio, null))
    }
  }, [layout, source, podChartHeight])

  useEffect(() => {
    const controller = new AbortController()

    if (!!cloudAutoRefresh?.kubernetes) {
      clearInterval(intervalID)
    }

    GlobalAutoRefresher.poll(cloudAutoRefresh?.kubernetes)

    return () => {
      controller.abort()
      clearInterval(intervalID)
      intervalID = null
      GlobalAutoRefresher.stopPolling()
    }
  }, [cloudAutoRefresh?.kubernetes])

  const tempVars = generateForHostsForStatisticalGraph(source)

  const debouncedFit = _.debounce(() => {
    WindowResizeEventTrigger()
  }, 150)

  const handleOnResize = (): void => {
    debouncedFit()
  }

  return (
    <div
      className="panel"
      style={{
        height: '100%',
        backgroundColor: GRAPH_BG_COLOR,
      }}
    >
      <KubernetesPowerFlexDashboardHeader
        cellName={title}
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
      >
        <></>
      </KubernetesPowerFlexDashboardHeader>
      {!_.isEmpty(instance) ? (
        <div className="panel-body">
          <div className="generic-empty-state">
            <h4 style={{margin: '90px 0'}}>No Volumes found</h4>
          </div>
        </div>
      ) : (
        <>
          <div className="panel-body" style={{backgroundColor: GRAPH_BG_COLOR}}>
            <ReactObserver onResize={handleOnResize} />
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
              host={''}
            />
          </div>

          <div className="dash-graph--gradient-border">
            <div className="dash-graph--gradient-top-left" />
            <div className="dash-graph--gradient-top-right" />
            <div className="dash-graph--gradient-bottom-left" />
            <div className="dash-graph--gradient-bottom-right" />
          </div>
        </>
      )}
    </div>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {cloudAutoRefresh, timeZone},
    },
    links,
    kubernetesDetailsDashboard: {podChartHeight},
  } = state
  return {
    links,
    timeZone,
    cloudAutoRefresh,
    podChartHeight,
  }
}

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(
  connect(mstp, null, null)(KubernetesInstanceChart),
  isEqual
)
