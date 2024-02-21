// Libraries
import React, {PureComponent, CSSProperties} from 'react'
import {withRouter, RouteComponentProps} from 'react-router'
import {Chart as ChartJS} from 'chart.js'

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
import {Query, Axes, RemoteDataState, CellType, FluxTable} from 'src/types'
import {DataType} from 'src/shared/constants'
import {getDeep} from 'src/utils/wrappers'
import {
  buildDefaultXLabel,
  buildDefaultYLabel,
  buildScatterChartDefaultXLabel,
  buildScatterChartDefaultYLabel,
} from 'src/shared/presenters'
import {fastMap} from 'src/utils/fast'
import {StatisticalGraphFieldOption} from 'src/types/statisticalgraph'
import _ from 'lodash'

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
  onUpdateFieldOptions?: (fieldOptions: FieldOption[]) => void
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
    const {fieldOptions} = this.props

    this.handleUpdateFieldOptions(fieldOptions)
  }

  public componentDidUpdate(prevProps: Props) {
    const {fieldOptions} = this.props

    if (!_.isEqual(fieldOptions, prevProps.fieldOptions)) {
      this.handleUpdateFieldOptions(fieldOptions)
    }
  }

  private handleUpdateFieldOptions = (fieldOptions: FieldOption[]): void => {
    const {onUpdateFieldOptions} = this.props

    if (onUpdateFieldOptions) {
      onUpdateFieldOptions(fieldOptions)
    }
  }

  public render() {
    const {loading, data} = this.props
    if (
      data.length > 1 ||
      !data[0]['response']['results'][0]['series'][0].hasOwnProperty(
        'values'
      ) ||
      data[0]['response']['results'][0]['series'][0]?.['values']?.length > 1
    ) {
      return <InvalidQuery />
    }

    return (
      <div className="dygraph graph--hasYLabel" style={this.style}>
        {loading === RemoteDataState.Loading && <GraphLoadingDots />}
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
          />
        )
      case CellType.StaticScatter:
        const convertData: TimeSeriesSeries[] =
          data[0]['response']['results'][0]['series']
        const selectedFieldsLength = convertData[0].columns.filter(
          key => !_.keys(convertData[0].tags).indexOf(key) || key !== 'time'
        )
        if (selectedFieldsLength.length < 2) {
          return (
            <InvalidQuery
              message={'Please select two fields for the Scatter Chart.'}
            />
          )
        }
        if (convertData.length > 3000) {
          return (
            <InvalidQuery
              message={
                'The results of the `group by` clause are too numerous to display. Please modify your query.'
              }
            />
          )
        }
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
          />
        )
      default:
        break
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

    return axis === 'x'
      ? buildScatterChartDefaultXLabel(queryConfig)
      : buildScatterChartDefaultYLabel(queryConfig)
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

    return axis === 'x'
      ? buildDefaultXLabel(queryConfig)
      : buildDefaultYLabel(queryConfig)
  }

  private getFieldOptionsWithGroupByTags = (
    queries: Query[],
    fieldOptions: StatisticalGraphFieldOption[]
  ): StatisticalGraphFieldOption[] => {
    const groupByTags = queries[0].queryConfig.groupBy.tags
    return fastMap(fieldOptions, fieldOption => {
      const isGroupByTag = groupByTags.indexOf(fieldOption.internalName)
      return isGroupByTag !== -1
        ? {...fieldOption, groupByTagOrder: isGroupByTag}
        : fieldOption
    })
  }
}

const GraphLoadingDots = () => (
  <div className="graph-panel__refreshing">
    <div />
    <div />
    <div />
  </div>
)

export default withRouter<Props>(StaticGraph)
