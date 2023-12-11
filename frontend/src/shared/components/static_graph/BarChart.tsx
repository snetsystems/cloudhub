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
  LogarithmicScale,
} from 'chart.js'
import {Axes, FluxTable} from 'src/types'

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
  LogarithmicScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
)

type ScaleType = 'logarithmic' | undefined
type BoundsType = [string, string] | undefined
type MinMaxValueType = number | undefined

interface Props {
  axes: Axes
  cellID: string
  staticGraphStyle: React.CSSProperties
  data: TimeSeriesServerResponse[] | FluxTable[]
  colors: ColorString[]
  xAxisTitle?: string
  yAxisTitle?: string
  staticLegend: boolean
}

const BarChart = ({
  axes,
  staticGraphStyle,
  data,
  colors,
  xAxisTitle,
  yAxisTitle,
  staticLegend,
}: Props) => {
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

  const type: ScaleType = axes?.y?.scale === 'log' ? 'logarithmic' : undefined
  const bounds: BoundsType = axes?.y?.bounds
  const min: MinMaxValueType =
    /^-?\d+(\.\d+)?$/.test(bounds[0]) && _.isFinite(_.toNumber(bounds[0]))
      ? _.toNumber(bounds[0])
      : undefined

  const max: MinMaxValueType =
    /^-?\d+(\.\d+)?$/.test(bounds[1]) && _.isFinite(_.toNumber(bounds[1]))
      ? _.toNumber(bounds[1])
      : undefined

  const isValidValue = value => {
    return value !== undefined && value !== ''
  }

  const formatYAxisValue = value => {
    let formattedValue

    switch (axes?.y?.base) {
      case 'raw':
        if (value >= 1e5) {
          formattedValue = value.toExponential(2)
        } else {
          formattedValue = value
        }
        break
      case '10':
        if (value >= 1e9) {
          formattedValue = (value / 1e9).toFixed(2) + ' B'
        } else if (value >= 1e6) {
          formattedValue = (value / 1e6).toFixed(2) + ' M'
        } else if (value >= 1e3) {
          formattedValue = (value / 1e3).toFixed(2) + ' K'
        } else {
          formattedValue = value
        }
        break
      case '2':
      default:
        if (value >= 1e9) {
          formattedValue = (value / 1e9).toFixed(2) + ' GB'
        } else if (value >= 1e6) {
          formattedValue = (value / 1e6).toFixed(2) + ' MB'
        } else if (value >= 1e3) {
          formattedValue = (value / 1e3).toFixed(2) + ' KB'
        } else {
          formattedValue = value
        }
        break
    }

    const prefix = axes?.y?.prefix ? axes.y.prefix : ''
    const suffix = axes?.y?.suffix ? axes.y.suffix : ''
    return prefix + formattedValue + suffix
  }

  const dynamicOption = {
    ...STATIC_GRAPH_OPTIONS,
    plugins: {
      ...STATIC_GRAPH_OPTIONS.plugins,
      legend: {
        display: staticLegend,
      },
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
            return formatYAxisValue(value)
          },
        },
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
