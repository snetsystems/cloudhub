import React, {useEffect, useMemo} from 'react'
import {connect} from 'react-redux'
import {Button, ComponentColor, Page} from 'src/reusable_ui'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import * as notifyActions from 'src/shared/actions/notifications'
import * as DashboardsModels from 'src/types/dashboards'
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import {
  DASHBOARD_LAYOUT_ROW_HEIGHT,
  LAYOUT_MARGIN,
  TEMP_VAR_DASHBOARD_TIME,
  TEMP_VAR_UPPER_DASHBOARD_TIME,
} from 'src/shared/constants'
import {
  Cell,
  INPUT_TIME_TYPE,
  Source,
  Template,
  TemplateType,
  TemplateValue,
  TemplateValueType,
  TimeRange,
} from 'src/types'
import PredictionDashboardHeader from './PredictionDashboardHeader'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'
import {fixturePredictionPageCells} from '../constants'
import _ from 'lodash'
import Layout from 'src/shared/components/Layout'
import {Link} from 'react-router'
import PredictionHexbinWrapper from './PredictionHexbinWrapper'
import ManualRefresh, {
  ManualRefreshProps,
} from 'src/shared/components/ManualRefresh'
import {WithRouterProps} from 'react-router'
import PredictionInstanceWrapper from './PredictionInstanceWrapper'
import {convertTimeFormat} from 'src/utils/timeSeriesTransformers'
import moment from 'moment'
import PredictionAlertHistoryWrapper from './PredictionAlertHistoryWrapper'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

interface Props extends ManualRefreshProps, WithRouterProps {
  inPresentationMode: boolean
  timeRange: TimeRange
  source: Source
  host: string
  sources: Source[]
  setSelectDate: React.Dispatch<React.SetStateAction<number>>
  setTimeRange: (value: TimeRange) => void

  autoRefresh?: number
  onZoom?: () => void
  onCloneCell?: () => void
  onDeleteCell?: () => void
  onSummonOverlayTechnologies?: () => void
  instance?: object
  onPickTemplate?: (template: Template, value: TemplateValue) => void
}

interface TempProps {
  timeRange: TimeRange
  cell: Cell
  source: Source
}

function PredictionDashBoard({
  inPresentationMode,
  timeRange,
  source,
  autoRefresh,
  host,
  onZoom,
  onCloneCell,
  onDeleteCell,
  onSummonOverlayTechnologies,
  sources,
  manualRefresh,
  instance,
  onPickTemplate,
  setSelectDate,
  setTimeRange,
}: Props) {
  const GridLayout = WidthProvider(ReactGridLayout)

  const savedCells: DashboardsModels.Cell[] = JSON.parse(
    localStorage.getItem('Prediction-cells')
  )
  let intervalID
  useEffect(() => {
    const controller = new AbortController()

    if (autoRefresh) {
      clearInterval(intervalID)
      // intervalID = window.setInterval(() => fetchKapacitor(), autoRefresh)
    }

    GlobalAutoRefresher.poll(autoRefresh)

    return () => {
      controller.abort()
      clearInterval(intervalID)
      intervalID = null
      GlobalAutoRefresher.stopPolling()
    }
  }, [])

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

  const templates = (): Template[] => {
    const dashboardTime = {
      id: 'dashtime',
      tempVar: TEMP_VAR_DASHBOARD_TIME,
      type:
        timeRange.format === INPUT_TIME_TYPE.TIMESTAMP
          ? TemplateType.TimeStamp
          : TemplateType.Constant,
      label: '',
      values: [
        {
          value: timeRange.lower,
          type:
            timeRange.format === INPUT_TIME_TYPE.TIMESTAMP
              ? TemplateValueType.TimeStamp
              : TemplateValueType.Constant,
          selected: true,
          localSelected: true,
        },
      ],
    }

    const upperDashboardTime = {
      id: 'upperdashtime',
      tempVar: TEMP_VAR_UPPER_DASHBOARD_TIME,
      type:
        timeRange.format === INPUT_TIME_TYPE.TIMESTAMP
          ? TemplateType.TimeStamp
          : TemplateType.Constant,
      label: '',
      values: [
        {
          value: timeRange.upper ?? 'now()',
          type:
            timeRange.format === INPUT_TIME_TYPE.TIMESTAMP &&
            timeRange.upper !== 'now()'
              ? TemplateValueType.TimeStamp
              : TemplateValueType.Constant,
          selected: true,
          localSelected: true,
        },
      ],
    }

    return [dashboardTime, upperDashboardTime]
  }

  const layoutRender = ({cell, source, timeRange}: TempProps) => {
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
            <div style={{height: '100%', backgroundColor: '#292933'}}>
              <PredictionDashboardHeader
                cellName={`Anomaly Prediction Counts Histogram`}
                cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
                cellTextColor={DEFAULT_CELL_TEXT_COLOR}
              >
                <div style={{zIndex: 3}} className="page-header--right">
                  <Button
                    text="get 30days"
                    color={ComponentColor.Primary}
                    onClick={() => {
                      setTimeRange({
                        upper: convertTimeFormat(moment().format()),
                        lower: convertTimeFormat(
                          moment().subtract(30, 'day').format()
                        ),
                        format: INPUT_TIME_TYPE.TIMESTAMP,
                      })
                    }}
                  />
                </div>
              </PredictionDashboardHeader>
              {!!cell && (
                <Layout
                  key={cell.i}
                  cell={{
                    ...cell,
                    ...{
                      graphOptions: {
                        ...cell.graphOptions,
                        clickCallback: (_, __, points) => {
                          //consider double click debounce
                          setSelectDate(points[0].xval)
                        },
                      },
                    },
                  }}
                  host={host}
                  source={source}
                  onZoom={onZoom}
                  sources={sources}
                  templates={templates()}
                  timeRange={timeRange}
                  isEditable={false}
                  onDeleteCell={onDeleteCell}
                  onCloneCell={onCloneCell}
                  manualRefresh={manualRefresh}
                  onSummonOverlayTechnologies={onSummonOverlayTechnologies}
                  instance={instance}
                  onPickTemplate={onPickTemplate}
                />
              )}
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
            <PredictionAlertHistoryWrapper
              timeRange={timeRange}
              source={source}
              limit={30}
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
            manualRefresh={manualRefresh}
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
                          timeRange: timeRange,
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
      persisted: {autoRefresh},
    },
    auth: {isUsingAuth},
  } = state

  return {
    inPresentationMode,
    isUsingAuth,
    autoRefresh,
  }
}

const mdtp = {
  notify: notifyActions.notify,
}

export default connect(mstp, mdtp, null)(ManualRefresh(PredictionDashBoard))
