import React from 'react'
import {Bar} from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import {FluxTable} from 'src/types'

import {TimeSeriesServerResponse} from 'src/types/series'

import {fastMap} from 'src/utils/fast'
import zoomPlugin from 'chartjs-plugin-zoom'

import _ from 'lodash'
import {ColorString} from 'src/types/colors'
import {getLineColorsHexes} from 'src/shared/constants/graphColorPalettes'
import {STATIC_GRAPH_OPTIONS} from 'src/shared/constants/staticGraph'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
)

interface Props {
  cellID: string
  staticGraphStyle: React.CSSProperties
  data: TimeSeriesServerResponse[] | FluxTable[]
  colors: ColorString[]
  chartLabel?: string
}

const BarChart = ({staticGraphStyle, data, colors, chartLabel}: Props) => {
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
    backgroundColor: getcolors[colIndex],
    borderColor: getcolors[colIndex],
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
      title: {
        text: chartLabel,
        display: true,
        position: 'left' as const,
      },
    },
  }
  return (
    <div className="dygraph-child">
      <div className="dygraph-child-container" style={{...staticGraphStyle}}>
        <Bar options={dynamicOption} data={chartData} />
      </div>
    </div>
  )
}
BarChart.defaultProps = {}

export default BarChart
