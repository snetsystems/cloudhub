import React, from 'react'
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
import {
  Axes,
  DygraphSeries,
  DygraphValue,
  FluxTable,
  Query,
  TimeRange,
} from 'src/types'
import {LINE_COLORS} from 'src/shared/graphs/helpers'
import {DEFAULT_AXIS} from 'src/dashboards/constants/cellEditor'

import {getDeep} from 'src/utils/wrappers'
import {buildDefaultYLabel} from 'src/shared/presenters'
import {TimeSeriesServerResponse} from 'src/types/series'

import _ from 'lodash'
import FancyScrollbar from '../FancyScrollbar'
import {fastMap} from 'src/utils/fast'

export const options = {
  layout: {
    padding: {
      right: 0,
    },
  },

  maintainAspectRatio: false,
  responsive: true,
  plugins: {
    colorschemes: {
      scheme: LINE_COLORS,
    },
    title: {
      display: true,
      position: 'left',
    },
    legend: {
      display: true,
      labels: {
        font: {
          size: 11,
        },
      },
    },
  },

  scales: {
    x: {
      barThickness: 1,
      grid: {
        color: '#383846',
      },
      ticks: {
        font: {
          size: 11,
        },
      },
    },
    y: {
      grid: {
        color: '#383846',
      },
    },
  },
}
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const backgroundPlugin = {
  id: 'backgroundColored',
  beforeDraw: chart => {
    const ctx = chart.ctx
    ctx.fillStyle = '#292933'
    ctx.fillRect(0, 0, chart.width, chart.height)
  },
}
ChartJS.register(backgroundPlugin)
ChartJS.defaults.font.size = 11
ChartJS.defaults.color = '#999dab'
ChartJS.defaults.font.family =
  '"Roboto", Helvetica, Arial, Tahoma, Verdana, sans-serif'

interface Props {
  colorDygraphSeries: {}
  dygraphSeries: DygraphSeries
  cellID: string
  dygraphStyle: React.CSSProperties
  axes?: Axes
  labels: string[]
  queries: Query[]
  timeRange: TimeRange
  data: TimeSeriesServerResponse[] | FluxTable[]
  timeSeries: DygraphValue[][]
}

const getLabel = (
  axis: string,
  axes: Axes,
  labels: string[],
  queries: Query[]
): string => {
  // if label comes back as '', use the y axis label from props.labels, if it exists
  // see https://github.com/influxdata/chronograf/issues/5314
  const fallbackLabel = labels[1] || ''
  const label = getDeep<string>(axes, `${axis}.label`, '') || fallbackLabel
  const queryConfig = getDeep(queries, '0.queryConfig', false)

  if (label || !queryConfig) {
    return label
  }

  return buildDefaultYLabel(queryConfig)
}

const BarChart = ({
  colorDygraphSeries,
  dygraphStyle,
  axes,
  labels,
  queries,
  data,
}: Props) => {
  const chartLabel = getLabel('y', axes, labels, queries)
  const convertData = data[0]['response']['results'][0]['series']
  const getLabels = fastMap(convertData, item => _.values(item.tags))

  const columns = convertData[0].columns
  const processedData = fastMap(convertData, item =>
    item.values[0].slice(1).map(value => value)
  )
  const getcolors = fastMap(_.values(colorDygraphSeries), item => item['color'])

  const datasets = columns.slice(1).map((col, colIndex) => ({
    label: col,
    data: fastMap(processedData, data => data[colIndex]),
    backgroundColor: getcolors,
    borderColor: getcolors,
    borderWidth: 1,
  }))

  const chartData = {
    labels: getLabels,
    datasets,
  }

  const dynamicOption = {
    ...options,
    plugins: {
      ...options.plugins,
      title: {
        text: chartLabel,
      },
    },
  }
  return (
    <div className="dygraph-child">
      <div className="dygraph-child-container" style={{...dygraphStyle}}>
        <div style={{display: 'flex', height: '100%'}}>
          <div
            style={{
              flex: '1',
            }}
          >
            <FancyScrollbar>
              <div
                style={{
                  width: `${getLabels.length * 50 + 200}px`,
                  height: '100%',
                }}
              >
                <Bar options={dynamicOption} data={chartData} />
              </div>
            </FancyScrollbar>
          </div>
        </div>
      </div>
    </div>
  )
}
BarChart.defaultProps = {
  axes: {
    x: {
      bounds: [null, null],
      ...DEFAULT_AXIS,
    },
    y: {
      bounds: [null, null],
      ...DEFAULT_AXIS,
    },
  },
  containerStyle: {},
  isGraphFilled: true,
  onZoom: () => {},
  staticLegend: false,
  handleSetHoverTime: () => {},
  underlayCallback: () => {},
}

export default BarChart
