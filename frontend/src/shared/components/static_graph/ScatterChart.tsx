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
import {TimeSeriesSeries, TimeSeriesServerResponse} from 'src/types/series'

// Constants
import {ColorString} from 'src/types/colors'
import {LEGEND_POSITION} from 'src/shared/constants/staticGraph'

// Components
import ChartContainer from 'src/shared/components/static_graph/common/ChartContainer'
import {StaticGraphLegend} from 'src/shared/components/static_graph/common/StaticGraphLegend'
import {
  staticGraphDatasets,
  staticGraphOptions,
} from 'src/shared/utils/staticGraph'
import {CellType} from 'src/types/dashboards'

// Utils
import {useIsUpdated} from 'src/shared/utils/staticGraphHooks'

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

  const rawData: TimeSeriesSeries[] = _.get(
    data,
    ['0', 'response', 'results', '0', 'series'],
    []
  )
  const queryKey = _.get(data, ['0', 'response', 'uuid'], [])
  const isUpdated = useIsUpdated({queryKey, colors})
  const chartData = useMemo(
    () =>
      staticGraphDatasets(CellType.StaticScatter)({
        rawData,
        colors,
      }),
    [isUpdated]
  )
  const dynamicOption = useMemo(
    () =>
      staticGraphOptions[CellType.StaticScatter]({
        axes,
        xAxisTitle,
        yAxisTitle,
      }),
    [isUpdated, axes, xAxisTitle, yAxisTitle]
  )

  useEffect(() => {
    if (chartInstance && chartRef.current) {
      chartRef.current.resize()
    }
  }, [staticLegend, staticLegendPosition])

  useEffect(() => {
    if (!chartInstance && chartRef.current) {
      setChartInstance(chartRef.current)
    }
  }, [chartRef.current])

  const onResetZoom = () => {
    if (chartRef && chartRef.current) {
      chartRef.current.resetZoom()
    }
  }

  return (
    <div className="dygraph-child">
      <div className="dygraph-child-container" style={{...staticGraphStyle}}>
        <div className="static-graph-container" style={{...container}}>
          <ChartContainer>
            <Scatter
              ref={chartRef}
              options={dynamicOption}
              data={chartData}
              onDoubleClick={onResetZoom}
            />
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
