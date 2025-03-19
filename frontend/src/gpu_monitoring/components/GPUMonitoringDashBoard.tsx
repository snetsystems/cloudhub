// Library
import React, {useMemo, useState} from 'react'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import _ from 'lodash'
import {connect} from 'react-redux'

// Components
import {Page} from 'src/reusable_ui'
import GPUMonitoringTreeMapWrapper from 'src/gpu_monitoring/components/GPUMonitoringTreeMapWrapper'
import GPUMonitoringCellsGraphWrapper from 'src/gpu_monitoring/components/GPUMonitoringCellsGraphWrapper'

// Type
import * as DashboardsModels from 'src/types/dashboards'
import {Cell, Source} from 'src/types'

// Constants
import {FIXTURE_GPU_MONITORING_CELLS} from 'src/gpu_monitoring/constants'
import {DASHBOARD_LAYOUT_ROW_HEIGHT, LAYOUT_MARGIN} from 'src/shared/constants'
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'

interface Props {
  source: Source
  sources: Source[]
  inPresentationMode?: boolean
}

interface TempProps {
  cell: Cell
  source: Source
}

function GPUMonitoringDashBoard({inPresentationMode, source}: Props) {
  const [isMockActive, setIsMockActive] = useState(false)

  const GridLayout = WidthProvider(ReactGridLayout)
  const savedCells: DashboardsModels.Cell[] = JSON.parse(
    localStorage.getItem('GPU-Monitoring-cells')
  )

  const cells = useMemo(() => {
    const defaultCells = FIXTURE_GPU_MONITORING_CELLS(source)

    if (!!savedCells) {
      return savedCells
    } else {
      return defaultCells
    }
  }, [savedCells])

  const setLocalCells = (cells: DashboardsModels.Cell[]) => {
    localStorage.setItem('GPU-Monitoring-cells', JSON.stringify(cells))
  }

  const handleLayoutChange = layout => {
    let changed = false

    const newCells = cells.map(cell => {
      const l = layout.find(ly => ly.i === cell.i)

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

  const layoutRender = ({cell}: TempProps) => {
    if (!cell) return null
    switch (cell.i) {
      case 'gpu-monitoring': {
        return (
          <Authorized
            requiredRole={EDITOR_ROLE}
            propsOverride={{
              isEditable: false,
            }}
          >
            <GPUMonitoringTreeMapWrapper
              isMockActive={isMockActive}
              setIsMockActive={setIsMockActive}
              source={source}
            />
          </Authorized>
        )
      }
      case 'gpu-statistics': {
        return (
          <Authorized
            requiredRole={EDITOR_ROLE}
            propsOverride={{
              isEditable: false,
            }}
          >
            <GPUMonitoringCellsGraphWrapper
              title="Statistic Graph"
              cellKey="d61cdfb1-babd-459a-87b9-5c271360655e"
              source={source}
              xNum={2}
            />
          </Authorized>
        )
      }
      case 'gpu-series': {
        return (
          <Authorized
            requiredRole={EDITOR_ROLE}
            propsOverride={{
              isEditable: false,
            }}
          >
            <GPUMonitoringCellsGraphWrapper
              title="Time Series Graph"
              cellKey="37b0740a-79ac-4f4c-8ca0-e223a47400b8"
              source={source}
              xNum={4}
            />
          </Authorized>
        )
      }
      default:
        return null
    }
  }

  return (
    <>
      <Page className="gpu-monitoring-page">
        <Page.Contents fullWidth={true} inPresentationMode={inPresentationMode}>
          <div className="dashboard container-fluid full-width">
            {!!cells && cells.length > 0 && (
              <Authorized
                requiredRole={EDITOR_ROLE}
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
                  draggableHandle={'.gpu-monitoring-dash-graph--draggable'}
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

const mstp = state => {
  const {
    app: {
      ephemeral: {inPresentationMode},
    },
  } = state

  return {
    inPresentationMode,
  }
}

const mdtp = () => ({})

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(
  connect(mstp, mdtp, null)(GPUMonitoringDashBoard),
  isEqual
)
