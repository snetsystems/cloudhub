// Libraries
import React, {PureComponent, CSSProperties} from 'react'
import Dygraph from 'src/shared/components/Dygraph'
import {withRouter, RouteComponentProps} from 'react-router'
import memoizeOne from 'memoize-one'

// Components
import SingleStat from 'src/shared/components/SingleStat'
import {ErrorHandlingWith} from 'src/shared/decorators/errors'
import InvalidData from 'src/shared/components/InvalidData'

// Utils
import {
  timeSeriesToDygraph,
  TimeSeriesToDyGraphReturnType,
} from 'src/utils/timeSeriesTransformers'
import {manager} from 'src/worker/JobManager'
import {fluxTablesToDygraph} from 'src/shared/parsing/flux/dygraph'
import {
  getDataUUID,
  hasDataPropsChanged,
  isFluxDataEqual,
  isInluxQLDataEqual,
} from 'src/shared/graphs/helpers'

// Types
import {ColorString} from 'src/types/colors'
import {DecimalPlaces} from 'src/types/dashboards'
import {TimeSeriesServerResponse} from 'src/types/series'
import {
  Query,
  Axes,
  TimeRange,
  RemoteDataState,
  CellType,
  FluxTable,
} from 'src/types'
import {DataType} from 'src/shared/constants'
import BarChart from './BarChart'
import {getLineColorsHexes} from 'src/shared/constants/graphColorPalettes'

interface Props {
  axes: Axes
  type: CellType
  queries: Query[]
  timeRange: TimeRange
  colors: ColorString[]
  loading: RemoteDataState
  decimalPlaces: DecimalPlaces
  data: TimeSeriesServerResponse[] | FluxTable[]
  dataType: DataType
  cellID: string
  cellHeight: number
  staticLegend: boolean
  onZoom: () => void
  handleSetHoverTime: () => void
  activeQueryIndex?: number
  onUpdateVisType?: (type: CellType) => Promise<void>
}

type LineGraphProps = Props & RouteComponentProps<any, any>

interface State {
  timeSeries?: TimeSeriesToDyGraphReturnType

  staticLegendHeight: number
  xAxisRange: [number, number]
  isMouseInLegend: boolean
}

@ErrorHandlingWith(InvalidData)
class HistogramGraph extends PureComponent<LineGraphProps, State> {
  public static defaultProps: Partial<LineGraphProps> = {
    staticLegend: false,
  }
  private latestUUID: string

  private isComponentMounted: boolean = false
  private isValidData: boolean = true

  private memoizedTimeSeriesToDygraph = memoizeOne(
    timeSeriesToDygraph,
    isInluxQLDataEqual
  )
  private memoizedFluxTablesToDygraph = memoizeOne(
    fluxTablesToDygraph,
    isFluxDataEqual
  )

  constructor(props: LineGraphProps) {
    super(props)

    this.state = {
      staticLegendHeight: 0,
      xAxisRange: [0, 0],
      isMouseInLegend: false,
    }
  }

  public async componentDidMount() {
    this.isComponentMounted = true
    const {data, dataType} = this.props
    await this.parseTimeSeries(data, dataType)
  }

  public componentWillUnmount() {
    this.isComponentMounted = false
  }

  public async parseTimeSeries(
    data: TimeSeriesServerResponse[] | FluxTable[],
    dataType: DataType
  ) {
    let timeSeries
    this.latestUUID = getDataUUID(data, dataType)
    try {
      const {result, uuid} = await this.convertToDygraphData(data, dataType)

      timeSeries = result

      if (!this.isComponentMounted || uuid !== this.latestUUID) {
        return
      }

      this.isValidData = await manager.validateDygraphData(
        timeSeries.timeSeries
      )
      console.log('this.isValidData', this.isValidData)
    } catch (err) {
      this.isValidData = false
    }

    if (this.isComponentMounted) {
      this.setState({timeSeries})
    }
  }

  public componentDidUpdate(prevProps: LineGraphProps) {
    const isDataChanged = hasDataPropsChanged(prevProps, this.props)

    if (this.props.loading === RemoteDataState.Done && isDataChanged) {
      this.parseTimeSeries(this.props.data, this.props.dataType)
    }
  }

  public render() {
    if (!this.isValidData) {
      return <InvalidData onUpdateVisType={this.props.onUpdateVisType} />
    }
    const {
      data,
      axes,
      type,
      colors,
      cellID,
      onZoom,
      loading,
      queries,
      dataType,
      timeRange,
      cellHeight,
      staticLegend,
      decimalPlaces,
      handleSetHoverTime,
    } = this.props

    if (!this.state.timeSeries) {
      return <h3 className="graph-spinner" />
    }

    const {labels, timeSeries, dygraphSeries} = this.state.timeSeries

    const options = {
      rightGap: 0,
      yRangePad: 10,
      labelsKMB: true,
      fillGraph: true,
      axisLabelWidth: 60,
      animatedZooms: true,
      drawAxesAtZero: true,
      axisLineColor: '#383846',
      gridLineColor: '#383846',
      connectSeparatedPoints: true,
      stepPlot: type === 'line-stepplot',
      stackedGraph: type === 'line-stacked',
    }

    return (
      <div className="dygraph graph--hasYLabel" style={this.style}>
        {loading === RemoteDataState.Loading && <GraphLoadingDots />}
        <BarChart
          labels={labels}
          cellID={cellID}
          axes={axes}
          dygraphSeries={dygraphSeries}
          colorDygraphSeries={this.colorDygraphSeries}
          dygraphStyle={this.dygraphStyle}
          queries={queries}
          timeRange={timeRange}
          timeSeries={timeSeries}
          data={data}
        />
        {/* <Dygraph
          type={type}
          axes={axes}
          cellID={cellID}
          colors={colors}
          onZoom={onZoom}
          labels={labels}
          queries={queries}
          options={options}
          timeRange={timeRange}
          timeSeries={timeSeries}
          staticLegend={staticLegend}
          dygraphSeries={dygraphSeries}
          isGraphFilled={this.isGraphFilled}
          containerStyle={this.containerStyle}
          handleSetHoverTime={handleSetHoverTime}
        >
          {type === CellType.LinePlusSingleStat && (
            <SingleStat
              data={data}
              dataType={dataType}
              lineGraph={true}
              colors={colors}
              prefix={this.prefix}
              suffix={this.suffix}
              cellHeight={cellHeight}
              decimalPlaces={decimalPlaces}
            />
          )}
        </Dygraph> */}
      </div>
    )
  }

  private get isGraphFilled(): boolean {
    const {type} = this.props

    if (type === CellType.LinePlusSingleStat) {
      return false
    }

    return true
  }

  private get style(): CSSProperties {
    return {height: '100%'}
  }

  private get prefix(): string {
    const {axes} = this.props

    if (!axes) {
      return ''
    }

    return axes.y.prefix
  }

  private get suffix(): string {
    const {axes} = this.props

    if (!axes) {
      return ''
    }

    return axes.y.suffix
  }

  private get containerStyle(): CSSProperties {
    return {
      width: 'calc(100% - 32px)',
      height: 'calc(100% - 16px)',
      position: 'absolute',
      top: '8px',
      left: '16px',
    }
  }

  private handleUpdateStaticLegendHeight = (staticLegendHeight: number) => {
    this.setState({staticLegendHeight})
  }
  private get dygraphStyle(): CSSProperties {
    const {staticLegend} = this.props
    const {staticLegendHeight} = this.state

    if (staticLegend) {
      const cellVerticalPadding = 16

      return {
        ...this.containerStyle,
        zIndex: 2,
        height: `calc(100% - ${staticLegendHeight + cellVerticalPadding}px)`,
      }
    }

    return {...this.containerStyle, zIndex: 2}
  }
  private async convertToDygraphData(
    data: TimeSeriesServerResponse[] | FluxTable[],
    dataType: DataType
  ): Promise<{result: TimeSeriesToDyGraphReturnType; uuid: string}> {
    const {location} = this.props

    let result: TimeSeriesToDyGraphReturnType
    if (dataType === DataType.influxQL) {
      result = await this.memoizedTimeSeriesToDygraph(
        data as TimeSeriesServerResponse[],
        location.pathname
      )
    }

    if (dataType === DataType.flux) {
      result = await this.memoizedFluxTablesToDygraph(data as FluxTable[])
    }

    return {result, uuid: getDataUUID(data, dataType)}
  }

  private get colorDygraphSeries() {
    const {dygraphSeries} = this.state.timeSeries
    const {colors} = this.props
    const numSeries = Object.keys(dygraphSeries).length

    const dygraphSeriesKeys = Object.keys(dygraphSeries).sort()
    const lineColors = getLineColorsHexes(colors, numSeries)
    const coloredDygraphSeries = {}

    for (const seriesName in dygraphSeries) {
      // eslint-disable-next-line no-prototype-builtins
      if (dygraphSeries.hasOwnProperty(seriesName)) {
        const series = dygraphSeries[seriesName]
        const color = lineColors[dygraphSeriesKeys.indexOf(seriesName)]
        coloredDygraphSeries[seriesName] = {...series, color}
      }
    }

    return coloredDygraphSeries
  }
}

const GraphLoadingDots = () => (
  <div className="graph-panel__refreshing">
    <div />
    <div />
    <div />
  </div>
)

export default withRouter<Props>(HistogramGraph)
