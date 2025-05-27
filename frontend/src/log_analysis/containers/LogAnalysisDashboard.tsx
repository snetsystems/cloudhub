// Library
import React, {useMemo} from 'react'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import _ from 'lodash'
import {connect} from 'react-redux'

// Components
import {Page} from 'src/reusable_ui'

// Type
import * as DashboardsModels from 'src/types/dashboards'
import {Cell, Source} from 'src/types'

// Constants
import {DASHBOARD_LAYOUT_ROW_HEIGHT, LAYOUT_MARGIN} from 'src/shared/constants'
import Authorized, {VIEWER_ROLE} from 'src/auth/Authorized'
import {FIXTURE_LOG_ANALYSIS_CELLS} from 'src/log_analysis/constants/fixture'

interface TempProps {
  cell: Cell
  source: Source
}

function LogAnalysisDashboard({inPresentationMode, source}) {
  const GridLayout = WidthProvider(ReactGridLayout)
  const savedCells: DashboardsModels.Cell[] = JSON.parse(
    localStorage.getItem('Log-Analysis-cells')
  )

  // TODO Add AutoRefresh Feat

  const cells = useMemo(() => {
    const defaultCells = FIXTURE_LOG_ANALYSIS_CELLS()

    if (!!savedCells) {
      return savedCells
    } else {
      return defaultCells
    }
  }, [savedCells])

  const setLocalCells = (cells: DashboardsModels.Cell[]) => {
    localStorage.setItem('Log-Analysis-cells', JSON.stringify(cells))
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
      default:
        return null
    }
  }

  return (
    <>
      <Page className="log-analysis-page">
        <Page.Contents fullWidth={true} inPresentationMode={inPresentationMode}>
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
                  draggableHandle={'.log-analysis-dash-graph--draggable'}
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
  connect(mstp, mdtp, null)(LogAnalysisDashboard),
  isEqual
)
