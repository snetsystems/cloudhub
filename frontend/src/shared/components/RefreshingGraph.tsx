// Libraries
import React, {Component} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import {AutoSizer} from 'react-virtualized'

// Components
import LineGraph from 'src/shared/components/LineGraph'
import GaugeChart from 'src/shared/components/GaugeChart'
import TableGraph from 'src/shared/components/TableGraph'
import SingleStat from 'src/shared/components/SingleStat'
import MarkdownCell from 'src/shared/components/MarkdownCell'
import TimeSeries from 'src/shared/components/time_series/TimeSeries'
import TimeMachineTables from 'src/flux/components/TimeMachineTables'
import RawFluxDataTable from 'src/shared/components/TimeMachine/RawFluxDataTable'
import TableGraphTransform from 'src/shared/components/TableGraphTransform'
import TableGraphFormat from 'src/shared/components/TableGraphFormat'
import AutoRefresh from 'src/shared/components/AutoRefresh'
import InvalidData from 'src/shared/components/InvalidData'

// Constants
import {emptyGraphCopy} from 'src/shared/copy/cell'
import {
  DEFAULT_TIME_FORMAT,
  DEFAULT_DECIMAL_PLACES,
} from 'src/dashboards/constants'
import {
  DEFAULT_GRAPH_OPTIONS,
  DEFAULT_SHOW_STATIC_LEGEND,
  DEFAULT_STATIC_LEGEND_POSITION,
  DataType,
} from 'src/shared/constants'

// Utils
import {AutoRefresher, GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {getDeep} from 'src/utils/wrappers'
import {groupByTimeSeriesTransform} from 'src/utils/groupByTimeSeriesTransform'
import {getLineColorsHexes} from 'src/shared/constants/graphColorPalettes'

// Actions
import {setHoverTime} from 'src/dashboards/actions'
import {notify} from 'src/shared/actions/notifications'

// Types
import {ColorString} from 'src/types/colors'
import {
  Source,
  Axes,
  TimeRange,
  Template,
  Query,
  CellQuery,
  CellType,
  FluxTable,
  RemoteDataState,
  QueryUpdateState,
  QueryType,
  TemplateValue,
  AnnotationViewer,
  Status,
  // AnnotationViewer
} from 'src/types'
import {
  TableOptions,
  FieldOption,
  DecimalPlaces,
  NoteVisibility,
  StaticLegendPositionType,
  GraphOptions,
} from 'src/types/dashboards'
import {GrabDataForDownloadHandler} from 'src/types/layout'
import {TimeSeriesServerResponse} from 'src/types/series'
import StaticGraph from 'src/shared/components/static_graph/StaticGraph'
import StaticGraphFormat from 'src/shared/components/static_graph/StaticGraphFormat'
import {TableGaugeChartOptionsInterface} from 'src/types/statisticalgraph'
import {VisType} from 'src/types/flux'
import CellSummaryOverlay from 'src/shared/components/CellSummaryOverlay'
import {buildCellSummary} from 'src/shared/utils/cellSummary'
import {CellSummary} from 'src/types'

interface TypeAndData {
  dataType: DataType
  data: TimeSeriesServerResponse[] | FluxTable[]
}

interface Props {
  axes: Axes
  source: Source
  queries: CellQuery[]
  queryType: QueryType
  timeRange: TimeRange
  colors: ColorString[]
  templates: Template[]
  showRawFluxData?: boolean
  tableOptions: TableOptions
  fieldOptions: FieldOption[]
  decimalPlaces?: DecimalPlaces
  type: CellType
  cellID: string
  inView: boolean
  timeFormat: string
  cellHeight: number
  graphOptions: GraphOptions
  staticLegend: boolean
  staticLegendPosition: StaticLegendPositionType
  autoRefresher: AutoRefresher
  manualRefresh: number
  resizerTopHeight: number
  fluxASTLink: string
  onZoom: () => void
  editQueryStatus: (queryID: string, status: Status) => void
  onSetResolution: () => void
  handleSetHoverTime: () => void
  onNotify: typeof notify
  grabDataForDownload?: GrabDataForDownloadHandler
  grabFluxData?: (data: string) => void
  rawData?: string
  visType?: VisType
  cellNote: string
  cellNoteVisibility: NoteVisibility
  editorLocation?: QueryUpdateState
  onUpdateCellColors?: (bgColor: string, textColor: string) => void
  onUpdateFieldOptions?: (fieldOptions: FieldOption[]) => void
  onUpdateVisType?: (type: CellType) => Promise<void>
  onPickTemplate?: (template: Template, value: TemplateValue) => void
  isUsingAnnotationViewer?: boolean
  annotationsViewMode?: AnnotationViewer[]
  tableGaugeChartOptions: TableGaugeChartOptionsInterface
  onUpdateTableGaugeChartOptions?: (
    tableGaugeChartOptions: TableGaugeChartOptionsInterface
  ) => void
  isShowSummaryOverlay?: boolean
  axisLabelWidth?: number
  staticLegendGap?: number
  containerStyle?: React.CSSProperties
  hideMaxMarker?: boolean
}
class RefreshingGraph extends Component<Props> {
  public static defaultProps: Partial<Props> = {
    inView: true,
    manualRefresh: 0,
    timeFormat: DEFAULT_TIME_FORMAT,
    decimalPlaces: DEFAULT_DECIMAL_PLACES,
    autoRefresher: GlobalAutoRefresher,
    staticLegend: DEFAULT_SHOW_STATIC_LEGEND,
    staticLegendPosition: DEFAULT_STATIC_LEGEND_POSITION,
    graphOptions: DEFAULT_GRAPH_OPTIONS,
  }

  public shouldComponentUpdate(nextProps: Props) {
    return this.haveVisOptionsChanged(nextProps)
  }

  public render() {
    const {
      type,
      source,
      colors,
      inView,
      queries,
      cellNote,
      onNotify,
      queryType,
      timeRange,
      templates,
      fluxASTLink,
      grabFluxData,
      manualRefresh,
      autoRefresher,
      showRawFluxData,
      isShowSummaryOverlay,
      editQueryStatus,
      cellNoteVisibility,
      grabDataForDownload,
    } = this.props

    if (this.shouldShowNoResults) {
      return (
        <div className="graph-empty">
          <p data-test="visualize-no-results">{emptyGraphCopy}</p>
        </div>
      )
    }

    if (type === CellType.Note) {
      return <MarkdownCell text={cellNote} />
    }

    return (
      <AutoSizer>
        {({width, height}) => {
          if (width === 0) {
            return null
          }

          return (
            <div
              style={{
                width: `${width}px`,
                height: `${height}px`,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              <AutoRefresh
                autoRefresh={autoRefresher}
                manualRefresh={manualRefresh}
              >
                {refreshingUUID => (
                  <TimeSeries
                    uuid={refreshingUUID}
                    source={source}
                    inView={inView}
                    queries={this.queries}
                    timeRange={timeRange}
                    xPixels={width}
                    templates={templates}
                    fluxASTLink={fluxASTLink}
                    editQueryStatus={editQueryStatus}
                    onNotify={onNotify}
                    grabDataForDownload={grabDataForDownload}
                    grabFluxData={grabFluxData}
                  >
                    {({
                      timeSeriesInfluxQL,
                      timeSeriesFlux,
                      rawFluxData,
                      loading,
                      isInitialFetch,
                      uuid,
                      errorMessage,
                    }) => {
                      if (
                        isInitialFetch &&
                        loading === RemoteDataState.Loading
                      ) {
                        return (
                          <div className="graph-empty">
                            <h3 className="graph-spinner" />
                          </div>
                        )
                      }

                      if (!this.hasValues(timeSeriesFlux, timeSeriesInfluxQL)) {
                        if (
                          errorMessage &&
                          _.get(queries, '0.text', '').trim()
                        ) {
                          return <InvalidData message={errorMessage} />
                        }

                        if (
                          cellNoteVisibility === NoteVisibility.ShowWhenNoData
                        ) {
                          return <MarkdownCell text={cellNote} />
                        }

                        if (
                          this.isFluxQuery &&
                          !getDeep<string>(source, 'links.flux', null)
                        ) {
                          return (
                            <div className="graph-empty">
                              <p>The current source does not support Flux</p>
                            </div>
                          )
                        }

                        return (
                          <div className="graph-empty">
                            <p>No Results</p>
                          </div>
                        )
                      }

                      if (
                        showRawFluxData &&
                        queryType === QueryType.Flux &&
                        !_.isEmpty(rawFluxData)
                      ) {
                        return (
                          <RawFluxDataTable
                            csv={rawFluxData}
                            width={width}
                            height={height}
                          />
                        )
                      }

                      const summary =
                        isShowSummaryOverlay && queryType === QueryType.InfluxQL
                          ? buildCellSummary({
                              queries: this.queries,
                              responses: timeSeriesInfluxQL,
                              timeRange,
                            })
                          : null

                      let itemColor: string | undefined
                      if (
                        summary?.items[0]?.chartLabel &&
                        timeSeriesInfluxQL?.length
                      ) {
                        try {
                          const transformed = groupByTimeSeriesTransform(
                            timeSeriesInfluxQL,
                            false
                          )
                          if (transformed?.sortedLabels?.length) {
                            const idx = transformed.sortedLabels.findIndex(
                              l => l.label === summary.items[0].chartLabel
                            )
                            if (idx >= 0) {
                              const hexes = getLineColorsHexes(
                                colors,
                                transformed.sortedLabels.length
                              )
                              itemColor = hexes[idx]
                            }
                          }
                        } catch {
                          // Fallback: no color when transform fails
                        }
                      }

                      switch (type) {
                        case CellType.SingleStat:
                          return this.wrapWithSummary(
                            this.singleStat(timeSeriesInfluxQL, timeSeriesFlux),
                            summary,
                            itemColor
                          )
                        case CellType.Table:
                          return this.wrapWithSummary(
                            this.table(
                              timeSeriesInfluxQL,
                              timeSeriesFlux,
                              uuid,
                              width,
                              height
                            ),
                            summary,
                            itemColor
                          )
                        case CellType.Gauge:
                          return this.wrapWithSummary(
                            this.gauge(timeSeriesInfluxQL, timeSeriesFlux),
                            summary,
                            itemColor
                          )
                        case CellType.StaticBar:
                        case CellType.StaticPie:
                        case CellType.StaticDoughnut:
                        case CellType.StaticScatter:
                        case CellType.StaticRadar:
                        case CellType.StaticStackedBar:
                        case CellType.StaticLineChart:
                        case CellType.StaticTableGaugeChart:
                          return this.wrapWithSummary(
                            this.StaticGraph(
                              timeSeriesInfluxQL,
                              timeSeriesFlux,
                              loading,
                              uuid,
                              this.props.hideMaxMarker
                            ),
                            summary,
                            itemColor
                          )
                        default:
                          return this.wrapWithSummary(
                            this.lineGraph(
                              timeSeriesInfluxQL,
                              timeSeriesFlux,
                              loading
                            ),
                            summary,
                            itemColor
                          )
                      }
                    }}
                  </TimeSeries>
                )}
              </AutoRefresh>
            </div>
          )
        }}
      </AutoSizer>
    )
  }

  private get isFluxQuery(): boolean {
    const {queryType} = this.props

    return queryType === QueryType.Flux
  }

  private get shouldShowNoResults(): boolean {
    const {queries} = this.props
    const isEmptyFluxQuery =
      this.isFluxQuery && _.get(queries, '0.text', '').trim() === ''

    return !queries.length || isEmptyFluxQuery
  }

  private hasValues(timeSeriesFlux, timeSeriesInfluxQL): boolean {
    const hasFluxValues = timeSeriesFlux.length
    const hasInfluxQLValues = timeSeriesInfluxQL.some(r =>
      _.get(r, 'response.results.0.series')
    )

    return hasFluxValues || hasInfluxQLValues
  }

  private haveVisOptionsChanged(prevProps: Props): boolean {
    const visProps: string[] = [
      'axes',
      'colors',
      'type',
      'tableOptions',
      'fieldOptions',
      'decimalPlaces',
      'timeFormat',
      'showRawFluxData',
      'queries',
      'templates',
      'manualRefresh',
      'timeRange',
      'inView',
      'staticLegend',
      'staticLegendPosition',
      'graphOptions',
      'tableGaugeChartOptions',
      'isShowSummaryOverlay',
      'hideMaxMarker',
    ]

    const prevVisValues = _.pick(prevProps, visProps)
    const curVisValues = _.pick(this.props, visProps)
    return !_.isEqual(prevVisValues, curVisValues)
  }

  private singleStat = (
    influxQLData: TimeSeriesServerResponse[],
    fluxData: FluxTable[]
  ): JSX.Element => {
    const {
      colors,
      cellHeight,
      decimalPlaces,
      manualRefresh,
      onUpdateVisType,
      onUpdateCellColors,
    } = this.props

    const {dataType, data} = this.getTypeAndData(influxQLData, fluxData)

    return (
      <SingleStat
        dataType={dataType}
        data={data}
        colors={colors}
        prefix={this.prefix}
        suffix={this.suffix}
        lineGraph={false}
        key={manualRefresh}
        cellHeight={cellHeight}
        decimalPlaces={decimalPlaces}
        onUpdateVisType={onUpdateVisType}
        onUpdateCellColors={onUpdateCellColors}
      />
    )
  }

  private table = (
    influxQLData: TimeSeriesServerResponse[],
    fluxData: FluxTable[],
    uuid: string,
    width: number,
    height: number
  ): JSX.Element => {
    const {
      colors,
      fieldOptions,
      timeFormat,
      tableOptions,
      decimalPlaces,
      manualRefresh,
      handleSetHoverTime,
      editorLocation,
      onUpdateFieldOptions,
      templates,
      onPickTemplate,
    } = this.props

    const {dataType, data} = this.getTypeAndData(influxQLData, fluxData)
    if (dataType === DataType.flux) {
      return (
        <TimeMachineTables
          data={data as FluxTable[]}
          uuid={uuid}
          dataType={dataType}
          colors={colors}
          width={width}
          height={height}
          key={manualRefresh}
          tableOptions={tableOptions}
          fieldOptions={fieldOptions}
          timeFormat={timeFormat}
          decimalPlaces={decimalPlaces}
          editorLocation={editorLocation}
          handleSetHoverTime={handleSetHoverTime}
          onUpdateFieldOptions={onUpdateFieldOptions}
        />
      )
    }

    return (
      <TableGraphTransform
        data={data as TimeSeriesServerResponse[]}
        uuid={uuid}
        dataType={dataType}
      >
        {(transformedData, nextUUID) => (
          <TableGraphFormat
            data={transformedData}
            uuid={nextUUID}
            dataType={dataType}
            tableOptions={tableOptions}
            fieldOptions={fieldOptions}
            timeFormat={timeFormat}
            decimalPlaces={decimalPlaces}
          >
            {(formattedData, sort, computedFieldOptions, onSort) => (
              <TableGraph
                data={formattedData}
                sort={sort}
                onSort={onSort}
                dataType={dataType}
                colors={colors}
                key={manualRefresh}
                tableOptions={tableOptions}
                fieldOptions={computedFieldOptions}
                timeFormat={timeFormat}
                decimalPlaces={decimalPlaces}
                editorLocation={editorLocation}
                handleSetHoverTime={handleSetHoverTime}
                onUpdateFieldOptions={onUpdateFieldOptions}
                onPickTemplate={onPickTemplate}
                templates={templates}
              />
            )}
          </TableGraphFormat>
        )}
      </TableGraphTransform>
    )
  }

  private gauge = (
    influxQLData: TimeSeriesServerResponse[],
    fluxData: FluxTable[]
  ): JSX.Element => {
    const {
      colors,
      cellID,
      cellHeight,
      decimalPlaces,
      manualRefresh,
      resizerTopHeight,
    } = this.props

    const {dataType, data} = this.getTypeAndData(influxQLData, fluxData)

    return (
      <GaugeChart
        data={data}
        dataType={dataType}
        cellID={cellID}
        colors={colors}
        prefix={this.prefix}
        suffix={this.suffix}
        key={manualRefresh}
        cellHeight={cellHeight}
        decimalPlaces={decimalPlaces}
        resizerTopHeight={resizerTopHeight}
      />
    )
  }

  private lineGraph = (
    influxQLData: TimeSeriesServerResponse[],
    fluxData: FluxTable[],
    loading: RemoteDataState
  ): JSX.Element => {
    const {
      axes,
      type,
      colors,
      onZoom,
      cellID,
      timeRange,
      cellHeight,
      decimalPlaces,
      graphOptions,
      staticLegend,
      manualRefresh,
      onUpdateVisType,
      handleSetHoverTime,
      hideMaxMarker,
    } = this.props

    const {dataType, data} = this.getTypeAndData(influxQLData, fluxData)

    return (
      <LineGraph
        data={data}
        type={type}
        axes={axes}
        cellID={cellID}
        colors={colors}
        onZoom={onZoom}
        queries={this.queries}
        loading={loading}
        dataType={dataType}
        key={manualRefresh}
        timeRange={timeRange}
        cellHeight={cellHeight}
        graphOptions={graphOptions}
        staticLegend={staticLegend}
        decimalPlaces={decimalPlaces}
        onUpdateVisType={onUpdateVisType}
        handleSetHoverTime={handleSetHoverTime}
        axisLabelWidth={this.props.axisLabelWidth}
        staticLegendGap={this.props.staticLegendGap}
        containerStyle={this.props.containerStyle}
        isUsingAnnotationViewer={this.props.isUsingAnnotationViewer}
        annotationsViewMode={this.props.annotationsViewMode}
        hideMaxMarker={hideMaxMarker}
      />
    )
  }

  private StaticGraph = (
    influxQLData: TimeSeriesServerResponse[],
    fluxData: FluxTable[],
    loading: RemoteDataState,
    uuid: string,
    hideMaxMarker?: boolean
  ): JSX.Element => {
    const {
      axes,
      type,
      colors,
      cellID,
      decimalPlaces,
      graphOptions,
      staticLegend,
      staticLegendPosition,
      manualRefresh,
      tableOptions,
      fieldOptions,
      templates,
      onUpdateFieldOptions,
      onPickTemplate,
      tableGaugeChartOptions,
      onUpdateTableGaugeChartOptions,
    } = this.props

    const {dataType, data} = this.getTypeAndData(influxQLData, fluxData)

    return (
      <StaticGraphFormat
        data={data as TimeSeriesServerResponse[]}
        dataType={dataType}
        fieldOptions={fieldOptions}
        uuid={uuid}
        tableGaugeChartOptions={tableGaugeChartOptions}
      >
        {(computedFieldOptions, tableGaugeChartOptions) => (
          <StaticGraph
            data={data}
            type={type}
            axes={axes}
            cellID={cellID}
            colors={colors}
            queries={this.queries}
            loading={loading}
            dataType={dataType}
            key={manualRefresh}
            tableOptions={tableOptions}
            fieldOptions={computedFieldOptions}
            graphOptions={graphOptions}
            staticLegend={staticLegend}
            staticLegendPosition={staticLegendPosition}
            decimalPlaces={decimalPlaces}
            onUpdateFieldOptions={onUpdateFieldOptions}
            onPickTemplate={onPickTemplate}
            templates={templates}
            tableGaugeChartOptions={tableGaugeChartOptions}
            onUpdateTableGaugeChartOptions={onUpdateTableGaugeChartOptions}
            originFiledOptions={fieldOptions}
            hideMaxMarker={hideMaxMarker}
          />
        )}
      </StaticGraphFormat>
    )
  }

  private get queries(): Query[] {
    const {queries, type} = this.props
    const normalizedQueries = queries.map(query => ({
      ...query,
      id: query.id ?? '',
      text: query.text ?? query.query ?? '',
    }))

    if (type === CellType.SingleStat) {
      return [normalizedQueries[0]]
    }

    if (type === CellType.Gauge) {
      return [normalizedQueries[0]]
    }

    return normalizedQueries
  }

  private get prefix(): string {
    const {axes} = this.props

    return _.get(axes, 'y.prefix', '')
  }

  private get suffix(): string {
    const {axes} = this.props
    return _.get(axes, 'y.suffix', '')
  }

  private wrapWithSummary = (
    graph: JSX.Element,
    summary: CellSummary | null,
    itemColor?: string
  ) => {
    if (!summary || summary.items.length === 0) {
      return graph
    }

    return (
      <div className="cell-summary-wrapper">
        <CellSummaryOverlay
          summary={summary}
          decimalPlaces={this.props.decimalPlaces}
          prefix={this.prefix}
          suffix={this.suffix}
          itemColor={itemColor}
        />
        <div className="cell-summary-wrapper__chart">{graph}</div>
      </div>
    )
  }

  private getTypeAndData(
    influxQLData: TimeSeriesServerResponse[],
    fluxData: FluxTable[]
  ): TypeAndData {
    if (influxQLData.length) {
      return {dataType: DataType.influxQL, data: influxQLData}
    }

    if (fluxData.length) {
      return {dataType: DataType.flux, data: fluxData}
    }

    return {dataType: DataType.influxQL, data: []}
  }
}

const mapStateToProps = ({links, annotations: {mode}}) => ({
  mode,
  fluxASTLink: links.flux.ast,
})

const mdtp = {
  handleSetHoverTime: setHoverTime,
  onNotify: notify,
}

type StateProps = ReturnType<typeof mapStateToProps>
type DispatchProps = typeof mdtp
type OwnProps = Omit<Props, keyof StateProps | keyof DispatchProps>

export default connect<StateProps, DispatchProps, OwnProps, any>(
  mapStateToProps,
  mdtp,
  null
)(RefreshingGraph)
