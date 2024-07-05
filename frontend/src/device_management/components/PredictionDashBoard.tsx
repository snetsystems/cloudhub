import React, {useEffect, useState} from 'react'
import {connect} from 'react-redux'
import {Page} from 'src/reusable_ui'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import * as notifyActions from 'src/shared/actions/notifications'
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import {
  DASHBOARD_LAYOUT_ROW_HEIGHT,
  LAYOUT_MARGIN,
  TEMP_VAR_DASHBOARD_TIME,
  TEMP_VAR_UPPER_DASHBOARD_TIME,
} from 'src/shared/constants'
import {
  Cell,
  Source,
  Template,
  TemplateType,
  TemplateValue,
  TemplateValueType,
  TimeRange,
} from 'src/types'
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
import {PredictionModal} from './PredictionModal'
import {Alert} from 'src/types/alerts'
import _ from 'lodash'
import Layout from 'src/shared/components/Layout'

interface Props {
  inPresentationMode: boolean
  timeRange: TimeRange
  source: Source
  setLimitMultiplier: React.Dispatch<React.SetStateAction<number>>
  fetchAlerts: () => void
  error: unknown
  loading: boolean
  hasKapacitor: boolean
  isAlertsMaxedOut: boolean
  alerts: Alert[]

  host: string
  onZoom?: () => void
  onCloneCell?: () => void
  onDeleteCell?: () => void
  onSummonOverlayTechnologies?: () => void
  sources: Source[]
  manualRefresh: number
  instance?: object
  onPickTemplate?: (template: Template, value: TemplateValue) => void
  setSelectDate: React.Dispatch<React.SetStateAction<number>>
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
  setLimitMultiplier,
  fetchAlerts,
  error,
  loading,
  hasKapacitor,
  isAlertsMaxedOut,
  alerts,

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
}: Props) {
  const GridLayout = WidthProvider(ReactGridLayout)

  const [cells, setCells] = useState(null)

  const [isPredictionModalOpen, setIsPredictionModalOpen] = useState(false)

  const [openNum, setOpenNum] = useState<number>(null)

  const [projects, setProject] = useState()

  const onHexbinClick = (num: number) => {
    if (openNum === num) {
      setIsPredictionModalOpen(prev => !prev)
    } else {
      setIsPredictionModalOpen(true)
      setOpenNum(num)
    }
  }

  const onHexbinLeave = () => {
    setIsPredictionModalOpen(false)
  }

  useEffect(() => {
    const defaultCells = fixturePredictionPageCells(source)
    const savedCells = localStorage.getItem('Prediction-cells')
    if (cells === null) {
      !savedCells ? setCells(defaultCells) : setCells(JSON.parse(savedCells))
    } else {
      localStorage.setItem('Prediction-cells', JSON.stringify(cells))
    }
  }, [cells, timeRange])

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

  const templates = (): Template[] => {
    const dashboardTime = {
      id: 'dashtime',
      tempVar: TEMP_VAR_DASHBOARD_TIME,
      type: TemplateType.TimeStamp,
      label: '',
      values: [
        {
          value: timeRange.lower,
          type: TemplateValueType.TimeStamp,
          selected: true,
          localSelected: true,
        },
      ],
    }

    const upperDashboardTime = {
      id: 'upperdashtime',
      tempVar: TEMP_VAR_UPPER_DASHBOARD_TIME,
      type: TemplateType.TimeStamp,
      label: '',
      values: [
        {
          value: timeRange.upper,
          type: TemplateValueType.TimeStamp,
          selected: true,
          localSelected: true,
        },
      ],
    }

    return [dashboardTime, upperDashboardTime]
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
                <div className="dash-graph--name">Monitoring Graph</div>
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
                  //timerange
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
            <div style={{height: '100%', backgroundColor: '#292933'}}>
              <PredictionDashboardHeader
                cellName={`Monitoring (${cell.i})`}
                cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
                cellTextColor={DEFAULT_CELL_TEXT_COLOR}
              >
                <div className="dash-graph--name">Alert History Table</div>
              </PredictionDashboardHeader>

              <PredictionAlertTable
                source={source}
                timeRange={timeRange}
                isWidget={true}
                limit={RECENT_ALERTS_LIMIT}
                alerts={alerts}
                error={error}
                fetchAlerts={fetchAlerts}
                hasKapacitor={hasKapacitor}
                isAlertsMaxedOut={isAlertsMaxedOut}
                loading={loading}
                setLimitMultiplier={setLimitMultiplier}
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
                <div className="dash-graph--name">Device Hexagon Chart</div>
              </PredictionDashboardHeader>
              <PredictionHexbin onHexbinClick={onHexbinClick} />
            </div>
          </Authorized>
        )
      }
      // case 'instanceGraph': {
      //   return (
      //     <OpenStackInstanceGraph
      //       source={source}
      //       timeRange={timeRange}
      //       filteredLayouts={filteredLayouts}
      //       instance={updateInstance}
      //       focusedInstance={focusedInstance}
      //       manualRefresh={manualRefresh}
      //       autoRefresh={autoRefresh}
      //     />
      //   )
      // }
    }
  }

  return (
    <>
      <Page className="prediction-page">
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
      {
        <PredictionModal
          isOpen={isPredictionModalOpen}
          setIsOpen={setIsPredictionModalOpen}
          index={openNum}
        />
      }
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
