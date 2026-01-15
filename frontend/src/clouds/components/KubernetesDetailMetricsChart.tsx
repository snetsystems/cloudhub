// Library
import React, {useEffect, useState} from 'react'
import _ from 'lodash'
import ReactObserver from 'react-resize-observer'
import {connect} from 'react-redux'

// Types
import {Cell, Layout, TimeRange, Source} from 'src/types'
import {CloudAutoRefresh} from 'src/clouds/types/type'

// Components
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import KubernetesPowerFlexDashboardHeader from 'src/clouds/components/KubernetesPowerFlexDashboardHeader'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
  GRAPH_BG_COLOR,
} from 'src/dashboards/constants'

// Utils
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {generateForHostsForStatisticalGraph} from 'src/utils/tempVars'
import {getCellsReactive} from 'src/hosts/utils/getCellsReactive'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {getDeep} from 'src/utils/wrappers'
import {getLayout} from 'src/hosts/apis'

// Layout ID for Kubernetes Metrics
const KUBERNETES_METRICS_LAYOUT_ID = '37bbdd01-d88c-4a68-b0d9-960537e9b64d'

interface Props {
  source: Source
  title: string
  timeRange: TimeRange
  manualRefresh: number
  detailMetricsChartHeight?: number
  cloudAutoRefresh?: CloudAutoRefresh
  volumeChartHeight?: number
}

function KubernetesDetailMetricsChart({
  source,
  title,
  timeRange,
  manualRefresh,
  detailMetricsChartHeight = 17,
  cloudAutoRefresh,
  volumeChartHeight,
}: Props) {
  const [layout, setLayout] = useState<Layout[]>()
  const [layoutCells, setLayoutCells] = useState<Cell[]>([])

  const instance = []
  let intervalID

  useEffect(() => {
    getLayoutForInstance()
  }, [])

  useEffect(() => {
    const ratio = {
      xNum: 4,
      yNum: 2,
      height: volumeChartHeight ?? detailMetricsChartHeight,
    }

    if (!!layout) {
      setLayoutCells(getCellsReactive(layout, source, {}, ratio, null))
    }
  }, [layout, source, volumeChartHeight, detailMetricsChartHeight])

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

  const getLayoutForInstance = async () => {
    try {
      const layoutResults = await getLayout(KUBERNETES_METRICS_LAYOUT_ID)
      const layout = getDeep<Layout>(layoutResults, 'data', null)

      setLayout(layout ? [layout] : [])
    } catch (error) {
      console.error('Failed to load kubernetes metrics layout:', error)
      setLayout([])
    }
  }

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
    kubernetesDetailsDashboard: {
      proxyMetricsChartHeight,
      selectedPersistentVolume,
    },
  } = state
  return {
    links,
    timeZone,
    cloudAutoRefresh,
    detailMetricsChartHeight: proxyMetricsChartHeight,
    selectedPersistentVolume,
  }
}

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(
  connect(mstp, null, null)(KubernetesDetailMetricsChart),
  isEqual
)
