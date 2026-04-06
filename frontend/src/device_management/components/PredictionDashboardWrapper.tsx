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
import {Cell, Source, Template, TemplateValue, TimeRange, TimeZones} from 'src/types'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'

// Utils
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

// Redux
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {setHistogramDate} from 'src/device_management/actions'

import {CLOUD_TIME_RANGE} from 'src/shared/data/timeRanges'

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
  setHistogramDate?: (value: TimeRange | null) => void
  timeZone?: TimeZones
  predictionManualRefresh?: number
  cloudTimeRange?: CloudTimeRange
  histogramDate?: TimeRange | null
}

function PredictionDashboardWrapper({
  cell,
  source,
  cloudAutoRefresh,
  timeZone,
  setHistogramDate,
  cloudTimeRange,
  histogramDate,
}: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const handleDateClick = (timeRange: TimeRange) => {
    setHistogramDate?.(timeRange)
  }

  const handleDateRangeSelect = (timeRange: TimeRange) => {
    setHistogramDate?.(timeRange)
  }

  const handleDateClear = () => {
    setHistogramDate?.(null)
  }

  const predictionQueryTimeRange =
    cloudTimeRange?.prediction ?? CLOUD_TIME_RANGE.prediction

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
          style={{height: 'calc(100% - 50px)'}}
        >
          <ChartJSAlertBarChart
            cell={rebuiltCell}
            source={source}
            timeZone={timeZone}
            queryTimeRange={predictionQueryTimeRange}
            histogramDate={histogramDate}
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
    predictionDashboard: {histogramDate},
  } = state

  return {
    timeZone,
    cloudAutoRefresh,
    cloudTimeRange,
    histogramDate,
  }
}

const mdtp = (dispatch: any) => ({
  setHistogramDate: bindActionCreators(setHistogramDate, dispatch),
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

  const prevH = prevProps.histogramDate
  const nextH = nextProps.histogramDate
  if (prevH?.lower !== nextH?.lower || prevH?.upper !== nextH?.upper) {
    return false
  }
  if ((prevH == null) !== (nextH == null)) {
    return false
  }

  return true
}

export default React.memo(
  connect(mstp, mdtp, null)(PredictionDashboardWrapper),
  areEqual
)
