import React, {useEffect, useState} from 'react'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'
import {
  TEMP_VAR_DASHBOARD_TIME,
  TEMP_VAR_UPPER_DASHBOARD_TIME,
} from 'src/shared/constants'
import {
  AnomalyFactor,
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
import {convertTimeFormat} from 'src/utils/timeSeriesTransformers'
import Layout from 'src/shared/components/Layout'
import LoadingDots from 'src/shared/components/LoadingDots'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {
  setHistogramDate,
  setPredictionTimeRange,
  setSelectedAnomaly,
} from '../actions'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {CloudAutoRefresh} from 'src/clouds/types/type'

interface Props {
  cell: Cell
  host: string
  onZoom?: () => void
  onCloneCell?: () => void
  onDeleteCell?: () => void
  onSummonOverlayTechnologies?: () => void
  instance?: object
  onPickTemplate?: (template: Template, value: TemplateValue) => void
  source: Source
  sources: Source[]
  manualRefresh: number
  predictionTimeRange?: TimeRange
  cloudAutoRefresh?: CloudAutoRefresh
  setPredictionTimeRange?: (value: TimeRange) => void
  setHistogramDate?: (value: TimeRange) => void
  setSelectedAnomaly?: (anomalyFactor: AnomalyFactor) => void
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
  predictionTimeRange,
  source,
  manualRefresh,
  cloudAutoRefresh,
  setHistogramDate,
  setSelectedAnomaly,
}: Props) {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh.prediction)
  }, [cloudAutoRefresh.prediction])

  const templates = (): Template[] => {
    const dashboardTime = {
      id: 'dashtime',
      tempVar: TEMP_VAR_DASHBOARD_TIME,
      type:
        predictionTimeRange.format === INPUT_TIME_TYPE.TIMESTAMP
          ? TemplateType.TimeStamp
          : TemplateType.Constant,
      label: '',
      values: [
        {
          value: predictionTimeRange.lower,
          type:
            predictionTimeRange.format === INPUT_TIME_TYPE.TIMESTAMP
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
        predictionTimeRange.format === INPUT_TIME_TYPE.TIMESTAMP
          ? TemplateType.TimeStamp
          : TemplateType.Constant,
      label: '',
      values: [
        {
          value: predictionTimeRange.upper ?? 'now()',
          type:
            predictionTimeRange.format === INPUT_TIME_TYPE.TIMESTAMP &&
            predictionTimeRange.upper !== 'now()'
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
    setSelectedAnomaly({
      host: '',
      time: '',
    })
    setHistogramDate({
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
        <div className="dash-graph--name">
          {isLoading && (
            <LoadingDots
              className={'graph-panel__refreshing openstack-dots--loading'}
            />
          )}
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
          timeRange={predictionTimeRange}
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

const mstp = state => {
  const {
    predictionDashboard: {predictionTimeRange},
    app: {
      persisted: {cloudAutoRefresh},
    },
  } = state

  return {
    predictionTimeRange,
    cloudAutoRefresh,
  }
}

const mdtp = (dispatch: any) => ({
  setPredictionTimeRange: bindActionCreators(setPredictionTimeRange, dispatch),
  setHistogramDate: bindActionCreators(setHistogramDate, dispatch),
  setSelectedAnomaly: bindActionCreators(setSelectedAnomaly, dispatch),
})

const areEqual = (prev, next) => {
  return prev === next
}
export default React.memo(
  connect(mstp, mdtp, null)(PredictionDashboardWrapper),

  areEqual
)
