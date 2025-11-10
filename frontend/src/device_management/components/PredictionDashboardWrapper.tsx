import React, {useEffect, useMemo, useState, useCallback} from 'react'

// Components
import {ChartJSAlertBarChart} from 'src/shared/components/ChartJSAlertBarChart'
import LoadingDots from 'src/shared/components/LoadingDots'
import PredictionDashboardHeader from 'src/device_management/components/PredictionDashboardHeader'

// Constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

// Types
import {
  AlertHostList,
  AnomalyFactor,
  Cell,
  Source,
  Template,
  TemplateValue,
  TimeRange,
  TimeZones,
} from 'src/types'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'

// Utils
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

// Redux
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {
  setAlertHostList,
  setHistogramDate,
  setSelectedAnomaly,
} from 'src/device_management/actions'

// Reducers
import {initialState} from 'src/device_management/reducers/predictionDashboard'

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
  cloudAutoRefresh?: CloudAutoRefresh
  setHistogramDate?: (value: TimeRange) => void
  setSelectedAnomaly?: (anomalyFactor: AnomalyFactor) => void
  timeZone?: TimeZones
  setAlertHostList?: (value: AlertHostList) => void
  predictionManualRefresh?: number
  cloudTimeRange?: CloudTimeRange
}

function PredictionDashboardWrapper({
  cell,
  source,
  cloudAutoRefresh,
  timeZone,
  setHistogramDate,
  setSelectedAnomaly,
  setAlertHostList,
}: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const {selectedAnomaly, alertHostList, histogramDate} = initialState
  const handleDateClick = (timeRange: TimeRange) => {
    if (!setSelectedAnomaly || !setAlertHostList || !setHistogramDate) return

    setSelectedAnomaly(selectedAnomaly)
    setAlertHostList(alertHostList)
    setHistogramDate(timeRange)
  }

  const handleDateRangeSelect = (timeRange: TimeRange) => {
    if (!setSelectedAnomaly || !setAlertHostList || !setHistogramDate) return

    setSelectedAnomaly(selectedAnomaly)
    setAlertHostList(alertHostList)
    setHistogramDate(timeRange)
  }

  const handleDateClear = () => {
    if (!setSelectedAnomaly || !setAlertHostList || !setHistogramDate) return

    setSelectedAnomaly(selectedAnomaly)
    setAlertHostList(alertHostList)
    setHistogramDate(histogramDate)
  }

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh?.prediction)
  }, [cloudAutoRefresh?.prediction])

  const reBuildQuery = useCallback(
    (cell: Cell) => ({
      ...cell,
      queries: cell.queries.map(i => ({
        ...i,
        groupbys: ['time(1d)'],
        wheres: [],
        tz:
          timeZone === TimeZones.UTC
            ? 'UTC'
            : `${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
      })),
    }),
    [timeZone]
  )

  const rebuiltCell = useMemo(() => {
    if (!cell) return null
    return reBuildQuery(cell)
  }, [cell, reBuildQuery])

  return (
    <div style={{height: '100%', backgroundColor: '#292933'}}>
      <PredictionDashboardHeader
        cellName="Anomaly Prediction Counts Histogram"
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
      >
        {isLoading && (
          <LoadingDots className="graph-panel__refreshing openstack-dots--loading" />
        )}
      </PredictionDashboardHeader>

      {rebuiltCell && (
        <div
          className="dash-graph--container"
          style={{height: 'calc(100% - 32px)'}}
        >
          <ChartJSAlertBarChart
            cell={rebuiltCell}
            source={source}
            timeZone={timeZone}
            onDateClick={handleDateClick}
            onDateRangeSelect={handleDateRangeSelect}
            onDateClear={handleDateClear}
            onLoadingChange={setIsLoading}
          />
        </div>
      )}
    </div>
  )
}

const mstp = (state: any) => {
  const {
    app: {
      persisted: {cloudAutoRefresh, timeZone, cloudTimeRange},
    },
  } = state

  return {
    timeZone,
    cloudAutoRefresh,
    cloudTimeRange,
  }
}

const mdtp = (dispatch: any) => ({
  setHistogramDate: bindActionCreators(setHistogramDate, dispatch),
  setSelectedAnomaly: bindActionCreators(setSelectedAnomaly, dispatch),
  setAlertHostList: bindActionCreators(setAlertHostList, dispatch),
})

const areEqual = (prevProps, nextProps) => {
  if (
    prevProps.cell !== nextProps.cell ||
    prevProps.source !== nextProps.source
  ) {
    return false
  }

  if (prevProps.timeZone !== nextProps.timeZone) return false

  const prevTime = prevProps.cloudTimeRange?.prediction
  const nextTime = nextProps.cloudTimeRange?.prediction
  if (
    prevTime?.lower !== nextTime?.lower ||
    prevTime?.upper !== nextTime?.upper
  ) {
    return false
  }

  return true
}

export default React.memo(
  connect(mstp, mdtp, null)(PredictionDashboardWrapper),
  areEqual
)
