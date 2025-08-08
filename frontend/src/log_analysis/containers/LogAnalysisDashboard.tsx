// Library
import React, {useEffect, useMemo, useCallback, useState} from 'react'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import _ from 'lodash'
import {connect} from 'react-redux'

// Actions
import {setLogAnalysisManualRefresh} from 'src/log_analysis/actions'
import {resetSelectedDevice} from 'src/log_analysis/actions'

// Components
import {Page} from 'src/reusable_ui'
import LogAnalysisSyslogTableWrapper from 'src/log_analysis/components/LogAnalysisSyslogTableWrapper'
import LogsFilterContainer from 'src/log_analysis/components/LogsFilterContainer'
import LogAnalysisTips from 'src/log_analysis/components/LogAnalysisTips'

// Type
import * as DashboardsModels from 'src/types/dashboards'
import {
  Cell,
  FilteredLogsForLogAnalysis,
  INPUT_TIME_TYPE,
  RefreshRate,
  Source,
  TimeRange,
  TimeZones,
} from 'src/types'

// Constants
import {
  DASHBOARD_LAYOUT_ROW_HEIGHT,
  HANDLE_HORIZONTAL,
  LAYOUT_MARGIN,
} from 'src/shared/constants'
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
import LogAnalysisAlertBarWarpper from '../components/LogAnalysisAlertBarWrapper'
import LogSearchFilterBar from '../components/LogSearchFilterBar'
import Threesizer from 'src/shared/components/threesizer/Threesizer'

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
  setLogAnalysisManualRefresh: typeof setLogAnalysisManualRefresh
  removeLogAnalysisMatchPhraseFilterClause: (
    key: string,
    value: string | number
  ) => void
  removeLogAnalysisRangeFilterClause: (field: string) => void
  closePanel: typeof closePanel
  resetSelectedDevice: typeof resetSelectedDevice
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
  setLogAnalysisManualRefresh,
  closePanel,
  resetSelectedDevice,
}: Props) {
  const [horizontalProportions, setHorizontalProportions] = useState([0.1, 0.9])

  const GridLayout = WidthProvider(ReactGridLayout)

  useEffect(() => {
    if (typeof cloudAutoRefresh?.logAnalysis !== 'number') {
      onChooseCloudAutoRefresh({
        logAnalysis: 5000,
      })
    }
    return () => {
      closePanel()
      resetSelectedDevice()
    }
  }, [])

  const savedCells = useMemo(() => {
    const saved = localStorage.getItem('Log-Analysis-cells')
    return saved ? JSON.parse(saved) : null
  }, [])

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

  const layoutRender = useCallback(
    ({cell}: TempProps) => {
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
                source={source}
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
              <LogAnalysisAlertBarWarpper cell={cell} />
            </Authorized>
          )
        }
        default:
          return null
      }
    },
    [timeZone, source]
  )

  const renderHeaderCenter = () => {
    return <div> </div>
  }
  const handleManualRefresh = useCallback(() => {
    setStateInitAction()
    setLogAnalysisManualRefresh()
  }, [setLogAnalysisManualRefresh])

  const renderHeaderRight = () => {
    return (
      <>
        <LogAnalysisTips />
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
      </>
    )
  }

  const renderTopSection = useCallback(() => {
    return <LogsFilterContainer />
  }, [])

  const renderBottomSection = useCallback(() => {
    return (
      <SidePanelSlice>
        <Page.Contents fullWidth={true} inPresentationMode={inPresentationMode}>
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
        </Page.Contents>
      </SidePanelSlice>
    )
  }, [cells, inPresentationMode])

  const horizontalDivisions = useMemo(() => {
    const [topSize, bottomSize] = horizontalProportions
    return [
      {
        handleDisplay: 'none',
        headerButtons: [],
        menuOptions: [],
        render: renderTopSection,
        headerOrientation: HANDLE_HORIZONTAL,
        size: topSize,
      },
      {
        handleDisplay: 'default',
        handlePixels: 8,
        headerButtons: [],
        menuOptions: [],
        render: renderBottomSection,
        headerOrientation: HANDLE_HORIZONTAL,
        size: bottomSize,
      },
    ]
  }, [horizontalProportions, renderTopSection, renderBottomSection])

  const horizontalHandleResize = (horizontalProportions: number[]): void => {
    setHorizontalProportions(horizontalProportions)
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
        <LogSearchFilterBar />
        <Threesizer
          orientation={HANDLE_HORIZONTAL}
          divisions={horizontalDivisions}
          onResize={horizontalHandleResize}
        />
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
  resetSelectedDevice: bindActionCreators(resetSelectedDevice, dispatch),
  setCloudTimeRange: bindActionCreators(setCloudTimeRange, dispatch),
  onChooseCloudAutoRefresh: bindActionCreators(setCloudAutoRefresh, dispatch),
  setTimeZone: bindActionCreators(appActions.setTimeZone, dispatch),
  setLogAnalysisManualRefresh: bindActionCreators(
    setLogAnalysisManualRefresh,
    dispatch
  ),
})

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(
  connect(mstp, mdtp, null)(LogAnalysisDashboard),
  isEqual
)
