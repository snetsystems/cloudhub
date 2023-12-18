// Libraries
import React, {useEffect, useRef, useState} from 'react'
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
import {Axes, FluxTable, StaticLegendPositionType} from 'src/types'
import {TimeSeriesServerResponse} from 'src/types/series'
import {ColorString} from 'src/types/colors'

// Utils
import {fastMap} from 'src/utils/fast'
import {getLineColorsHexes} from 'src/shared/constants/graphColorPalettes'
import {changeColorsOpacity} from 'src/shared/graphs/helpers'

// Constants
import {
  LEGEND_POSITION,
  STATIC_GRAPH_OPTIONS,
} from 'src/shared/constants/staticGraph'

// Components
import ChartContainer from 'src/shared/components/static_graph/common/ChartContainer'
import {StaticGraphLegend} from 'src/shared/components/static_graph/common/StaticGraphLegend'

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
}

const PieChart = ({
  staticGraphStyle,
  data,
  colors,
  staticLegend,
  staticLegendPosition,
}: Props) => {
  const chartRef = useRef<ChartJS<'pie', [], unknown>>(null)
  const [chartInstance, setChartInstance] = useState<
    ChartJS<'pie', [], unknown>
  >(null)
  const {container, legend} = LEGEND_POSITION[staticLegendPosition]
  const convertData = data[0]['response']['results'][0]['series']
  const axesX = fastMap(convertData, item => _.values(item.tags))
  const columns = convertData[0].columns
  const processedData = fastMap(convertData, item =>
    item.values[0].slice(1).map(value => value)
  )
  const getColors = getLineColorsHexes(colors, axesX.length)
  const datasets = columns.slice(1).map((col, colIndex) => ({
    label: col,
    data: fastMap(processedData, data => data[colIndex]),
    backgroundColor: changeColorsOpacity(getColors, 0.5),
    borderColor: getColors,
    borderWidth: 1,
  }))
  const chartData = {
    labels: axesX,
    datasets,
  }

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
