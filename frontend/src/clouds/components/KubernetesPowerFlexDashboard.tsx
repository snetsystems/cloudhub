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
import KubernetesPowerFlexMetricsChart from 'src/clouds/components/KubernetesPowerFlexMetricsChart'
import KubernetesPowerFlexStatusSummaryChart from 'src/clouds/components/KubernetesPowerFlexStatusSummaryChart'
import KubernetesPowerFlexResourceUsageChart from 'src/clouds/components/KubernetesPowerFlexResourceUsageChart'

// Constants
import {FIXTURE_KUBERNETES_POWERFLEX_CELLS} from 'src/clouds/constants/fixture'

// Actions
import {setPowerFlexMetricsChartHeight} from 'src/clouds/actions/kubernetesPowerFlex'

interface Props {
  source: Source
  timeRange: any
  manualRefresh: any
  setPowerFlexMetricsChartHeight?: (height: number) => void
}

interface TempProps {
  cell: Cell
  source: Source
}

function KubernetesPowerFlexDashboard({
  source,
  timeRange,
  manualRefresh,
  setPowerFlexMetricsChartHeight,
}: Props) {
  const GridLayout = WidthProvider(ReactGridLayout)

  const savedCells = JSON.parse(
    localStorage.getItem('Kubernetes-PowerFlex-cells')
  )

  const cells = useMemo(() => {
    const defaultCells = FIXTURE_KUBERNETES_POWERFLEX_CELLS()

    if (!!savedCells) {
      return savedCells
    } else {
      return defaultCells
    }
  }, [savedCells])

  const setLocalCells = (cells: DashboardsModels.Cell[]) => {
    localStorage.setItem('Kubernetes-PowerFlex-cells', JSON.stringify(cells))
  }

  const handleLayoutChange = layout => {
    let changed = false
    const newCells = cells.map(cell => {
      const l = layout.find(ly => ly.i === cell.i)

      if (l.i === 'kubernetes-powerflex-metrics-chart') {
        setPowerFlexMetricsChartHeight(l.h)
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
      case 'kubernetes-powerflex-metrics-chart': {
        return (
          <Authorized
            requiredRole={VIEWER_ROLE}
            propsOverride={{
              isDraggable: false,
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
      case 'kubernetes-powerflex-status-summary': {
        return (
          <Authorized
            requiredRole={VIEWER_ROLE}
            propsOverride={{
              isEditable: false,
            }}
          >
            <KubernetesPowerFlexStatusSummaryChart />
          </Authorized>
        )
      }
      case 'kubernetes-powerflex-resource-usage': {
        return (
          <Authorized
            requiredRole={VIEWER_ROLE}
            propsOverride={{
              isEditable: false,
            }}
          >
            <KubernetesPowerFlexResourceUsageChart />
          </Authorized>
        )
      }
      default:
        return null
    }
  }

  return (
    <>
      <Page className="kubernetes-powerflex-page">
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
                  draggableHandle={
                    '.kubernetes-powerflex-dash-graph--draggable'
                  }
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
    </>
  )
}

const mstp = _ => {
  return {}
}

const mdtp = dispatch => ({
  setPowerFlexMetricsChartHeight: bindActionCreators(
    setPowerFlexMetricsChartHeight,
    dispatch
  ),
})

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(
  connect(mstp, mdtp, null)(KubernetesPowerFlexDashboard),
  isEqual
)
