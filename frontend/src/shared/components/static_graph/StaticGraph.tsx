// Libraries
import React, {PureComponent, CSSProperties} from 'react'
import {withRouter, RouteComponentProps} from 'react-router'

// Components
import {ErrorHandlingWith} from 'src/shared/decorators/errors'
import InvalidData from 'src/shared/components/InvalidData'
import BarChart from 'src/shared/components/static_graph/BarChart'
import InvalidQuery from 'src/shared/components/InvalidQuery'

// Types
import {ColorString} from 'src/types/colors'
import {DecimalPlaces} from 'src/types/dashboards'
import {TimeSeriesServerResponse} from 'src/types/series'
import {Query, Axes, RemoteDataState, CellType, FluxTable} from 'src/types'
import {DataType} from 'src/shared/constants'
import {getDeep} from 'src/utils/wrappers'
import {buildDefaultXLabel, buildDefaultYLabel} from 'src/shared/presenters'

import {Chart as ChartJS} from 'chart.js'

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
  staticLegend: boolean
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

  public render() {
    const {loading, data} = this.props

    if (
      data.length > 1 ||
      data[0]['response']['results'][0]['series'][0]['values'].length > 1
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
    const {data, axes, colors, cellID, queries, type, staticLegend} = this.props
    const xAxisTitle = this.getAxisTitle('x', axes, queries)
    const yAxisTitle = this.getAxisTitle('y', axes, queries)

    switch (type) {
      case CellType.Histogram:
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
}

const GraphLoadingDots = () => (
  <div className="graph-panel__refreshing">
    <div />
    <div />
    <div />
  </div>
)

export default withRouter<Props>(StaticGraph)
