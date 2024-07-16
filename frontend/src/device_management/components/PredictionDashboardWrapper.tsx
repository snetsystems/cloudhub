import React from 'react'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'
import {
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
import {Button, ComponentColor} from 'src/reusable_ui'
import {convertTimeFormat} from 'src/utils/timeSeriesTransformers'
import moment from 'moment'
import Layout from 'src/shared/components/Layout'

interface Props {
  cell: Cell
  host: string
  onZoom?: () => void
  onCloneCell?: () => void
  onDeleteCell?: () => void
  onSummonOverlayTechnologies?: () => void
  instance?: object
  onPickTemplate?: (template: Template, value: TemplateValue) => void
  setSelectDate: React.Dispatch<React.SetStateAction<number>>
  timeRange: TimeRange
  source: Source
  sources: Source[]
  manualRefresh: number
  setChartClickDate: (date: TimeRange) => void
  setTimeRange: (value: TimeRange) => void
}

function PredictionDashboardWrapper({
  cell,
  host,
  onZoom,
  onCloneCell,
  onDeleteCell,
  onSummonOverlayTechnologies,
  sources,
  instance,
  onPickTemplate,
  timeRange,
  source,
  manualRefresh,
  setChartClickDate,
  setTimeRange,
}: Props) {
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

  const handleClickDate = (time: number) => {
    setChartClickDate({
      lower: convertTimeFormat(time - 32400000),
      upper: convertTimeFormat(time + 54000000),
      format: INPUT_TIME_TYPE.TIMESTAMP,
    })
  }

  return (
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
                lower: convertTimeFormat(moment().subtract(30, 'day').format()),
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
                  handleClickDate(points[0].xval)
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
  )
}

export default PredictionDashboardWrapper
