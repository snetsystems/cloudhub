import React, {useMemo, useEffect} from 'react'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'
import LogAnalysisDashboardHeader from './LogAnalysisDashboardHeader'
import Layout from 'src/shared/components/Layout'

import {
  Cell,
  INPUT_TIME_TYPE,
  Source,
  Template,
  TemplateValueType,
  TimeRange,
  TimeZones,
  TemplateType,
  TemplateValue,
} from 'src/types'
import {Instance} from 'src/hosts/types'
import {
  TEMP_VAR_DASHBOARD_TIME,
  TEMP_VAR_UPPER_DASHBOARD_TIME,
} from 'src/shared/constants'
import {timeRanges} from 'src/shared/data/timeRanges'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'

interface Props {
  cell: Cell
  host: string
  source: Source
  sources: Source[]
  isEditable: boolean

  onZoom?: () => void
  onDeleteCell?: () => void
  onCloneCell?: () => void
  onSummonOverlayTechnologies?: () => void
  manualRefresh?: number
  instance?: Instance
  onPickTemplate?: (template: Template, value: TemplateValue) => void
  cloudTimeRange?: CloudTimeRange
  cloudAutoRefresh?: CloudAutoRefresh
  timeZone?: TimeZones
}
function LogAnalysisAlertBarWrapper({
  cell,
  host,
  source,
  onZoom,
  sources,
  cloudTimeRange,
  onDeleteCell,
  onCloneCell,
  manualRefresh,
  onSummonOverlayTechnologies,
  instance,
  onPickTemplate,
  cloudAutoRefresh,
  timeZone,
}: Props) {
  const defaultTimeRange = timeRanges.find(i => i.inputValue === 'Past 30d')

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh?.logAnalysis)
  }, [cloudAutoRefresh?.logAnalysis])

  const isTimeStamp = useMemo(() => {
    return cloudTimeRange?.logAnalysis?.format === INPUT_TIME_TYPE.TIMESTAMP
  }, [cloudTimeRange?.logAnalysis])

  const templates = (): Template[] => {
    const dashboardTime = {
      id: 'dashtime',
      tempVar: TEMP_VAR_DASHBOARD_TIME,
      type: isTimeStamp ? TemplateType.TimeStamp : TemplateType.Constant,
      label: '',
      values: [
        {
          value: cloudTimeRange?.logAnalysis?.lower ?? 'now() - 30d',
          type: isTimeStamp
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
      type: isTimeStamp ? TemplateType.TimeStamp : TemplateType.Constant,
      label: '',
      values: [
        {
          value: cloudTimeRange?.logAnalysis?.upper ?? 'now()',
          type:
            isTimeStamp && cloudTimeRange?.logAnalysis?.upper !== 'now()'
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
    //click event
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
      <LogAnalysisDashboardHeader
        cellName={`Anomaly LogAnalysis Counts Histogram`}
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
      >
        <div className="dash-graph--name"></div>
      </LogAnalysisDashboardHeader>
      {!!cell && (
        <Layout
          key={cell.i}
          cell={reBuildQuery(cell)}
          host={host}
          source={source}
          onZoom={onZoom}
          sources={sources}
          templates={templates()}
          timeRange={cloudTimeRange?.logAnalysis ?? defaultTimeRange}
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
    app: {
      persisted: {cloudAutoRefresh, timeZone, cloudTimeRange},
    },
  } = state
  return {
    cloudTimeRange,
    cloudAutoRefresh,
    timeZone,
  }
}

export default connect(mstp)(LogAnalysisAlertBarWrapper)
