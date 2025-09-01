// Library
import React, {useMemo} from 'react'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import Authorized, {VIEWER_ROLE} from 'src/auth/Authorized'
import {DASHBOARD_LAYOUT_ROW_HEIGHT, LAYOUT_MARGIN} from 'src/shared/constants'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'

// Types
import * as DashboardsModels from 'src/types/dashboards'
import {Cell, Layout, Source} from 'src/types'

// Components
import {Page} from 'src/reusable_ui'
import KubernetesInstanceChart from 'src/clouds/components/KubernetesInstanceChart'

// Constants
import {FIXTURE_KUBERNETES_POD_VOLUME_CELLS} from 'src/clouds/constants/fixture'

// Actions
import {
  setPodChartHeight,
  setVolumeChartHeight,
} from 'src/clouds/actions/kubernetesPowerFlex'
import KubernetesPowerFlexMetricsChart from './KubernetesPowerFlexMetricsChart'

interface Props {
  source: Source
  timeRange: any
  manualRefresh: any
  podLayouts: Layout[]
  setPodChartHeight?: (height: number) => void
  setVolumeChartHeight?: (height: number) => void
  podChartHeight?: number
  volumeChartHeight?: number
}

interface TempProps {
  cell: Cell
  source: Source
}

function KubernetesPodDashboardSection({
  source,
  timeRange,
  manualRefresh,
  podLayouts,
  setPodChartHeight,
  setVolumeChartHeight,
  podChartHeight,
  volumeChartHeight,
}: Props) {
  const GridLayout = WidthProvider(ReactGridLayout)

  const savedCells = JSON.parse(
    localStorage.getItem('Kubernetes-pod-volume-cells')
  )

  const cells = useMemo(() => {
    const defaultCells = FIXTURE_KUBERNETES_POD_VOLUME_CELLS()
    const baseCells = savedCells || defaultCells

    // 반영 지연을 없애기 위해 Redux 높이를 즉시 layout.h에 주입
    return baseCells.map(cell => {
      if (cell.i === 'kubernetes-pod-chart') {
        return {
          ...cell,
          h: podChartHeight ?? cell.h,
        }
      }
      if (cell.i === 'kubernetes-volume-chart') {
        return {
          ...cell,
          h: volumeChartHeight ?? cell.h,
        }
      }
      return cell
    })
  }, [savedCells, podChartHeight, volumeChartHeight])

  const setLocalCells = (cells: DashboardsModels.Cell[]) => {
    localStorage.setItem('Kubernetes-pod-volume-cells', JSON.stringify(cells))
  }

  const handleLayoutChange = layout => {
    let changed = false
    const newCells = cells.map(cell => {
      const l = layout.find(ly => ly.i === cell.i)

      if (l.i === 'kubernetes-pod-chart' && cell.h !== l.h) {
        setPodChartHeight(l.h)
      } else if (l.i === 'kubernetes-volume-chart' && cell.h !== l.h) {
        setVolumeChartHeight(l.h)
      }

      if (
        cell.x !== l.x ||
        cell.y !== l.y ||
        cell.h !== l.h ||
        cell.w !== l.w
      ) {
        changed = true
      }

      const newLayout = {
        x: l.x,
        y: l.y,
        h: l.h,
        w: l.w,
      }

      return {
        ...cell,
        ...newLayout,
      }
    })

    if (changed) {
      setLocalCells(newCells as DashboardsModels.Cell[])
    }
  }

  const layoutRender = ({cell, source}: TempProps) => {
    if (!cell) return null

    switch (cell.i) {
      case 'kubernetes-pod-chart': {
        return (
          <Authorized
            requiredRole={VIEWER_ROLE}
            propsOverride={{
              isDraggable: true,
              isResizable: false,
              draggableHandle: null,
            }}
          >
            <KubernetesInstanceChart
              title="Pod Chart"
              source={source}
              timeRange={timeRange}
              manualRefresh={manualRefresh}
              layout={podLayouts}
              chartHeight={'podChartHeight'}
            />
          </Authorized>
        )
      }
      case 'kubernetes-volume-chart': {
        return (
          <Authorized
            requiredRole={VIEWER_ROLE}
            propsOverride={{
              isDraggable: true,
              isResizable: false,
              draggableHandle: null,
            }}
          >
            <KubernetesPowerFlexMetricsChart
              source={source}
              timeRange={timeRange}
              manualRefresh={manualRefresh}
            />
          </Authorized>
        )
      }
      default:
        return null
    }
  }

  return (
    <Page className="kubernetes-pod-volume-page">
      <Page.Contents fullWidth={true}>
        <div className="dashboard container-fluid full-width">
          {!!cells && cells.length > 0 && (
            <Authorized
              requiredRole={VIEWER_ROLE}
              propsOverride={{
                isDraggable: true,
                isResizable: false,
                draggableHandle: null,
              }}
            >
              <GridLayout
                className="layout"
                layout={cells}
                cols={96}
                rowHeight={DASHBOARD_LAYOUT_ROW_HEIGHT}
                margin={[LAYOUT_MARGIN, LAYOUT_MARGIN]}
                containerPadding={[0, 0]}
                draggableHandle={'.kubernetes-powerflex-dash-graph--draggable'}
                onLayoutChange={handleLayoutChange}
                useCSSTransforms={false}
                isDraggable={true}
                isResizable={true}
                onResizeStop={(_, __, ___, ____, _____, resizeHandle) => {
                  const parentElement = resizeHandle?.parentElement

                  if (parentElement?.classList.contains('resizing')) {
                    parentElement.classList.remove('resizing')
                  }
                }}
              >
                {cells?.map(cell => {
                  return (
                    <div key={cell.i}>
                      {layoutRender({
                        cell: cell,
                        source: source,
                      })}
                    </div>
                  )
                })}
              </GridLayout>
            </Authorized>
          )}
        </div>
      </Page.Contents>
    </Page>
  )
}

const mstp = state => {
  return {
    podChartHeight: state.kubernetesPowerFlexDashboard.podChartHeight,
    volumeChartHeight: state.kubernetesPowerFlexDashboard.volumeChartHeight,
  }
}
const mdtp = dispatch => ({
  setPodChartHeight: bindActionCreators(setPodChartHeight, dispatch),
  setVolumeChartHeight: bindActionCreators(setVolumeChartHeight, dispatch),
})

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(
  connect(mstp, mdtp, null)(KubernetesPodDashboardSection),
  isEqual
)
