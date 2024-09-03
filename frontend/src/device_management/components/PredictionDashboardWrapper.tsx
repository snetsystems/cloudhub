import React, {useEffect, useState} from 'react'

//Components
import Layout from 'src/shared/components/Layout'
import LoadingDots from 'src/shared/components/LoadingDots'
import PredictionDashboardHeader from 'src/device_management/components/PredictionDashboardHeader'

// Constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'
import {
  TEMP_VAR_DASHBOARD_TIME,
  TEMP_VAR_UPPER_DASHBOARD_TIME,
} from 'src/shared/constants'

// Types
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
  TimeZones,
} from 'src/types'
import {CloudAutoRefresh} from 'src/clouds/types/type'

// Utils
import {convertTimeFormat} from 'src/utils/timeSeriesTransformers'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

// Redux
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {
  setAlertHostList,
  setHistogramDate,
  setPredictionTimeRange,
  setSelectedAnomaly,
} from 'src/device_management/actions'
import moment from 'moment'

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
  predictionTimeRange?: TimeRange
  cloudAutoRefresh?: CloudAutoRefresh
  setPredictionTimeRange?: (value: TimeRange) => void
  setHistogramDate?: (value: TimeRange) => void
  setSelectedAnomaly?: (anomalyFactor: AnomalyFactor) => void
  timeZone?: TimeZones
  setAlertHostList?: (value: string[]) => void
  predictionManualRefresh?: number
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
  cloudAutoRefresh,
  setHistogramDate,
  setSelectedAnomaly,
  timeZone,
  setAlertHostList,
  predictionManualRefresh,
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
    setAlertHostList([])
    //86,400,000ms = 1d
    if (timeZone === TimeZones.UTC) {
      setHistogramDate({
        lower: convertTimeFormat(time),
        upper: convertTimeFormat(time + 86400000),
        format: INPUT_TIME_TYPE.TIMESTAMP,
      })
    } else {
      setHistogramDate({
        lower: convertTimeFormat(
          moment(time).format('YYYY-MM-DDTHH:mm:ss.SSS')
        ),
        upper: convertTimeFormat(
          moment(time + 86400000).format('YYYY-MM-DDTHH:mm:ss.SSS')
        ),
        format: INPUT_TIME_TYPE.TIMESTAMP,
      })
    }
  }

  const reBuildQuery = (cell: Cell) => {
    return {
      ...cell,
      ...{
        graphOptions: {
          ...cell.graphOptions,
          clickCallback: (_, __, points) => {
            //consider double click debounce
            handleClickDate(points[0].xval)
          },
        },
        queries: cell.queries.map(i => {
          return {
            ...i,
            groupbys: ['time(1d)'],
            wheres: [],
            tz:
              timeZone === TimeZones.UTC
                ? 'UTC'
                : `${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
          }
        }),
      },
    }
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
          cell={reBuildQuery(cell)}
          host={host}
          source={source}
          onZoom={onZoom}
          sources={sources}
          templates={templates()}
          timeRange={predictionTimeRange}
          isEditable={false}
          onDeleteCell={onDeleteCell}
          onCloneCell={onCloneCell}
          manualRefresh={predictionManualRefresh}
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
    predictionDashboard: {predictionTimeRange, predictionManualRefresh},
    app: {
      persisted: {cloudAutoRefresh, timeZone},
    },
  } = state

  return {
    timeZone,
    predictionManualRefresh,
    predictionTimeRange,
    cloudAutoRefresh,
  }
}

const mdtp = (dispatch: any) => ({
  setPredictionTimeRange: bindActionCreators(setPredictionTimeRange, dispatch),
  setHistogramDate: bindActionCreators(setHistogramDate, dispatch),
  setSelectedAnomaly: bindActionCreators(setSelectedAnomaly, dispatch),
  setAlertHostList: bindActionCreators(setAlertHostList, dispatch),
})

const areEqual = (prev, next) => {
  return prev === next
}
export default React.memo(
  connect(mstp, mdtp, null)(PredictionDashboardWrapper),

  areEqual
)
