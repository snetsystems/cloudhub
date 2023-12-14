// Libraries
import React, {useEffect, useRef, useState} from 'react'
import {Radar} from 'react-chartjs-2'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  Filler,
  LineElement,
  PointElement,
  RadialLinearScale,
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
import {TimeSeriesServerResponse} from 'src/types/series'
import {ColorString} from 'src/types/colors'

// Utils
import {fastMap} from 'src/utils/fast'
import {getLineColorsHexes} from 'src/shared/constants/graphColorPalettes'

import {
  convertToStaticGraphMinMaxValue,
  formatStaticGraphValue,
} from 'src/shared/utils/staticGraph'

// Constants
import {
  CHART_GRID_COLOR,
  CHART_LABEL_FONT_SIZE,
  CHART_LABEL_FONT_WEIGHT,
  LEGEND_POSITION,
  STATIC_GRAPH_OPTIONS,
} from 'src/shared/constants/staticGraph'

// Components
import ChartContainer from 'src/shared/components/static_graph/common/ChartContainer'
import {StaticGraphLegend} from 'src/shared/components/static_graph/common/StaticGraphLegend'
import {changeColorsOpacity} from 'src/shared/graphs/helpers'

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend
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
}

const RadarChart = ({
  axes,
  staticGraphStyle,
  data,
  colors,
  xAxisTitle,
  yAxisTitle,
  staticLegend,
  staticLegendPosition,
}: Props) => {
  const chartRef = useRef<ChartJS<'radar', [], unknown>>(null)
  const [chartInstance, setChartInstance] = useState<
    ChartJS<'radar', [], unknown>
  >(null)
  const {container, legend} = LEGEND_POSITION[staticLegendPosition]
  const convertData = data[0]['response']['results'][0]['series']
  const axesX = fastMap(convertData, item => _.values(item.tags))
  const columns = convertData[0].columns
  const processedData = fastMap(convertData, item =>
    item.values[0].slice(1).map(value => value)
  )
  const getcolors = getLineColorsHexes(colors, columns.length - 1)
  const datasets = columns.slice(1).map((col, colIndex) => ({
    label: col,
    data: fastMap(processedData, data => data[colIndex]),
    backgroundColor: changeColorsOpacity(getcolors, 0.2)[colIndex],
    borderColor: getcolors[colIndex],
    borderWidth: 1,
    pointBackgroundColor: changeColorsOpacity(getcolors, 0.7)[colIndex],
    pointBorderColor: getcolors[colIndex],
    pointHoverBackgroundColor: '#fff',
    pointHoverBorderColor: getcolors[colIndex],
  }))
  const chartData = {
    labels: axesX,
    datasets,
  }

  const bounds: StatisticalGraphBoundsType = axes?.y?.bounds
  const min: StatisticalGraphMinMaxValueType = convertToStaticGraphMinMaxValue(
    bounds[0]
  )
  const max: StatisticalGraphMinMaxValueType = convertToStaticGraphMinMaxValue(
    bounds[1]
  )

  const dynamicOption = {
    ...STATIC_GRAPH_OPTIONS,
    plugins: {
      ...STATIC_GRAPH_OPTIONS.plugins,
      zoom: {},
    },
    elements: {
      line: {
        borderWidth: 3,
      },
    },
    scales: {
      ...STATIC_GRAPH_OPTIONS.scales,
      r: {
        min: min,
        max: max,
        angleLines: {
          display: false,
        },

        ticks: {
          backdropColor: 'transparent',
          color: '#fff',
          font: {
            size: CHART_LABEL_FONT_SIZE,
            weight: CHART_LABEL_FONT_WEIGHT,
          },
        },
        grid: {
          color: 'rgba(255, 99, 132, 0.5)',
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
            <Radar ref={chartRef} options={dynamicOption} data={chartData} />
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

export default RadarChart
