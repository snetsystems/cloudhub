import React, {Component} from 'react'
import {WithRouterProps, withRouter} from 'react-router'

//Components
import LogsGraphContainer from 'src/logs/components/LogsGraphContainer'
import TimeWindowDropdown from 'src/logs/components/TimeWindowDropdown'
import {Greys} from 'src/reusable_ui'
import HistogramResults from 'src/logs/components/HistogramResults'
import HistogramChart from 'src/shared/components/HistogramChart'

// Type
import {
  FetchLoop,
  Filter,
  SearchStatus,
  TimeBounds,
  TimeMarker,
  TimeRange,
  TimeWindow,
} from 'src/types/logs'
import {Namespace} from 'src/types'
import {
  HistogramColor,
  HistogramData,
  HistogramDatum,
} from 'src/types/histogram'

// Utils
import extentBy from 'src/utils/extentBy'
import {computeTimeBounds} from 'src/logs/utils/timeBounds'
import {formatTime} from 'src/logs/utils'
import {getDeep} from 'src/utils/wrappers'
import {colorForSeverity} from 'src/logs/utils/colors'

// Constant
import {SEVERITY_SORTING_ORDER} from 'src/logs/constants'

// Redux
import {connect} from 'react-redux'
import {
  setTableCustomTimeAsync,
  setTableRelativeTimeAsync,
  getSourceAndPopulateNamespacesAsync,
  setTimeRangeAsync,
  setTimeBounds,
  setTimeWindow,
  setTimeMarker,
  setNamespaceAsync,
  addFilter,
  removeFilter,
  changeFilter,
  clearFilters,
  fetchOlderChunkAsync,
  fetchNewerChunkAsync,
  fetchNamespaceSyslogStatusAsync,
  fetchTailAsync,
  flushTailBuffer,
  clearAllTimeBounds,
  setNextTailLowerBound,
  setNextNewerLowerBound,
  getLogConfigAsync,
  updateLogConfigAsync,
  clearSearchData,
  setSearchStatus,
  executeHistogramQueryAsync,
} from 'src/logs/actions'

// ETC
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {getSourcesAsync} from 'src/shared/actions/sources'
import {AutoSizer} from 'react-virtualized'

// Library
import _ from 'lodash'

interface Props extends WithRouterProps {
  queryCount?: number
  searchStatus?: SearchStatus
  histogramData?: HistogramData
  timeRange?: TimeRange
  clearAllTimeBounds?: typeof clearAllTimeBounds
  setTableCustomTime?: (time: string) => void
  setNextNewerLowerBound?: typeof setNextNewerLowerBound
  setTimeMarker?: (timeMarker: TimeMarker) => void
  setTimeBounds?: (timeBounds: TimeBounds) => void
  setTimeRangeAsync?: (timeRange: TimeRange) => void
  setTimeWindow?: (timeWindow: TimeWindow) => void
  setNamespaceAsync?: (namespace: Namespace) => void
  setTableRelativeTime?: (time: number) => void
  clearSearchData?: (searchStatus: SearchStatus) => void
  addFilter?: (filter: Filter) => void
  tableTime?: {
    custom: string
    relative: number
  }
}

interface State {
  searchString: string
  liveUpdating: boolean
  isOverlayVisible: boolean

  hasScrolled: boolean
  isLoadingNewer: boolean
  queryCount: number
  isHistogramHidden: boolean

  histogramColors: HistogramColor[]
}

class PredictionAlertGraph extends Component<Props, State> {
  private isComponentMounted: boolean = true
  private interval: number
  private currentOlderChunksGenerator: FetchLoop = null
  private currentNewerChunksGenerator: FetchLoop = null

  constructor(props: Props) {
    super(props)
    const {
      location: {
        query: {table},
      },
    } = props

    this.state = {
      isLoadingNewer: false,
      searchString: '',
      liveUpdating: false,
      isOverlayVisible: false,
      histogramColors: [],
      hasScrolled: false,
      queryCount: 0,
      isHistogramHidden: table !== undefined,
    }
  }

  public render() {
    return (
      <>
        <LogsGraphContainer>
          {this.chartControlBar()}
          {this.chart}
        </LogsGraphContainer>
      </>
    )
  }

  private chartControlBar() {
    const {queryCount, searchStatus} = this.props

    const timeRange = getDeep(this.props, 'timeRange', {
      upper: null,
      lower: 'now() - 1m',
      seconds: 60,
      windowOption: '1m',
      timeOption: 'now',
    })

    return (
      <div className="logs-viewer--graph-controls">
        <HistogramResults
          count={this.histogramTotal}
          queryCount={queryCount}
          searchStatus={searchStatus}
          selectedTimeWindow={timeRange}
        />
        <div className="page-header--right">
          <TimeWindowDropdown
            selectedTimeWindow={timeRange}
            onSetTimeWindow={this.handleSetTimeWindow}
          />
        </div>
      </div>
    )
  }

  public componentWillUnmount() {
    this.isComponentMounted = false
    this.clearTailInterval()
    this.cancelChunks()
  }

  private get chart(): JSX.Element {
    const {
      histogramData,
      timeRange: {timeOption},
    } = this.props
    const {histogramColors} = this.state

    return (
      <div className="logs-viewer--graph">
        <AutoSizer disableHeight={false}>
          {({width, height}) => (
            <HistogramChart
              data={histogramData}
              width={width}
              height={height}
              colorScale={colorForSeverity}
              colors={histogramColors}
              onBarClick={this.handleBarClick}
              sortBarGroups={this.handleSortHistogramBarGroups}
            >
              {({xScale, adjustedHeight, margins}) => {
                const timeOptionValue = new Date(timeOption).valueOf()
                const x = xScale(timeOptionValue)
                const y1 = margins.top
                const y2 = margins.top + adjustedHeight
                const textSize = 11
                const markerSize = 5
                const labelSize = 100

                if (timeOption === 'now') {
                  return null
                }
                const lineContainerWidth = 3
                const lineWidth = 1

                return (
                  <>
                    <svg
                      width={lineContainerWidth}
                      height={height}
                      style={{
                        position: 'absolute',
                        left: `${x}px`,
                        top: '0px',
                        transform: 'translateX(-50%)',
                      }}
                    >
                      <line
                        x1={(lineContainerWidth - lineWidth) / 2}
                        x2={(lineContainerWidth - lineWidth) / 2}
                        y1={y1 + markerSize / 2}
                        y2={y2}
                        stroke={Greys.White}
                        strokeWidth={`${lineWidth}`}
                      />
                    </svg>
                    <svg
                      width={x}
                      height={textSize + textSize / 2}
                      style={{
                        position: 'absolute',
                        left: `${x - markerSize - labelSize}px`,
                      }}
                    >
                      <text
                        style={{fontSize: textSize, fontWeight: 600}}
                        x={0}
                        y={textSize}
                        height={textSize}
                        fill={Greys.Sidewalk}
                      >
                        Current Timestamp
                      </text>
                      <ellipse
                        cx={labelSize + markerSize - 0.5}
                        cy={textSize / 2 + markerSize / 2}
                        rx={markerSize / 2}
                        ry={markerSize / 2}
                        fill={Greys.White}
                      />
                      <text
                        style={{fontSize: textSize, fontWeight: 600}}
                        x={labelSize + markerSize / 2 + textSize}
                        y={textSize}
                        height={textSize}
                        fill={Greys.Sidewalk}
                      >
                        {formatTime(timeOptionValue)}
                      </text>
                    </svg>
                  </>
                )
              }}
            </HistogramChart>
          )}
        </AutoSizer>
      </div>
    )
  }

  private handleSetTimeWindow = async (timeWindow: TimeWindow) => {
    await this.props.setTimeWindow(timeWindow)
    this.handleSetTimeBounds()
  }

  private get histogramTotal(): number {
    const {histogramData} = this.props

    return _.sumBy(histogramData, 'value')
  }

  private handleBarClick = (time: string): void => {
    const formattedTime = new Date(time).toISOString()
    this.handleChooseCustomTime(formattedTime)
  }

  private handleChooseCustomTime = async (time: string) => {
    this.clearAllTimeBounds()

    this.props.setTableCustomTime(time)
    const liveUpdating = false

    const customLowerBound = Date.parse(time)
    this.props.setNextNewerLowerBound(customLowerBound)

    if (!this.isComponentMounted) {
      return
    }
    this.setState({
      hasScrolled: false,
      liveUpdating,
    })

    if (!this.isComponentMounted) {
      return
    }
    await this.props.setTimeMarker({
      timeOption: time,
    })

    this.handleSetTimeBounds()
  }

  private clearAllTimeBounds(): void {
    this.props.clearAllTimeBounds()
  }

  private handleSortHistogramBarGroups = (
    a: HistogramDatum,
    b: HistogramDatum
  ): number => {
    return SEVERITY_SORTING_ORDER[b.group] - SEVERITY_SORTING_ORDER[a.group]
  }

  private handleSetTimeBounds = async () => {
    const {seconds, windowOption, timeOption} = _.get(this.props, 'timeRange', {
      seconds: null,
      windowOption: null,
      timeOption: null,
    })

    let timeBounds: TimeBounds = {
      lower: `now() - ${windowOption}`,
      upper: null,
    }

    if (timeOption !== 'now') {
      const extentTimes = extentBy(this.props.histogramData, d => d.time).map(
        d => d.time
      )

      timeBounds = computeTimeBounds(extentTimes, timeOption, seconds)
    }

    await this.props.setTimeBounds(timeBounds)

    this.props.setTimeRangeAsync(this.props.timeRange)

    this.updateTableData(SearchStatus.UpdatingTimeBounds)
  }

  private updateTableData = async (searchStatus: SearchStatus) => {
    this.clearTailInterval()
    await this.cancelChunks()
    this.setState({hasScrolled: false, liveUpdating: this.shouldLiveUpdate})
    this.props.clearSearchData(searchStatus)
  }

  private clearTailInterval = () => {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private cancelChunks = async () => {
    const cancelPendingChunks = _.compact([
      this.currentNewerChunksGenerator,
      this.currentOlderChunksGenerator,
    ]).map(req => {
      req.cancel()
      return req.promise
    })

    await Promise.all(cancelPendingChunks)

    this.currentNewerChunksGenerator = null
    this.currentOlderChunksGenerator = null
    if (!this.isComponentMounted) {
      return
    }
    this.setState({queryCount: 0})
  }

  private get shouldLiveUpdate(): boolean {
    return this.props.tableTime.relative === 0
  }
}

const mapStateToProps = ({
  sources,
  links: {
    orgConfig: {logViewer},
  },
  logs: {
    newRowsAdded,
    currentSource,
    currentNamespaces,
    timeRange,
    currentNamespace,
    histogramData,
    tableData,
    filters,
    queryCount,
    logConfig,
    tableTime,
    tableInfiniteData,
    nextOlderUpperBound,
    nextNewerLowerBound,
    currentTailUpperBound,
    nextTailLowerBound,
    searchStatus,
    tableQueryConfig,
  },
  auth: {me, isUsingAuth},
}) => ({
  sources,
  currentSource,
  currentNamespaces,
  timeRange,
  currentNamespace,
  histogramData,
  tableData,
  filters,
  queryCount,
  logConfig,
  tableTime,
  logConfigLink: logViewer,
  tableInfiniteData,
  newRowsAdded,
  nextOlderUpperBound,
  nextNewerLowerBound,
  currentTailUpperBound,
  nextTailLowerBound,
  searchStatus,
  me,
  isUsingAuth,
  tableQueryConfig,
})

const mapDispatchToProps = {
  getSourceAndPopulateNamespaces: getSourceAndPopulateNamespacesAsync,
  getSources: getSourcesAsync,
  setTimeRangeAsync,
  setTimeBounds,
  setTimeWindow,
  setTimeMarker,
  setNamespaceAsync,
  executeHistogramQueryAsync,
  clearSearchData,
  setSearchStatus,
  addFilter,
  removeFilter,
  changeFilter,
  clearFilters,
  fetchOlderChunkAsync,
  fetchNewerChunkAsync,
  fetchTailAsync,
  fetchNamespaceSyslogStatusAsync,
  flushTailBuffer,
  clearAllTimeBounds,
  setNextTailLowerBound,
  setNextNewerLowerBound,
  setTableCustomTime: setTableCustomTimeAsync,
  setTableRelativeTime: setTableRelativeTimeAsync,
  getConfig: getLogConfigAsync,
  updateConfig: updateLogConfigAsync,
  notify: notifyAction,
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null
)(withRouter(PredictionAlertGraph))
