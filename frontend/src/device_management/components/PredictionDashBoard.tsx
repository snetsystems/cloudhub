import React, {useEffect, useState} from 'react'
import {connect} from 'react-redux'
import {Page} from 'src/reusable_ui'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import * as notifyActions from 'src/shared/actions/notifications'
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import {DASHBOARD_LAYOUT_ROW_HEIGHT, LAYOUT_MARGIN} from 'src/shared/constants'
import {Cell, Source, TimeRange} from 'src/types'
import {fastMap} from 'src/utils/fast'
import PredictionDashboardHeader from './PredictionDashboardHeader'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'
import {RECENT_ALERTS_LIMIT} from 'src/status/constants'
import PredictionAlertTable from './PredictionAlertTable'
import {fixturePredictionPageCells} from '../constants'
import PredictionHexbin from './PredictionHexbin'

interface Props {
  inPresentationMode: boolean
  timeRange: TimeRange
  source: Source
}

interface TempProps {
  timeRange: TimeRange
  cell: Cell
  source: Source
}

function PredictionDashBoard({inPresentationMode, timeRange, source}: Props) {
  const GridLayout = WidthProvider(ReactGridLayout)

  const [cells, setCells] = useState(null)

  useEffect(() => {
    const defaultCells = fixturePredictionPageCells()

    const savedCells = localStorage.getItem('Prediction-cells')
    if (cells === null) {
      if (!savedCells) {
        setCells(defaultCells)
      } else {
        setCells(JSON.parse(savedCells))
      }
    } else {
      localStorage.setItem('Prediction-cells', JSON.stringify(cells))
    }
  }, [cells])

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
      setCells(newCells)
    }
  }

  const layoutRender = ({cell, source, timeRange}: TempProps) => {
    switch (cell.i) {
      case 'alerts-bar-graph': {
        return (
          <Authorized
            requiredRole={EDITOR_ROLE}
            propsOverride={{
              isEditable: false,
            }}
          >
            <div style={{height: '100%', backgroundColor: '#292933'}}>
              <PredictionDashboardHeader
                cellName={`Monitoring (${cell.i})`}
                cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
                cellTextColor={DEFAULT_CELL_TEXT_COLOR}
              >
                <div className="dash-graph--name">asdadsasda</div>
              </PredictionDashboardHeader>

              <div>{'this.CloudGaugeContents'}</div>
            </div>
          </Authorized>
        )
      }
      case 'history': {
        return (
          <Authorized
            requiredRole={EDITOR_ROLE}
            propsOverride={{
              isEditable: false,
            }}
          >
            <div style={{height: '100%', backgroundColor: '#292933'}}>
              <PredictionDashboardHeader
                cellName={`Monitoring (${cell.i})`}
                cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
                cellTextColor={DEFAULT_CELL_TEXT_COLOR}
              >
                <div className="dash-graph--name">test</div>
              </PredictionDashboardHeader>

              <PredictionAlertTable
                source={source}
                timeRange={timeRange}
                isWidget={true}
                limit={RECENT_ALERTS_LIMIT}
              />
            </div>
          </Authorized>
        )
      }
      case 'polygon': {
        return (
          <Authorized
            requiredRole={EDITOR_ROLE}
            propsOverride={{
              isEditable: false,
            }}
          >
            <div style={{height: '100%', backgroundColor: '#292933'}}>
              <PredictionDashboardHeader
                cellName={`Monitoring (${cell.i})`}
                cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
                cellTextColor={DEFAULT_CELL_TEXT_COLOR}
              >
                <div className="dash-graph--name">Hello</div>
              </PredictionDashboardHeader>
              <PredictionHexbin />
            </div>
          </Authorized>
        )
      }
    }
  }

  return (
    <>
      <Page className="prediction-page">
        <Page.Contents fullWidth={true} inPresentationMode={inPresentationMode}>
          <div className="dashboard  container-fluid full-width">
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
                  containerPadding={[20, 10]}
                  draggableHandle={'.prediction-dash-graph--draggable'}
                  onLayoutChange={handleLayoutChange}
                  useCSSTransforms={false}
                  isDraggable={true}
                  isResizable={true}
                >
                  {fastMap(cells, cell => (
                    <div key={cell.i}>
                      {layoutRender({
                        cell: cell,
                        source: source,
                        timeRange: timeRange,
                      })}
                    </div>
                  ))}
                </GridLayout>
              </Authorized>
            )}
          </div>
        </Page.Contents>
      </Page>
    </>
  )
}

// tslint:disable-next-line: variable-name

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

const mdtp = {
  notify: notifyActions.notify,
}

export default connect(mstp, mdtp, null)(PredictionDashBoard)
