// Library
import React, {useEffect, useMemo, useState} from 'react'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import _ from 'lodash'
import {connect} from 'react-redux'

// Components
import {Button, Page} from 'src/reusable_ui'
import LogAnalysisSyslogTableWrapper from 'src/log_analysis/components/LogAnalysisSyslogTableWrapper'
import LogsFilterContainer from 'src/log_analysis/components/LogsFilterContainer'

// Type
import * as DashboardsModels from 'src/types/dashboards'
import {
  Cell,
  FilteredLogsForLogAnalysis,
  INPUT_TIME_TYPE,
  LogAnalysisManualRefresh,
  RefreshRate,
  Source,
  TimeRange,
  TimeZones,
} from 'src/types'

// Constants
import {DASHBOARD_LAYOUT_ROW_HEIGHT, LAYOUT_MARGIN} from 'src/shared/constants'
import Authorized, {VIEWER_ROLE} from 'src/auth/Authorized'
import {FIXTURE_LOG_ANALYSIS_CELLS} from 'src/log_analysis/constants/fixture'
import ToggleViewWrap from '../components/ToggleViewWrap'
import SidePanelSlice from 'src/shared/components/SidePanelSlice'
import {bindActionCreators} from 'redux'
import {closePanel, openPanel} from 'src/shared/actions/sidePanel'
import {setCloudAutoRefresh, setCloudTimeRange} from 'src/clouds/actions/clouds'
import {CloudTimeRange} from 'src/clouds/types/type'
import {CloudAutoRefresh} from 'src/clouds/types/type'
import {getTimeOptionByGroup} from 'src/clouds/constants/autoRefresh'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import {CLOUD_TIME_RANGE} from 'src/shared/data/timeRanges'
import * as appActions from 'src/shared/actions/app'
import TimeZoneToggle from 'src/shared/components/time_zones/TimeZoneToggle'
import SourceIndicator from 'src/shared/components/SourceIndicator'
import {setStateInitAction} from 'src/device_management/actions'
import TestCellsGraphWrapper from '../components/CellsGraphWrapper'
import LogAnalysisAlertBarWarpper from '../components/LogAnalysisAlertBarWrapper'

interface TempProps {
  cell: Cell
  source: Source
}

interface Props {
  inPresentationMode: boolean
  timeZone: TimeZones
  setTimeZone: typeof appActions.setTimeZone
  source: Source
  cloudTimeRange: CloudTimeRange
  cloudAutoRefresh: CloudAutoRefresh
  filteredLogsForLogAnalysis: FilteredLogsForLogAnalysis
  setCloudTimeRange: (value: CloudTimeRange) => void
  onChooseCloudAutoRefresh: (value: CloudAutoRefresh) => void
  openPanel: typeof openPanel
  removeLogAnalysisMatchPhraseFilterClause: (
    key: string,
    value: string | number
  ) => void
  removeLogAnalysisRangeFilterClause: (field: string) => void
}

function LogAnalysisDashboard({
  inPresentationMode,
  source,
  cloudTimeRange,
  cloudAutoRefresh,
  setCloudTimeRange,
  onChooseCloudAutoRefresh,
  timeZone,
  setTimeZone,
  openPanel,
}: Props) {
  const [
    manualRefreshState,
    setManualRefreshState,
  ] = useState<LogAnalysisManualRefresh>({
    key: 'log-analysis',
    value: Date.now(),
  })

  const GridLayout = WidthProvider(ReactGridLayout)

  useEffect(() => {
    if (typeof cloudAutoRefresh?.logAnalysis !== 'number') {
      onChooseCloudAutoRefresh({
        logAnalysis: 5000,
      })
    }
  }, [])

  const savedCells: DashboardsModels.Cell[] = JSON.parse(
    localStorage.getItem('Log-Analysis-cells')
  )

  const cells = useMemo(() => {
    const defaultCells = FIXTURE_LOG_ANALYSIS_CELLS(source)

    if (!!savedCells) {
      return savedCells
    } else {
      return defaultCells
    }
  }, [savedCells, source])

  const setLocalCells = (cells: DashboardsModels.Cell[]) => {
    localStorage.setItem('Log-Analysis-cells', JSON.stringify(cells))
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

  const handleChooseAutoRefresh = (option: {
    milliseconds: RefreshRate
    group?: string
  }) => {
    const {milliseconds, group} = option
    group ? onChooseCloudAutoRefresh({[group]: milliseconds}) : null
  }

  const handleApplyTime = (timeRange: TimeRange): void => {
    setCloudTimeRange({
      logAnalysis: {
        ...timeRange,
        format: !!timeRange.lowerFlux
          ? INPUT_TIME_TYPE.RELATIVE_TIME
          : INPUT_TIME_TYPE.TIMESTAMP,
      },
    })
  }

  const layoutRender = ({cell}: TempProps) => {
    if (!cell) return null
    switch (cell.i) {
      case 'log-analysis-syslog-table': {
        return (
          <Authorized
            requiredRole={VIEWER_ROLE}
            propsOverride={{
              isEditable: false,
            }}
          >
            <LogAnalysisSyslogTableWrapper
              timeZone={timeZone}
              manualRefresh={manualRefreshState.value}
            />
          </Authorized>
        )
      }
      case 'log-analysis-treemap': {
        return (
          <Authorized
            requiredRole={VIEWER_ROLE}
            propsOverride={{
              isEditable: false,
            }}
          >
            <ToggleViewWrap />
          </Authorized>
        )
      }
      case 'alerts-bar-graph': {
        return (
          <Authorized
            requiredRole={VIEWER_ROLE}
            propsOverride={{
              isEditable: false,
            }}
          >
            <LogAnalysisAlertBarWarpper
              cell={cell}
              host={''}
              source={source}
              sources={[source]}
              isEditable={false}
              manualRefresh={manualRefreshState.value}
            />
          </Authorized>
        )
      }
      default:
        return null
    }
  }

  const renderHeaderCenter = () => {
    return <div> </div>
  }
  const handleManualRefresh = () => {
    //redux
    setStateInitAction()

    setManualRefreshState({
      ...manualRefreshState,
      value: Date.now(),
    })
  }

  const renderHeaderRight = () => {
    return (
      <>
        <SourceIndicator />
        <AutoRefreshDropdown
          onChoose={handleChooseAutoRefresh}
          selected={0}
          onManualRefresh={handleManualRefresh}
          customAutoRefreshOptions={getTimeOptionByGroup('logAnalysis')}
          customAutoRefreshSelected={cloudAutoRefresh}
        />

        <TimeRangeDropdown
          onChooseTimeRange={handleApplyTime}
          selected={cloudTimeRange?.logAnalysis ?? CLOUD_TIME_RANGE.logAnalysis}
        />

        <TimeZoneToggle onSetTimeZone={setTimeZone} timeZone={timeZone} />
        <Button text="Expand" onClick={handleExpand} />
      </>
    )
  }

  const handleExpand = () => {
    console.log('expand')
    openPanel({
      panelProps: (
        <TestCellsGraphWrapper
          ratio={{
            xNum: 1,
            yNum: 6,
            height: 100,
          }}
          title="test"
          source={source}
          selectedTimeRangeLocalStorageKey="expandTimePulse"
        />
      ),
      width: 400,
    })
  }

  return (
    <>
      <Page className="log-analysis-page">
        <Page.Header>
          <Page.Header.Left>
            <Page.Title title={'Log Analysis'} />
          </Page.Header.Left>
          <Page.Header.Center>{renderHeaderCenter()}</Page.Header.Center>
          <Page.Header.Right>{renderHeaderRight()}</Page.Header.Right>
        </Page.Header>

        <LogsFilterContainer />
        <Page.Contents fullWidth={true} inPresentationMode={inPresentationMode}>
          <SidePanelSlice>
            <div className="dashboard container-fluid full-width">
              {!!cells && cells.length > 0 && (
                <Authorized
                  requiredRole={VIEWER_ROLE}
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
                    draggableHandle={'.log-analysis-dash-graph--draggable'}
                    onLayoutChange={handleLayoutChange}
                    useCSSTransforms={false}
                    isDraggable={true}
                    isResizable={true}
                    onResizeStop={(_, __, ___, ____, _____, resizeHandle) => {
                      const parentElement = resizeHandle?.parentElement

                      if (parentElement?.classList.contains('resizing')) {
                        parentElement.classList.remove('resizing')
                      }
                    }}
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
          </SidePanelSlice>
        </Page.Contents>
      </Page>
    </>
  )
}

const mstp = state => {
  const {
    app: {
      ephemeral: {inPresentationMode},
      persisted: {timeZone, autoRefresh, cloudAutoRefresh, cloudTimeRange},
    },
  } = state

  return {
    inPresentationMode,
    timeZone,
    autoRefresh,
    cloudAutoRefresh,
    cloudTimeRange,
  }
}

const mdtp = dispatch => ({
  openPanel: bindActionCreators(openPanel, dispatch),
  closePanel: bindActionCreators(closePanel, dispatch),
  setCloudTimeRange: bindActionCreators(setCloudTimeRange, dispatch),
  onChooseCloudAutoRefresh: bindActionCreators(setCloudAutoRefresh, dispatch),
  setTimeZone: bindActionCreators(appActions.setTimeZone, dispatch),
})

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(
  connect(mstp, mdtp, null)(LogAnalysisDashboard),
  isEqual
)
