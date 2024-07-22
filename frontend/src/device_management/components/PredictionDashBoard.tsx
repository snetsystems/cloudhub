import React, {useEffect, useMemo, useRef, useState} from 'react'
import {connect} from 'react-redux'
import {Page} from 'src/reusable_ui'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import * as DashboardsModels from 'src/types/dashboards'
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import {DASHBOARD_LAYOUT_ROW_HEIGHT, LAYOUT_MARGIN} from 'src/shared/constants'
import {Cell, Source, Template, TemplateValue, TimeRange} from 'src/types'
import {fixturePredictionPageCells} from '../constants'
import _ from 'lodash'
import {Link} from 'react-router'
import PredictionHexbinWrapper from './PredictionHexbinWrapper'
import {ManualRefreshProps} from 'src/shared/components/ManualRefresh'
import {WithRouterProps} from 'react-router'
import PredictionInstanceWrapper from './PredictionInstanceWrapper'
import PredictionAlertHistoryWrapper from './PredictionAlertHistoryWrapper'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {CloudAutoRefresh} from 'src/clouds/types/type'
import PredictionDashboardWrapper from './PredictionDashboardWrapper'
import {bindActionCreators} from 'redux'
import {setPredictionTimeRange} from '../actions'
import {setTimeRange} from 'src/dashboards/actions'

interface Props extends ManualRefreshProps, WithRouterProps {
  host: string
  source: Source
  sources: Source[]
  inPresentationMode?: boolean
  cloudAutoRefresh?: CloudAutoRefresh
  onZoom?: () => void
  onCloneCell?: () => void
  onDeleteCell?: () => void
  onSummonOverlayTechnologies?: () => void
  instance?: object
  onPickTemplate?: (template: Template, value: TemplateValue) => void
  predictionTimeRange?: TimeRange
  setPredictionTimeRange?: (value: TimeRange) => void
}

interface TempProps {
  cell: Cell
  source: Source
}

function PredictionDashBoard({
  onZoom,
  onCloneCell,
  onDeleteCell,
  onSummonOverlayTechnologies,
  sources,
  inPresentationMode,
  source,
  host,
  manualRefresh,
  cloudAutoRefresh,
  instance,
  onPickTemplate,
  predictionTimeRange,
}: Props) {
  const [chartClickDate, setChartClickDate] = useState<TimeRange>(null)

  const prevProps = useRef({manualRefresh: null, cloudAutoRefresh: null})

  const GridLayout = WidthProvider(ReactGridLayout)

  const savedCells: DashboardsModels.Cell[] = JSON.parse(
    localStorage.getItem('Prediction-cells')
  )
  let intervalID

  useEffect(() => {
    const controller = new AbortController()

    if (!!cloudAutoRefresh.prediction) {
      clearInterval(intervalID)
    }

    GlobalAutoRefresher.poll(cloudAutoRefresh.prediction)

    return () => {
      controller.abort()
      clearInterval(intervalID)
      intervalID = null
      GlobalAutoRefresher.stopPolling()
    }
  }, [])

  useEffect(() => {
    // Todo: manual Refresh rerendering issue, compare prevProps and next-props
    if (manualRefresh !== prevProps.current.manualRefresh)
      prevProps.current = {
        manualRefresh: manualRefresh,
        cloudAutoRefresh: cloudAutoRefresh,
      }
  }, [manualRefresh, cloudAutoRefresh])

  useEffect(() => {
    setChartClickDate(null)
  }, [predictionTimeRange])

  const cells = useMemo(() => {
    const defaultCells = fixturePredictionPageCells(source)

    if (!!savedCells) {
      return savedCells
    } else {
      return defaultCells
    }

    // localStorage.setItem('Prediction-cells', JSON.stringify(cells))
  }, [savedCells])

  const setLocalCells = (cells: DashboardsModels.Cell[]) => {
    localStorage.setItem('Prediction-cells', JSON.stringify(cells))
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

  const layoutRender = ({cell, source}: TempProps) => {
    if (!cell) return null
    switch (cell.i) {
      case 'alerts-bar-graph': {
        return (
          <Authorized
            requiredRole={EDITOR_ROLE}
            propsOverride={{
              isEditable: false,
            }}
          >
            <PredictionDashboardWrapper
              key={cell.i}
              cell={cell}
              host={host}
              source={source}
              onZoom={onZoom}
              sources={sources}
              onDeleteCell={onDeleteCell}
              onCloneCell={onCloneCell}
              onSummonOverlayTechnologies={onSummonOverlayTechnologies}
              instance={instance}
              onPickTemplate={onPickTemplate}
              setChartClickDate={setChartClickDate}
              manualRefresh={prevProps.current.manualRefresh}
            />
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
            <PredictionAlertHistoryWrapper
              source={source}
              limit={30}
              chartClickDate={chartClickDate}
            />
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
            <PredictionHexbinWrapper source={source} />
          </Authorized>
        )
      }
      case 'instanceGraph': {
        return (
          <PredictionInstanceWrapper
            source={source}
            manualRefresh={prevProps.current.manualRefresh}
          />
        )
      }
    }
  }

  return (
    <>
      <Page className="prediction-page">
        <div className="prediction-page--button">
          <Link
            to={`/sources/${source.id}/ai/device-management/prediction-rule`}
            className="btn btn-sm btn-primary"
            style={{marginRight: '4px'}}
          >
            <span className="icon cog-thick" /> Rule Setting
          </Link>
        </div>
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
                  draggableHandle={'.prediction-dash-graph--draggable'}
                  onLayoutChange={handleLayoutChange}
                  useCSSTransforms={false}
                  isDraggable={true}
                  isResizable={true}
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

// tslint:disable-next-line: variable-name

const mstp = state => {
  const {
    app: {
      ephemeral: {inPresentationMode},
    },
    auth: {isUsingAuth},
    predictionTimeRange: {predictionTimeRange},
  } = state

  return {
    predictionTimeRange,
    inPresentationMode,
    isUsingAuth,
  }
}

const mdtp = (dispatch: any) => ({
  setPredictionTimeRange: bindActionCreators(setPredictionTimeRange, dispatch),
  setTimeRange: bindActionCreators(setTimeRange, dispatch),
})

export default connect(mstp, mdtp, null)(PredictionDashBoard)
