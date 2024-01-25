// Library
import React, {useEffect, useMemo, useRef, useState} from 'react'
import {Scatter} from 'react-chartjs-2'
import {
  Chart as ChartJS,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  DefaultDataPoint,
} from 'chart.js'
import _ from 'lodash'
import zoomPlugin from 'chartjs-plugin-zoom'

// Types
import {Axes, FluxTable, StaticLegendPositionType} from 'src/types'
import {TimeSeriesServerResponse} from 'src/types/series'

// Utils
import {fastMap} from 'src/utils/fast'
import {getLineColorsHexes} from 'src/shared/constants/graphColorPalettes'
import {changeColorsOpacity} from 'src/shared/graphs/helpers'

// Constants
import {ColorString} from 'src/types/colors'
import {LEGEND_POSITION} from 'src/shared/constants/staticGraph'

// Components
import InvalidQuery from 'src/shared/components/InvalidQuery'
import ChartContainer from 'src/shared/components/static_graph/common/ChartContainer'
import {StaticGraphLegend} from 'src/shared/components/static_graph/common/StaticGraphLegend'
import {staticGraphOptions} from 'src/shared/utils/staticGraph'
import {CellType} from 'src/types/dashboards'

ChartJS.register(
  LineElement,
  LinearScale,
  PointElement,
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
}

const ScatterChart = ({
  axes,
  staticGraphStyle,
  data,
  colors,
  xAxisTitle,
  yAxisTitle,
  staticLegend,
  staticLegendPosition,
}: Props) => {
  const chartRef = useRef<
    ChartJS<'scatter', DefaultDataPoint<'scatter'>[], unknown>
  >(null)
  const [chartInstance, setChartInstance] = useState<
    ChartJS<'scatter', DefaultDataPoint<'scatter'>[], unknown>
  >(null)
  const {container, legend} = LEGEND_POSITION[staticLegendPosition]

  const convertData = data[0]['response']['results'][0]['series']
  const axesX = fastMap(convertData, item => _.values(item.tags)[0]) as string[]
  const getcolors = getLineColorsHexes(colors, convertData.length)

  if (convertData.length > 3000) {
    return (
      <InvalidQuery
        message={
          'The results of the `group by` clause are too numerous to display. Please modify your query.'
        }
      />
    )
  }

  const scatterData = fastMap(convertData, (item, colIndex) => {
    return {
      label: _.values(item.tags).join('/'),
      data: _.reduce(
        item.values,
        (acc: any[], value: any) => {
          if (!(value[1] ?? false) && !(value[2] ?? false)) {
            return acc
          }

          acc.push({x: value[1], y: value[2]})
          return acc
        },
        []
      ),
      backgroundColor: changeColorsOpacity([getcolors[colIndex]], 0.8)[0],
      borderColor: getcolors[colIndex],
      borderWidth: 1,
    }
  })

  const chartData = {
    labels: axesX,
    datasets: scatterData,
  }

  const dynamicOption = useMemo(
    () =>
      staticGraphOptions[CellType.StaticScatter]({
        axes,
        xAxisTitle,
        yAxisTitle,
      }),
    [data, axes, xAxisTitle, yAxisTitle]
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
            <Scatter ref={chartRef} options={dynamicOption} data={chartData} />
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

export default ScatterChart
