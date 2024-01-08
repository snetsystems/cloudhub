// Libraries
import React, {useEffect, useMemo, useRef, useState} from 'react'
import {Bar} from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LogarithmicScale,
} from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'
import _ from 'lodash'

// Types
import {
  Axes,
  FluxTable,
  StaticLegendPositionType,
  StatisticalGraphBoundsType,
  StatisticalGraphMinMaxValueType,
  StatisticalGraphScaleType,
} from 'src/types'
import {TimeSeriesSeries, TimeSeriesServerResponse} from 'src/types/series'
import {ColorString} from 'src/types/colors'

// Utilities
import {
  convertToStaticGraphMinMaxValue,
  formatStaticGraphValue,
  staticGraphDatasets,
} from 'src/shared/utils/staticGraph'

// Constants
import {
  LEGEND_POSITION,
  STATIC_GRAPH_OPTIONS,
} from 'src/shared/constants/staticGraph'

// Components
import ChartContainer from 'src/shared/components/static_graph/common/ChartContainer'
import {StaticGraphLegend} from 'src/shared/components/static_graph/common/StaticGraphLegend'
import {CellType, FieldOption, TableOptions} from 'src/types/dashboards'

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
)

interface Props {
  axes: Axes
  cellID: string
  staticGraphStyle: React.CSSProperties
  data: TimeSeriesServerResponse[] | FluxTable[]
  colors: ColorString[]
  xAxisTitle?: string
  yAxisTitle?: string
  staticLegend: boolean
  staticLegendPosition: StaticLegendPositionType
  tableOptions: TableOptions
  fieldOptions: FieldOption[]
}

const BarChart = ({
  axes,
  staticGraphStyle,
  data,
  colors,
  xAxisTitle,
  yAxisTitle,
  staticLegend,
  staticLegendPosition,
  tableOptions,
  fieldOptions,
}: Props) => {
  const chartRef = useRef<ChartJS<'bar', [], unknown>>(null)
  const [chartInstance, setChartInstance] = useState<
    ChartJS<'bar', [], unknown>
  >(null)
  const {container, legend} = LEGEND_POSITION[staticLegendPosition]

  const rawData: TimeSeriesSeries[] = _.get(
    data,
    ['0', 'response', 'results', '0', 'series'],
    []
  )

  const chartData = useMemo(
    () =>
      staticGraphDatasets(CellType.Histogram)({
        rawData,
        fieldOptions,
        tableOptions,
        colors,
      }),
    [data]
  )

  const type: StatisticalGraphScaleType =
    axes?.y?.scale === 'log' ? 'logarithmic' : undefined
  const bounds: StatisticalGraphBoundsType = axes?.y?.bounds
  const min: StatisticalGraphMinMaxValueType = convertToStaticGraphMinMaxValue(
    bounds[0]
  )
  const max: StatisticalGraphMinMaxValueType = convertToStaticGraphMinMaxValue(
    bounds[1]
  )

  const isValidValue = value => {
    return value !== undefined && value !== ''
  }

  const dynamicOption = {
    ...STATIC_GRAPH_OPTIONS,
    plugins: {
      ...STATIC_GRAPH_OPTIONS.plugins,
    },
    scales: {
      ...STATIC_GRAPH_OPTIONS.scales,
      x: {
        ...STATIC_GRAPH_OPTIONS.scales?.x,
        title: {
          ...STATIC_GRAPH_OPTIONS.scales?.x?.title,
          text: xAxisTitle,
        },
        ticks: {
          ...STATIC_GRAPH_OPTIONS.scales?.x?.ticks,
          callback: function (value) {
            return (
              axes?.x?.prefix + this.getLabelForValue(value) + axes?.x?.suffix
            )
          },
        },
      },
      y: {
        ...STATIC_GRAPH_OPTIONS.scales?.y,
        ...(type && {type}),
        ...(isValidValue(min) && {min}),
        ...(isValidValue(max) && {max}),
        title: {
          ...STATIC_GRAPH_OPTIONS.scales?.y?.title,
          text: yAxisTitle,
        },
        ticks: {
          ...STATIC_GRAPH_OPTIONS.scales?.y?.ticks,
          callback: function (value) {
            return formatStaticGraphValue(axes, value)
          },
        },
      },
    },
  }

  useEffect(() => {
    chartRef.current.resize()
  }, [staticLegend, staticLegendPosition])

  useEffect(() => {
    if (!chartInstance && chartRef.current) {
      setChartInstance(chartRef.current)
    }
  }, [chartRef.current])

  return (
    <div className="dygraph-child">
      <div className="dygraph-child-container" style={{...staticGraphStyle}}>
        <div className="static-graph-container" style={{...container}}>
          <ChartContainer>
            <Bar ref={chartRef} options={dynamicOption} data={chartData} />
          </ChartContainer>
          {staticLegend && chartInstance && (
            <StaticGraphLegend
              chartInstance={chartInstance}
              legendStyle={legend}
              data={chartData}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default BarChart
