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
  selectedPersistentVolume?: string[] | null
  cloudAutoRefresh?: CloudAutoRefresh
  volumeChartHeight?: number
}

function KubernetesPowerFlexMetricsChart({
  source,
  timeRange,
  manualRefresh,
  powerFlexMetricsChartHeight = 17,
  selectedPersistentVolume = null,
  cloudAutoRefresh,
  volumeChartHeight,
}: Props) {
  const [layout, setLayout] = useState<Layout[]>()
  const [layoutCells, setLayoutCells] = useState<Cell[]>([])

  const instance = []
  let intervalID

  useEffect(() => {
    getLayoutForInstance(selectedPersistentVolume)
  }, [selectedPersistentVolume])

  useEffect(() => {
    const ratio = {
      xNum: 2,
      yNum: 4,
      height: volumeChartHeight ?? powerFlexMetricsChartHeight,
    }

    if (!!layout) {
      setLayoutCells(getCellsReactive(layout, source, {}, ratio, null))
    }
  }, [layout, source, volumeChartHeight, powerFlexMetricsChartHeight])

  // useEffect(() => {
  //   const ratio = {
  //     xNum: 3,
  //     yNum: 1,
  //     height: podChartHeight ?? powerFlexMetricsChartHeight,
  //   }

  //   if (!!layout) {
  //     setLayoutCells(getCellsReactive(layout, source, {}, ratio, null))
  //   }
  // }, [layout])

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

  const getLayoutForInstance = async (
    selectedPersistentVolume: string[] | null
  ) => {
    const wheres = selectedPersistentVolume
      ? [`"volume_name"='${selectedPersistentVolume.join("','")}'`]
      : []

    try {
      const mockLayout: Layout = {
        id: KUBERNETES_METRICS_LAYOUT_ID,
        app: 'kubernetes',
        measurement: 'kubernetes_metrics',
        autoflow: true,
        whereTagKey: ['host'],
        cells: [
          {
            i: 'd68ec478-6fc9-4c5e-bf94-ed51db0ab311',
            x: 0,
            y: 0,
            w: 8,
            h: powerFlexMetricsChartHeight,
            name: 'Average Read Block Size per Volume',
            type: 'line',

            queries: [
              {
                query:
                  'SELECT mean("userData") AS "userData" FROM ":db:"."autogen"."scaleio.volume.iosize.read"',

                wheres: [...wheres],
                groupbys: ['"volume_name"'],
              } as any,
            ],
            colors: ['#31C0F6', '#A500A5', '#FF7E27'] as any,
            axes: {
              x: {
                bounds: ['', ''],
                label: '',
                prefix: '',
                suffix: '',
                base: '10',
                scale: 'linear',
              },
              y: {
                bounds: ['', ''],
                label: 'Bandwidth',
                prefix: '',
                suffix: 'KiB',
                base: '2',
                scale: 'linear',
              },
            } as any,
          },
          {
            i: 'ca47dfab-33a2-45b7-bae5-76478c815025',
            x: 16,
            y: 0,
            w: 8,
            h: powerFlexMetricsChartHeight,
            name: 'Write Bandwidth per Volume',
            type: 'line',
            queries: [
              {
                query:
                  'SELECT mean("userData")/1000 AS "userData" FROM ":db:"."autogen"."scaleio.volume.bw.write"',
                wheres: [...wheres],
                groupbys: ['"volume_name"'],
              },
            ],
            axes: {
              x: {
                bounds: ['', ''],
                label: '',
                prefix: '',
                suffix: '',
                base: '10',
                scale: 'linear',
              },
              y: {
                bounds: ['', ''],
                label: 'Bandwidth',
                prefix: '',
                suffix: ' MB/s',
                base: '2',
                scale: 'linear',
              },
            },
            colors: ['#31C0F6', '#A500A5', '#FF7E27'],
          },
          {
            i: '77c1ea51-cdc2-4522-8ffd-3806d21c2728',
            x: 16,
            y: 0,
            w: 8,
            h: powerFlexMetricsChartHeight,
            name: 'Read Bandwidth per Volume',
            type: 'line',

            queries: [
              {
                query:
                  'SELECT mean("userData") AS "userData" FROM ":db:"."autogen"."scaleio.volume.bw.read"',
                wheres: [...wheres],
                groupbys: ['"volume_name"'],
              },
            ],
            axes: {
              x: {
                bounds: ['', ''],
                label: '',
                prefix: '',
                suffix: '',
                base: '10',
                scale: 'linear',
              },
              y: {
                bounds: ['', ''],
                label: 'Bandwidth',
                prefix: '',
                suffix: ' kB/s',
                base: '2',
                scale: 'linear',
              },
            },
            colors: [
              {
                id: '9eec6dc1-ed44-4de8-b554-be0eb49c6511',
                type: 'scale',
                hex: '#31C0F6',
                name: 'Nineteen Eighty Four',
                value: '0',
              },
              {
                id: 'f654c97e-dbe0-4de6-b2fe-90dd1ab0c7c0',
                type: 'scale',
                hex: '#A500A5',
                name: 'Nineteen Eighty Four',
                value: '0',
              },
              {
                id: '5647ce46-b814-4813-8be2-d3144c7565af',
                type: 'scale',
                hex: '#FF7E27',
                name: 'Nineteen Eighty Four',
                value: '0',
              },
            ],
          },

          {
            i: '5cd2868d-fb6d-474e-bd67-d87da6ef4ff7',
            x: 0,
            y: 0,
            w: 8,
            h: powerFlexMetricsChartHeight,
            name: 'Write IOPS per Volume',
            type: 'line',
            queries: [
              {
                query:
                  'SELECT mean("userData") AS "userData" FROM ":db:"."autogen"."scaleio.volume.iops.write"',
                wheres: [...wheres],
                groupbys: ['"volume_name"'],
              } as any,
            ],
            colors: ['#31C0F6', '#A500A5', '#FF7E27'],
            axes: {
              x: {
                bounds: ['', ''],
                label: '',
                prefix: '',
                suffix: '',
                base: '10',
                scale: 'linear',
              },
              y: {
                bounds: ['', ''],
                label: 'IOPS',
                prefix: '',
                suffix: ' ms',
                base: '2',
                scale: 'linear',
              },
            },
          },
          {
            i: 'b3da8160-a956-4680-8c28-bc3f0fec6812',
            x: 0,
            y: 0,
            w: 8,
            h: powerFlexMetricsChartHeight,
            name: 'Read IOPS per Volume',
            type: 'line',
            queries: [
              {
                query:
                  'SELECT mean("userData") AS "userData" FROM ":db:"."autogen"."scaleio.volume.iops.read"',
                wheres: [...wheres],
                groupbys: ['"volume_name"'],
              } as any,
            ],
            colors: ['#31C0F6', '#A500A5', '#FF7E27'],
            axes: {
              x: {
                bounds: ['', ''],
                label: '',
                prefix: '',
                suffix: '',
                base: '10',
                scale: 'linear',
              },
              y: {
                bounds: ['', ''],
                label: 'IOPS',
                prefix: '',
                suffix: ' io/s',
                base: '2',
                scale: 'linear',
              },
            },
          },
          {
            i: 'b8a16d86-8081-47fc-ae7c-84639ede6cb4',
            x: 0,
            y: 0,
            w: 8,
            h: powerFlexMetricsChartHeight,
            name: 'Average Write Latency per Volume',
            type: 'line',
            queries: [
              {
                query:
                  'SELECT mean("userDataSdc")/1000 AS "userDataSdc" FROM ":db:"."autogen"."scaleio.volume.latency.write"',
                label: 'Average Write Latency per Volume',
                wheres: [...wheres],
                groupbys: ['"volume_name"'],
              } as any,
            ],
            colors: ['#31C0F6', '#A500A5', '#FF7E27'],
            axes: {
              x: {
                bounds: ['', ''],
                label: '',
                prefix: '',
                suffix: '',
                base: '10',
                scale: 'linear',
              },
              y: {
                bounds: ['', ''],
                label: 'Latency',
                prefix: '',
                suffix: ' ms',
                base: '2',
                scale: 'linear',
              },
            },
          },
          {
            i: '5e985410-3dc0-469c-84bc-7523d299fd5a',
            x: 0,
            y: 0,
            w: 8,
            h: powerFlexMetricsChartHeight,
            name: 'Average Read Latency per Volume',
            type: 'line',
            queries: [
              {
                query:
                  'SELECT mean("userDataSdc")/1000 AS "userDataSdc" FROM ":db:"."autogen"."scaleio.volume.latency.read"',

                label: 'Average Read Latency per Volume',
                groupbys: ['"volume_name"'],
                wheres: [...wheres],
              } as any,
            ],
            colors: ['#F4CF31', '#A500A5', '#FF7E27'],
            axes: {
              x: {
                bounds: ['', ''],
                label: '',
                prefix: '',
                suffix: '',
                base: '10',
                scale: 'linear',
              },
              y: {
                bounds: ['', ''],
                label: 'Latency',
                prefix: '',
                suffix: ' ms',
                base: '2',
                scale: 'linear',
              },
            },
          },
          {
            i: 'cbcf2564-80e7-4316-a572-41d04b68274c',
            x: 0,
            y: 0,
            w: 8,
            h: powerFlexMetricsChartHeight,
            name: 'Average Write Block Size per Volume',
            type: 'line',
            queries: [
              {
                query:
                  'SELECT mean("userData") AS "userData" FROM ":db:"."autogen"."scaleio.volume.iosize.write"',
                groupbys: ['"volume_name"'],
                wheres: [...wheres],
              } as any,
            ],
            colors: ['#F4CF31', '#A500A5', '#FF7E27'],
            axes: {
              x: {
                bounds: ['', ''],
                label: '',
                prefix: '',
                suffix: '',
                base: '10',
                scale: 'linear',
              },
              y: {
                bounds: ['', ''],
                label: 'Bandwidth',
                prefix: '',
                suffix: 'KiB',
                base: '10',
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
        cellName={'Performance'}
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
