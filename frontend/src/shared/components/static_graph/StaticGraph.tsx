// Libraries
import React, {PureComponent, CSSProperties} from 'react'
import {withRouter, RouteComponentProps} from 'react-router'
import {Chart as ChartJS} from 'chart.js'
import _ from 'lodash'

// Components
import {ErrorHandlingWith} from 'src/shared/decorators/errors'
import InvalidData from 'src/shared/components/InvalidData'
import BarChart from 'src/shared/components/static_graph/BarChart'
import InvalidQuery from 'src/shared/components/InvalidQuery'
import PieChart from 'src/shared/components/static_graph/PieChart'
import DoughnutChart from 'src/shared/components/static_graph/DoughnutChart'
import RadarChart from 'src/shared/components/static_graph/RadarChart'
import StackedChart from 'src/shared/components/static_graph/StackedChart'
import LineChart from 'src/shared/components/static_graph/LineChart'
import ScatterChart from 'src/shared/components/static_graph/ScatterChart'

// Types
import {ColorString} from 'src/types/colors'
import {
  DecimalPlaces,
  FieldOption,
  GraphOptions,
  StaticLegendPositionType,
  TableOptions,
} from 'src/types/dashboards'
import {TimeSeriesSeries, TimeSeriesServerResponse} from 'src/types/series'
import {
  Query,
  Axes,
  RemoteDataState,
  CellType,
  FluxTable,
  TemplateValue,
  Template,
} from 'src/types'
import {DataType} from 'src/shared/constants'

// Utils
import {getDeep} from 'src/utils/wrappers'
import {
  buildDefaultXLabel,
  buildDefaultYLabel,
  buildScatterChartDefaultXLabel,
  buildScatterChartDefaultYLabel,
} from 'src/shared/presenters'
import {fastMap} from 'src/utils/fast'
import {
  StatisticalGraphFieldOption,
  TableGaugeChartOptionsInterface,
} from 'src/types/statisticalgraph'
import {parseIfPositiveNumber} from 'src/shared/utils/staticGraph'
import StaticTableGaugeChart from './StaticTableGaugeChart'

ChartJS.defaults.font.size = 11
ChartJS.defaults.color = '#999dab'
ChartJS.defaults.font.family =
  '"Roboto", Helvetica, Arial, Tahoma, Verdana, sans-serif'

interface Props {
  axes: Axes
  type: CellType
  queries: Query[]
  colors: ColorString[]
  loading: RemoteDataState
  decimalPlaces: DecimalPlaces
  data: TimeSeriesServerResponse[] | FluxTable[]
  dataType: DataType
  cellID: string
  graphOptions: GraphOptions
  staticLegend: boolean
  staticLegendPosition: StaticLegendPositionType
  tableOptions: TableOptions
  fieldOptions: StatisticalGraphFieldOption[]
  templates?: Template[]
  onPickTemplate?: (template: Template, value: TemplateValue) => void
  onUpdateFieldOptions?: (fieldOptions: FieldOption[]) => void
  tableGaugeChartOptions: TableGaugeChartOptionsInterface
  onUpdateTableGaugeChartOptions?: (
    tableGaugeChartOptions: TableGaugeChartOptionsInterface
  ) => void
  originFiledOptions: FieldOption[]
  hideMaxMarker?: boolean
}

type StaticGraphProps = Props & RouteComponentProps<any, any>

interface State {
  staticLegendHeight: number
}

@ErrorHandlingWith(InvalidData)
class StaticGraph extends PureComponent<StaticGraphProps, State> {
  public static defaultProps: Partial<StaticGraphProps> = {
    staticLegend: false,
  }

  constructor(props: StaticGraphProps) {
    super(props)
    this.state = {
      staticLegendHeight: 0,
    }
  }

  public componentDidMount() {
    const {fieldOptions, tableGaugeChartOptions} = this.props
    this.handleUpdateFieldOptions(fieldOptions)
    this.handleUpdateTableGaugeChartOptions(tableGaugeChartOptions)
  }

  public componentDidUpdate(prevProps: Props) {
    const {fieldOptions, tableGaugeChartOptions} = this.props
    if (!_.isEqual(fieldOptions, prevProps.fieldOptions)) {
      this.handleUpdateFieldOptions(fieldOptions)
    }
    if (!_.isEqual(tableGaugeChartOptions, prevProps.tableGaugeChartOptions)) {
      this.handleUpdateTableGaugeChartOptions(tableGaugeChartOptions)
    }
  }

  private handleUpdateFieldOptions = (fieldOptions: FieldOption[]): void => {
    const {onUpdateFieldOptions} = this.props
    if (onUpdateFieldOptions) {
      onUpdateFieldOptions(fieldOptions)
    }
  }

  private handleUpdateTableGaugeChartOptions = (
    tableGaugeChartOptions: TableGaugeChartOptionsInterface
  ): void => {
    const {onUpdateTableGaugeChartOptions} = this.props
    if (onUpdateTableGaugeChartOptions) {
      onUpdateTableGaugeChartOptions(tableGaugeChartOptions)
    }
  }

  public render() {
    const {loading, data, type} = this.props
    if (data.length > 1 && type !== CellType.StaticTableGaugeChart) {
      return (
        <InvalidQuery
          message={'Only one query maker tab is supported in this graph type.'}
        />
      )
    }
    
    // Safety check for data structure
    const results = _.get(data, '0.response.results', [])
    const series = _.get(results, '0.series', [])
    if (series.length === 0) {
      return <InvalidQuery />
    }

    return (
      <div className="dygraph graph--hasYLabel" style={this.style}>
        {loading === RemoteDataState.Loading && (
          <div className="graph-panel__refreshing">
            <div /><div /><div />
          </div>
        )}
        {this.StaticGraphWithType}
      </div>
    )
  }

  private get StaticGraphWithType() {
    const {
      data,
      axes,
      colors,
      cellID,
      queries,
      type,
      graphOptions,
      staticLegend,
      staticLegendPosition,
      tableOptions,
      fieldOptions,
      templates,
      decimalPlaces,
      tableGaugeChartOptions,
      originFiledOptions,
      onPickTemplate
    } = this.props
    const {fillArea, showLine, showPoint} = graphOptions

    const fieldOptionsWithGroupByTag = this.getFieldOptionsWithGroupByTags(
      queries,
      fieldOptions
    )

    const xAxisTitle = this.getAxisTitle('x', axes, queries)
    const yAxisTitle = this.getAxisTitle('y', axes, queries)
    
    const xAxisTitleForScatterChart = this.getAxisTitleForScatterChart(
      'x',
      axes,
      queries
    )
    const yAxisTitleForScatterChart = this.getAxisTitleForScatterChart(
      'y',
      axes,
      queries
    )

    const showCount = parseIfPositiveNumber(templates, graphOptions)

    switch (type) {
      case CellType.StaticBar:
        return (
          <BarChart
            axes={axes}
            cellID={cellID}
            staticGraphStyle={this.staticGraphStyle}
            xAxisTitle={xAxisTitle}
            yAxisTitle={yAxisTitle}
            data={data}
            colors={colors}
            staticLegend={staticLegend}
            staticLegendPosition={staticLegendPosition}
            tableOptions={tableOptions}
            fieldOptions={fieldOptionsWithGroupByTag}
            showCount={showCount}
            decimalPlaces={decimalPlaces}
          />
        )
      case CellType.StaticStackedBar:
        return (
          <StackedChart
            axes={axes}
            cellID={cellID}
            staticGraphStyle={this.staticGraphStyle}
            xAxisTitle={xAxisTitle}
            yAxisTitle={yAxisTitle}
            data={data}
            colors={colors}
            staticLegend={staticLegend}
            staticLegendPosition={staticLegendPosition}
            tableOptions={tableOptions}
            fieldOptions={fieldOptionsWithGroupByTag}
            showCount={showCount}
            decimalPlaces={decimalPlaces}
          />
        )
      case CellType.StaticPie:
        return (
          <PieChart
            axes={axes}
            cellID={cellID}
            staticGraphStyle={this.staticGraphStyle}
            data={data}
            colors={colors}
            staticLegend={staticLegend}
            staticLegendPosition={staticLegendPosition}
            tableOptions={tableOptions}
            fieldOptions={fieldOptionsWithGroupByTag}
            showCount={showCount}
            decimalPlaces={decimalPlaces}
          />
        )
      case CellType.StaticDoughnut:
        return (
          <DoughnutChart
            axes={axes}
            cellID={cellID}
            staticGraphStyle={this.staticGraphStyle}
            data={data}
            colors={colors}
            staticLegend={staticLegend}
            staticLegendPosition={staticLegendPosition}
            tableOptions={tableOptions}
            fieldOptions={fieldOptionsWithGroupByTag}
            showCount={showCount}
            decimalPlaces={decimalPlaces}
          />
        )
      case CellType.StaticScatter:
        return (
          <ScatterChart
            axes={axes}
            cellID={cellID}
            staticGraphStyle={this.staticGraphStyle}
            data={data}
            colors={colors}
            staticLegend={staticLegend}
            staticLegendPosition={staticLegendPosition}
            xAxisTitle={xAxisTitleForScatterChart}
            yAxisTitle={yAxisTitleForScatterChart}
            showCount={showCount}
            decimalPlaces={decimalPlaces}
          />
        )
      case CellType.StaticRadar:
        return (
          <RadarChart
            axes={axes}
            cellID={cellID}
            staticGraphStyle={this.staticGraphStyle}
            data={data}
            colors={colors}
            staticLegend={staticLegend}
            staticLegendPosition={staticLegendPosition}
            tableOptions={tableOptions}
            fieldOptions={fieldOptionsWithGroupByTag}
            showCount={showCount}
            decimalPlaces={decimalPlaces}
          />
        )
      case CellType.StaticLineChart:
        return (
          <LineChart
            axes={axes}
            cellID={cellID}
            staticGraphStyle={this.staticGraphStyle}
            data={data}
            colors={colors}
            fillArea={fillArea}
            showLine={showLine}
            showPoint={showPoint}
            staticLegend={staticLegend}
            staticLegendPosition={staticLegendPosition}
            tableOptions={tableOptions}
            fieldOptions={fieldOptionsWithGroupByTag}
            xAxisTitle={xAxisTitle}
            yAxisTitle={yAxisTitle}
            showCount={showCount}
            decimalPlaces={decimalPlaces}
            hideMaxMarker={this.props.hideMaxMarker}
          />
        )
      case CellType.StaticTableGaugeChart:
        return (
          <StaticTableGaugeChart
            data={data}
            decimalPlaces={decimalPlaces}
            staticGraphStyle={this.staticGraphStyle}
            tableGaugeChartOptions={tableGaugeChartOptions}
            originFiledOptions={originFiledOptions}
            onPickTemplate={onPickTemplate}
            templates={templates}
          />
        )
      default:
        return null
    }
  }

  private get style(): CSSProperties {
    return {height: '100%'}
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

  private get staticGraphStyle(): CSSProperties {
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

  private getAxisTitleForScatterChart = (
    axis: string,
    axes: Axes,
    queries: Query[]
  ): string => {
    const label = getDeep<string>(axes, `${axis}.label`, '') || ''
    const queryConfig = getDeep(queries, '0.queryConfig', false)
    if (label || !queryConfig) {
      return label
    }
    return axis === 'x' ? buildScatterChartDefaultXLabel(queryConfig) : buildScatterChartDefaultYLabel(queryConfig)
  }

  private getAxisTitle = (
    axis: string,
    axes: Axes,
    queries: Query[]
  ): string => {
    const label = getDeep<string>(axes, `${axis}.label`, '') || ''
    const queryConfig = getDeep(queries, '0.queryConfig', false)
    if (label || !queryConfig) {
      return label
    }
    return axis === 'x' ? buildDefaultXLabel(queryConfig) : buildDefaultYLabel(queryConfig)
  }

  private getFieldOptionsWithGroupByTags = (
    queries: Query[],
    fieldOptions: StatisticalGraphFieldOption[]
  ): StatisticalGraphFieldOption[] => {
    const groupByTags = queries?.[0]?.groupbys || _.get(queries, '0.queryConfig.groupBy.tags', [])
    return fastMap(fieldOptions, fieldOption => {
      const isGroupByTag = (groupByTags || []).indexOf(fieldOption.internalName)
      return isGroupByTag !== -1
        ? {...fieldOption, groupByTagOrder: isGroupByTag}
        : fieldOption
    })
  }
}

export default withRouter<Props>(StaticGraph)
