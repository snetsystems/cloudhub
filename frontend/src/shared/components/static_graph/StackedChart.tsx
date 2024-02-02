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
import {Axes, FluxTable, StaticLegendPositionType} from 'src/types'
import {TimeSeriesSeries, TimeSeriesServerResponse} from 'src/types/series'
import {ColorString} from 'src/types/colors'

import {
  staticGraphDatasets,
  staticGraphOptions,
} from 'src/shared/utils/staticGraph'

// Constants
import {LEGEND_POSITION} from 'src/shared/constants/staticGraph'

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

const StackedChart = ({
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
      staticGraphDatasets(CellType.StaticStackedBar)({
        rawData,
        fieldOptions,
        tableOptions,
        colors,
      }),
    [data, tableOptions, fieldOptions]
  )

  const dynamicOption = useMemo(
    () =>
      staticGraphOptions[CellType.StaticStackedBar]({
        axes,
        xAxisTitle,
        yAxisTitle,
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
            <Bar
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

export default StackedChart
