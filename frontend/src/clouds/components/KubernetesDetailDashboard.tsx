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
import {Cell, Source} from 'src/types'

// Components
import {Page} from 'src/reusable_ui'
import KubernetesDetailMetricsChart from 'src/clouds/components/KubernetesDetailMetricsChart'

// Constants
import {FIXTURE_KUBERNETES_POWERFLEX_CELLS} from 'src/clouds/constants/fixture'

// Actions
import {setProxyMetricsChartHeight} from 'src/clouds/actions/kubernetesProxy'

interface Props {
  source: Source
  timeRange: any
  manualRefresh: any
  setProxyMetricsChartHeight?: (height: number) => void
}

interface TempProps {
  cell: Cell
  source: Source
}

function KubernetesDetailDashboard({
  source,
  timeRange,
  manualRefresh,
  setProxyMetricsChartHeight,
}: Props) {
  const GridLayout = WidthProvider(ReactGridLayout)

  const savedCells = JSON.parse(localStorage.getItem('Kubernetes-Detail-cells'))

  const cells = useMemo(() => {
    const defaultCells = FIXTURE_KUBERNETES_POWERFLEX_CELLS()

    if (!!savedCells) {
      return savedCells
    } else {
      return defaultCells
    }
  }, [savedCells])

  const setLocalCells = (cells: DashboardsModels.Cell[]) => {
    localStorage.setItem('Kubernetes-Detail-cells', JSON.stringify(cells))
  }

  const handleLayoutChange = layout => {
    let changed = false
    const newCells = cells.map(cell => {
      const l = layout.find(ly => ly.i === cell.i)

      if (l.i === 'kubernetes-detail-metrics-chart') {
        setProxyMetricsChartHeight(l.h)
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
      case 'kubernetes-detail-metrics-chart': {
        return (
          <Authorized
            requiredRole={VIEWER_ROLE}
            propsOverride={{
              isDraggable: false,
              isResizable: false,
              draggableHandle: null,
            }}
          >
            <KubernetesDetailMetricsChart
              title="Performance"
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
    <Page className="kubernetes-detail-page">
      <Page.Contents fullWidth={true}>
        <div className="dashboard container-fluid full-width">
          {!!cells && cells.length > 0 && (
            <Authorized
              requiredRole={VIEWER_ROLE}
              propsOverride={{
                isDraggable: false,
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
                draggableHandle={'.kubernetes-detail-dash-graph--draggable'}
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

const mstp = _ => {
  return {}
}

const mdtp = dispatch => ({
  setProxyMetricsChartHeight: bindActionCreators(
    setProxyMetricsChartHeight,
    dispatch
  ),
})

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(
  connect(mstp, mdtp, null)(KubernetesDetailDashboard),
  isEqual
)
