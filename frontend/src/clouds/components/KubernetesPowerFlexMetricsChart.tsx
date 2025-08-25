// Library
import React, {useEffect, useState} from 'react'
import _ from 'lodash'
import ReactObserver from 'react-resize-observer'
import {connect} from 'react-redux'

// Types
import {Cell, Layout, TimeRange, Source} from 'src/types'

// Components
import {timeRanges} from 'src/shared/data/timeRanges'
import TimeRangeShiftDropdown from 'src/shared/components/TimeRangeShiftDropdown'
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

// Layout ID for Kubernetes Metrics
const KUBERNETES_METRICS_LAYOUT_ID = 'mock-kubernetes-layout'

interface Props {
  source: Source
  timeRange: TimeRange
  manualRefresh: number
  powerFlexMetricsChartHeight?: number
}

function KubernetesPowerFlexMetricsChart({
  source,
  timeRange,
  manualRefresh,
  powerFlexMetricsChartHeight = 17,
}: Props) {
  const [layout, setLayout] = useState<Layout[]>()
  const [layoutCells, setLayoutCells] = useState<Cell[]>([])
  const [selfTimeRange, setSelfTimeRange] = useState<TimeRange>(
    timeRange || timeRanges[0]
  )

  const instance = []

  useEffect(() => {
    getLayoutForInstance()
  }, [])

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
  }, [layout, selfTimeRange])

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
                wheres: [
                  `"pod_name"='gitlab-gitlab-exporter-56499b7c7b-mbrpg'`,
                ],
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
                wheres: [
                  `"pod_name"='gitlab-gitlab-exporter-56499b7c7b-mbrpg'`,
                ],
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
                wheres: [
                  `"pod_name"='gitlab-gitlab-exporter-56499b7c7b-mbrpg'`,
                ],
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

  const handleChooseTimeRange = ({lower, upper}) => {
    if (upper) {
      setSelfTimeRange({lower, upper})
    } else {
      const timeRange = timeRanges.find(range => range.lower === lower)
      setSelfTimeRange(timeRange)
    }
  }

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
        cellName="Performance"
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
      >
        <div
          onMouseDown={e => e.stopPropagation()}
          className="page-header--right"
          style={{zIndex: 3, marginRight: '4px'}}
        >
          <TimeRangeShiftDropdown
            onChooseTimeRange={handleChooseTimeRange}
            selected={selfTimeRange}
          />
        </div>
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
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
              }}
            >
              <ReactObserver onResize={handleOnResize} />
              <LayoutRenderer
                source={source}
                sources={[source]}
                isStatusPage={false}
                isStaticPage={true}
                isEditable={false}
                cells={layoutCells}
                templates={tempVars}
                timeRange={selfTimeRange}
                manualRefresh={manualRefresh}
                host={''}
              />
            </div>
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
      persisted: {autoRefresh, timeZone},
    },
    links,
    kubernetesPowerFlexDashboard: {powerFlexMetricsChartHeight},
  } = state
  return {
    links,
    timeZone,
    autoRefresh,
    powerFlexMetricsChartHeight,
  }
}

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(
  connect(mstp, null, null)(KubernetesPowerFlexMetricsChart),
  isEqual
)
