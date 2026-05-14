import React, {Component, CSSProperties} from 'react'
import Dygraph from 'src/shared/components/Dygraph'

// Constants
import {LINE_COLORS_RULE_GRAPH} from 'src/shared/constants/graphColorPalettes'

// Utils
import buildQueries from 'src/utils/buildQueriesForGraphs'
import underlayCallback from 'src/kapacitor/utils/ruleGraphUnderlay'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {setHoverTime as setHoverTimeAction} from 'src/dashboards/actions'
import {
  TimeSeriesToDyGraphReturnType,
  timeSeriesToDygraph,
} from 'src/utils/timeSeriesTransformers'

// Types
import {
  AlertRule,
  QueryConfig,
  Query,
  TimeRange,
  RemoteDataState,
  DygraphClass,
} from 'src/types'
import {TimeSeriesServerResponse} from 'src/types/series'

interface DygraphUnderlayArea {
  x: number
  y: number
  w: number
  h: number
}

interface Props {
  query: QueryConfig
  rule: AlertRule
  timeRange: TimeRange
  setHoverTime: typeof setHoverTimeAction
  loading: RemoteDataState
  timeSeries: TimeSeriesServerResponse[]
  /** Default is 10. Used when MaxMarker is at the top, like in the Alert Group Preview. */
  yRangePad?: number
  /** Used instead of Kapacitor `underlayCallback(rule)` (e.g. Alert Group Preview) */
  customUnderlay?: (
    canvas: CanvasRenderingContext2D,
    area: DygraphUnderlayArea,
    dygraph: DygraphClass
  ) => void
}

interface State {
  timeSeriesToDygraphResult: TimeSeriesToDyGraphReturnType | null
}

@ErrorHandling
class RuleGraphDygraph extends Component<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {timeSeriesToDygraphResult: null}
  }

  public componentDidMount() {
    if (this.props.timeSeries) {
      this.loadDygraphData()
    }
  }

  public componentDidUpdate(prevProps) {
    if (prevProps.timeSeries !== this.props.timeSeries) {
      this.loadDygraphData()
    }
  }

  public render() {
    const {timeRange, rule, customUnderlay} = this.props
    const {timeSeriesToDygraphResult} = this.state

    if (!timeSeriesToDygraphResult) {
      return null
    }
    if (timeSeriesToDygraphResult.unsupportedValue) {
      console.error(
        'Unsupported y-axis value, cannot display data',
        timeSeriesToDygraphResult
      )
      return (
        <p className="unexpected-error">
          Unsupported y-axis value, only numbers are supported.
        </p>
      )
    }

    const underlay =
      customUnderlay != null ? customUnderlay : underlayCallback(rule)

    return (
      <Dygraph
        labels={timeSeriesToDygraphResult.labels}
        staticLegend={false}
        isGraphFilled={false}
        ruleValues={rule.values}
        options={this.options}
        timeRange={timeRange}
        queries={this.queries}
        timeSeries={timeSeriesToDygraphResult.timeSeries}
        dygraphSeries={timeSeriesToDygraphResult.dygraphSeries}
        colors={LINE_COLORS_RULE_GRAPH}
        containerStyle={this.containerStyle}
        underlayCallback={underlay}
        handleSetHoverTime={this.props.setHoverTime}
      />
    )
  }

  private loadDygraphData = async () => {
    const {timeSeries} = this.props
    const result = await timeSeriesToDygraph(timeSeries, 'rule-builder')

    this.setState({timeSeriesToDygraphResult: result})
  }

  private get containerStyle(): CSSProperties {
    return {
      width: 'calc(100% - 32px)',
      height: 'calc(100% - 16px)',
      position: 'absolute',
      top: '8px',
    }
  }

  private get options() {
    const yRangePad = this.props.yRangePad ?? 10
    return {
      rightGap: 0,
      yRangePad,
      labelsKMB: true,
      fillGraph: true,
      axisLabelWidth: 60,
      animatedZooms: true,
      drawAxesAtZero: true,
      axisLineColor: '#383846',
      gridLineColor: '#383846',
      connectSeparatedPoints: true,
    }
  }

  private get queries(): Query[] {
    const {query, timeRange} = this.props
    return buildQueries([query], timeRange)
  }
}

export default RuleGraphDygraph
