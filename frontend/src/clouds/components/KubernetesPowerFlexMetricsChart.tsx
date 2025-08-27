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

// Layout ID for Kubernetes Metrics
const KUBERNETES_METRICS_LAYOUT_ID = 'mock-kubernetes-layout'

interface Props {
  source: Source
  timeRange: TimeRange
  manualRefresh: number
  powerFlexMetricsChartHeight?: number
  selectedPersistentVolume?: string | null
  cloudAutoRefresh?: CloudAutoRefresh
}

function KubernetesPowerFlexMetricsChart({
  source,
  timeRange,
  manualRefresh,
  powerFlexMetricsChartHeight = 17,
  selectedPersistentVolume = null,
  cloudAutoRefresh,
}: Props) {
  const [layout, setLayout] = useState<Layout[]>()
  const [layoutCells, setLayoutCells] = useState<Cell[]>([])

  const instance = []
  let intervalID

  useEffect(() => {
    getLayoutForInstance()
  }, [selectedPersistentVolume])

  useEffect(() => {
    const ratio = {
      xNum: 3,
      yNum: 1,
      height: powerFlexMetricsChartHeight,
    }

    if (!!layout) {
      setLayoutCells(getCellsReactive(layout, source, {}, ratio, null))
    }
  }, [layout, source, powerFlexMetricsChartHeight])

  useEffect(() => {
    const ratio = {
      xNum: 3,
      yNum: 1,
      height: powerFlexMetricsChartHeight,
    }

    if (!!layout) {
      setLayoutCells(getCellsReactive(layout, source, {}, ratio, null))
    }
  }, [layout])

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
      const mockLayout: Layout = {
        id: KUBERNETES_METRICS_LAYOUT_ID,
        app: 'kubernetes',
        measurement: 'kubernetes_metrics',
        autoflow: true,
        whereTagKey: ['host'],
        cells: [
          {
            i: 'latency',
            x: 0,
            y: 0,
            w: 8,
            h: powerFlexMetricsChartHeight,
            name: 'Latency (ms)',
            type: 'line',
            queries: [
              {
                query:
                  'SELECT mean("memory_usage_bytes") AS "memory_usage_bytes" FROM ":db:".":rp:"."kubernetes_pod_container"',
                label: 'Latency (ms)',
                groupbys: ['"pod_name"'],
                wheres: selectedPersistentVolume
                  ? [`"persistent_volume_name"='${selectedPersistentVolume}'`]
                  : [`"pod_name"='gitlab-gitlab-exporter-56499b7c7b-mbrpg'`],
              } as any,
            ],
            colors: ['#8F8AF4'],
            axes: {
              x: {
                bounds: ['', ''],
                label: '',
                prefix: '',
                suffix: '',
                base: 'raw',
                scale: 'linear',
              },
              y: {
                bounds: ['', ''],
                label: 'Latency (ms)',
                prefix: '',
                suffix: '',
                base: 'raw',
                scale: 'linear',
              },
            },
          },
          {
            i: 'IOPS (kIOPS)',
            x: 8,
            y: 0,
            w: 8,
            h: powerFlexMetricsChartHeight,
            name: 'IOPS (kIOPS)',
            type: 'line',
            queries: [
              {
                query:
                  'SELECT mean("memory_usage_bytes") AS "memory_usage_bytes" FROM ":db:".":rp:"."kubernetes_pod_container"',
                label: 'IOPS (kIOPS)',
                groupbys: ['"pod_name"'],
                wheres: selectedPersistentVolume
                  ? [`"persistent_volume_name"='${selectedPersistentVolume}'`]
                  : [`"pod_name"='gitlab-gitlab-exporter-56499b7c7b-mbrpg'`],
              } as any,
            ],
            colors: ['#F4CF31'],
            axes: {
              x: {
                bounds: ['', ''],
                label: '',
                prefix: '',
                suffix: '',
                base: 'raw',
                scale: 'linear',
              },
              y: {
                bounds: ['', ''],
                label: 'IOPS (kIOPS)',
                prefix: '',
                suffix: '',
                base: 'raw',
                scale: 'linear',
              },
            },
          },
          {
            i: 'IOPS',
            x: 16,
            y: 0,
            w: 8,
            h: powerFlexMetricsChartHeight,
            name: 'Bandwidth (KB/s)',
            type: 'line',
            queries: [
              {
                query:
                  'SELECT mean("memory_usage_bytes") AS "memory_usage_bytes" FROM ":db:".":rp:"."kubernetes_pod_container"',
                label: 'Bandwidth (KB/s)',
                groupbys: ['"pod_name"'],
                wheres: selectedPersistentVolume
                  ? [`"persistent_volume_name"='${selectedPersistentVolume}'`]
                  : [`"pod_name"='gitlab-gitlab-exporter-56499b7c7b-mbrpg'`],
              } as any,
            ],
            colors: ['#F48F8F'],
            axes: {
              x: {
                bounds: ['', ''],
                label: '',
                prefix: '',
                suffix: '',
                base: 'raw',
                scale: 'linear',
              },
              y: {
                bounds: ['', ''],
                label: 'Bandwidth (KB/s)',
                prefix: '',
                suffix: '',
                base: 'raw',
                scale: 'linear',
              },
            },
          },
        ],
        link: {
          herf: '/mock-link',
          rel: 'self',
        },
      }
      setLayout([mockLayout])
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
        cellName={
          selectedPersistentVolume
            ? `Performance - ${selectedPersistentVolume}`
            : 'Performance'
        }
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
    kubernetesPowerFlexDashboard: {
      powerFlexMetricsChartHeight,
      selectedPersistentVolume,
    },
  } = state
  return {
    links,
    timeZone,
    cloudAutoRefresh,
    powerFlexMetricsChartHeight,
    selectedPersistentVolume,
  }
}

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(
  connect(mstp, null, null)(KubernetesPowerFlexMetricsChart),
  isEqual
)
