// Library
import React, {useEffect, useMemo, useCallback, useState} from 'react'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import _ from 'lodash'
import {connect} from 'react-redux'
import {withRouter, InjectedRouter} from 'react-router'
import {bindActionCreators} from 'redux'

// Actions
import {setLogAnalysisManualRefresh} from 'src/log_analysis/actions'
import {resetSelectedDevice} from 'src/log_analysis/actions'
import {setCloudAutoRefresh, setCloudTimeRange} from 'src/clouds/actions/clouds'
import * as appActions from 'src/shared/actions/app'
import {setStateInitAction} from 'src/device_management/actions'
import {closePanel, openPanel} from 'src/shared/actions/sidePanel'

// Components
import {OverlayTechnology, Page} from 'src/reusable_ui'
import LogAnalysisSyslogTableWrapper from 'src/log_analysis/components/LogAnalysisSyslogTableWrapper'
import LogsFilterContainer from 'src/log_analysis/components/LogsFilterContainer'
import LogAnalysisTips from 'src/log_analysis/components/LogAnalysisTips'
import ToggleViewWrap from 'src/log_analysis/components/ToggleViewWrap'
import SidePanelSlice from 'src/shared/components/SidePanelSlice'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import TimeZoneToggle from 'src/shared/components/time_zones/TimeZoneToggle'
import SourceIndicator from 'src/shared/components/SourceIndicator'
import LogAnalysisAlertBarWarpper from 'src/log_analysis/components/LogAnalysisAlertBarWrapper'
import LogSearchFilterBar from 'src/log_analysis/components/LogSearchFilterBar'
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import NotFound from 'src/shared/components/NotFound'

// Type
import * as DashboardsModels from 'src/types/dashboards'
import {CloudTimeRange, CloudAutoRefresh} from 'src/clouds/types/type'
import {
  Cell,
  FilteredLogsForLogAnalysis,
  INPUT_TIME_TYPE,
  RefreshRate,
  Source,
  TimeRange,
  TimeZones,
  Links,
} from 'src/types'
import {LogConfig, SeverityFormat, LogsTableColumn} from 'src/types/logs'

// Constants
import {
  DASHBOARD_LAYOUT_ROW_HEIGHT,
  HANDLE_HORIZONTAL,
  LAYOUT_MARGIN,
  AddonType,
} from 'src/shared/constants'
import {CLOUD_TIME_RANGE} from 'src/shared/data/timeRanges'
import {LOG_ANALYSIS_LOCAL_STORAGE_KEY} from 'src/log_analysis/constants/log-analysis'
import {FIXTURE_LOG_ANALYSIS_CELLS} from 'src/log_analysis/constants/fixture'
import Authorized, {EDITOR_ROLE, VIEWER_ROLE} from 'src/auth/Authorized'
import {getTimeOptionByGroup} from 'src/clouds/constants/autoRefresh'
import OptionsOverlay from 'src/logs/components/OptionsOverlay'
import {SeverityLevelColor} from 'src/types/logs'
import {
  getLogConfigAsync,
  setConfig,
  updateLogConfigAsync,
} from 'src/logs/actions'
import {SeverityFormatOptions} from 'src/logs/constants'
import {getChartOptions} from 'src/log_analysis/apis/chartOptions'

interface TempProps {
  cell: Cell
  source: Source
}

interface Props {
  inPresentationMode: boolean
  timeZone: TimeZones
  setTimeZone: typeof appActions.setTimeZone
  logConfig: LogConfig
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
  links?: Links
  router?: InjectedRouter
  params: {sourceID: string}
  updateConfig: typeof updateLogConfigAsync
  logConfigLink: string
  getConfig?: typeof getLogConfigAsync
  setConfig?: typeof setConfig
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
  links,
  router,
  params,
  logConfig,
  logConfigLink,
  updateConfig,
  getConfig,
  setConfig,
}: Props) {
  const [isOverlayVisible, setIsOverlayVisible] = useState(false)

  const [horizontalProportions, setHorizontalProportions] = useState(() => {
    const savedStore = localStorage.getItem(LOG_ANALYSIS_LOCAL_STORAGE_KEY)
    const parsed = savedStore ? JSON.parse(savedStore) : {}

    return parsed.horizontalProportions ?? [0.1, 0.9]
  })

  const GridLayout = WidthProvider(ReactGridLayout)
  const isUsingLogAnalysis = useMemo(() => {
    return (
      links?.addons &&
      links.addons.some(
        item => item.name === AddonType.logAnalysis && item.url === 'on'
      )
    )
  }, [links])

  useEffect(() => {
    if (links && !isUsingLogAnalysis && router) {
      router.replace(`/sources/${params.sourceID}/status`)
    }
  }, [isUsingLogAnalysis, links, router, params.sourceID])

  if (!isUsingLogAnalysis) {
    return <NotFound />
  }

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

  useEffect(() => {
    const savedHorizontalProportions = loadHorizontalProportions()
    setHorizontalProportions(savedHorizontalProportions)
  }, [])

  useEffect(() => {
    fetchConfig()
    fetchChartOptions()
  }, [])

  const fetchConfig = async () => {
    await getConfig(logConfigLink)
  }

  const fetchChartOptions = async () => {
    const {data} = await getChartOptions()
    setConfig({
      ...logConfig,
      chartOptions: {
        queryFillOption: data.queryFillOption,
        annotationPadding: data.annotationPadding,
      },
    })
  }

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

  const handleToggleOverlay = (): void => {
    setIsOverlayVisible(!isOverlayVisible)
  }

  const renderHeaderRight = () => {
    return (
      <>
        <LogAnalysisTips />
        <SourceIndicator />
        <Authorized requiredRole={EDITOR_ROLE}>
          <button
            className="btn btn-sm btn-square btn-default"
            onClick={handleToggleOverlay}
          >
            <span className="icon cog-thick" style={{top: '0.1em'}} />
          </button>
        </Authorized>
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

  const handleUpdateOptions = async (
    severityLevelColors: SeverityLevelColor[],
    severityFormat: SeverityFormat,
    tableColumns: LogsTableColumn[]
  ): Promise<void> => {
    await updateConfig(logConfigLink, {
      ...logConfig,
      severityLevelColors,
      severityFormat,
      tableColumns,
    })
  }

  const renderImportOverlay = (): JSX.Element => {
    return (
      <OverlayTechnology visible={isOverlayVisible}>
        <OptionsOverlay
          severityLevelColors={logConfig.severityLevelColors}
          onUpdate={handleUpdateOptions}
          onDismissOverlay={handleToggleOverlay}
          columns={logConfig.tableColumns}
          severityFormat={
            logConfig.severityFormat ?? SeverityFormatOptions.dotText
          }
          isColorOnly={true}
        />
      </OverlayTechnology>
    )
  }

  const renderTopSection = useCallback(() => {
    return <LogsFilterContainer />
  }, [])

  const renderBottomSection = useCallback(() => {
    return (
      <SidePanelSlice localStorageKey={LOG_ANALYSIS_LOCAL_STORAGE_KEY}>
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
    saveHorizontalProportions(horizontalProportions)
    setHorizontalProportions(horizontalProportions)
  }

  const saveHorizontalProportions = (horizontalProportions: number[]): void => {
    const store = localStorage.getItem(LOG_ANALYSIS_LOCAL_STORAGE_KEY)
    const parsed = store ? JSON.parse(store) : {}
    localStorage.setItem(
      LOG_ANALYSIS_LOCAL_STORAGE_KEY,
      JSON.stringify({
        ...parsed,
        horizontalProportions,
      })
    )
  }

  const loadHorizontalProportions = (): number[] => {
    const savedStore = localStorage.getItem(LOG_ANALYSIS_LOCAL_STORAGE_KEY)
    const parsed = savedStore ? JSON.parse(savedStore) : {}

    return parsed.horizontalProportions ?? [0.1, 0.9]
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
      {renderImportOverlay()}
    </>
  )
}

const mstp = state => {
  const {
    app: {
      ephemeral: {inPresentationMode},
      persisted: {timeZone, autoRefresh, cloudAutoRefresh, cloudTimeRange},
    },
    links,
    logs: {logConfig},
  } = state

  return {
    inPresentationMode,
    timeZone,
    autoRefresh,
    cloudAutoRefresh,
    cloudTimeRange,
    links,
    logConfigLink: links.orgConfig.logViewer,
    logConfig,
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
  updateConfig: bindActionCreators(updateLogConfigAsync, dispatch),
  getConfig: bindActionCreators(getLogConfigAsync, dispatch),
  setConfig: bindActionCreators(setConfig, dispatch),
})

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(
  withRouter(connect(mstp, mdtp, null)(LogAnalysisDashboard)),
  isEqual
)
