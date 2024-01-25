// Libraries
import React, {useEffect, useMemo, useRef, useState} from 'react'
import {Pie} from 'react-chartjs-2'
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
import {FluxTable, StaticLegendPositionType} from 'src/types'
import {TimeSeriesSeries, TimeSeriesServerResponse} from 'src/types/series'
import {ColorString} from 'src/types/colors'

// Constants
import {LEGEND_POSITION} from 'src/shared/constants/staticGraph'

// Components
import ChartContainer from 'src/shared/components/static_graph/common/ChartContainer'
import {StaticGraphLegend} from 'src/shared/components/static_graph/common/StaticGraphLegend'
import {Axes, CellType, FieldOption, TableOptions} from 'src/types/dashboards'
import {
  staticGraphDatasets,
  staticGraphOptions,
} from 'src/shared/utils/staticGraph'

ChartJS.register(CategoryScale, LinearScale, ArcElement, Title, Tooltip, Legend)
interface Props {
  axes: Axes
  cellID: string
  staticGraphStyle: React.CSSProperties
  data: TimeSeriesServerResponse[] | FluxTable[]
  colors: ColorString[]
  staticLegend: boolean
  staticLegendPosition: StaticLegendPositionType
  tableOptions: TableOptions
  fieldOptions: FieldOption[]
}

const PieChart = ({
  axes,
  staticGraphStyle,
  data,
  colors,
  staticLegend,
  staticLegendPosition,
  tableOptions,
  fieldOptions,
}: Props) => {
  const chartRef = useRef<ChartJS<'pie', [], unknown>>(null)
  const [chartInstance, setChartInstance] = useState<
    ChartJS<'pie', [], unknown>
  >(null)
  const {container, legend} = LEGEND_POSITION[staticLegendPosition]
  const rawData: TimeSeriesSeries[] = _.get(
    data,
    ['0', 'response', 'results', '0', 'series'],
    []
  )

  const chartData = useMemo(
    () =>
      staticGraphDatasets(CellType.StaticPie)({
        rawData,
        fieldOptions,
        tableOptions,
        colors,
      }),
    [data, tableOptions, fieldOptions]
  )

  const dynamicOption = useMemo(
    () =>
      staticGraphOptions[CellType.StaticPie]({
        axes,
      }),
    [data, tableOptions, fieldOptions]
  )

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
            <Pie ref={chartRef} options={dynamicOption} data={chartData} />
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

export default PieChart
