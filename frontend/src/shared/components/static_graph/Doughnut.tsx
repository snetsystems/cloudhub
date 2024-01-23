// Libraries
import React, {useEffect, useMemo, useRef, useState} from 'react'
import {Doughnut} from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'

import _ from 'lodash'

// Types
import {Axes, FluxTable, StaticLegendPositionType} from 'src/types'
import {TimeSeriesSeries, TimeSeriesServerResponse} from 'src/types/series'
import {ColorString} from 'src/types/colors'

// Utilities
import {staticGraphDatasets} from 'src/shared/utils/staticGraph'

// Constants
import {
  LEGEND_POSITION,
  STATIC_GRAPH_OPTIONS,
} from 'src/shared/constants/staticGraph'

// Components
import ChartContainer from 'src/shared/components/static_graph/common/ChartContainer'
import {StaticGraphLegend} from 'src/shared/components/static_graph/common/StaticGraphLegend'
import {CellType, FieldOption, TableOptions} from 'src/types/dashboards'

ChartJS.register(CategoryScale, LinearScale, ArcElement, Title, Tooltip, Legend)
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

const DoughnutChart = ({
  staticGraphStyle,
  data,
  colors,
  staticLegend,
  staticLegendPosition,
  tableOptions,
  fieldOptions,
}: Props) => {
  const chartRef = useRef<ChartJS<'doughnut', [], unknown>>(null)
  const [chartInstance, setChartInstance] = useState<
    ChartJS<'doughnut', [], unknown>
  >(null)
  const {container, legend} = LEGEND_POSITION[staticLegendPosition]
  const rawData: TimeSeriesSeries[] = _.get(
    data,
    ['0', 'response', 'results', '0', 'series'],
    []
  )

  const chartData = useMemo(
    () =>
      staticGraphDatasets(CellType.StaticDoughnut)({
        rawData,
        fieldOptions,
        tableOptions,
        colors,
      }),
    [data, tableOptions, fieldOptions]
  )

  const dynamicOption = {
    ...STATIC_GRAPH_OPTIONS,
    plugins: {
      ...STATIC_GRAPH_OPTIONS.plugins,
      zoom: {},
    },
    scales: {},
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
            <Doughnut ref={chartRef} options={dynamicOption} data={chartData} />
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

export default DoughnutChart
