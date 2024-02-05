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
// Utils
import {useIsUpdated} from 'src/shared/utils/staticGraphHooks'

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

const DoughnutChart = ({
  axes,
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
  const queryKey = _.get(data, ['0', 'response', 'uuid'], [])
  const isUpdated = useIsUpdated({queryKey, tableOptions, fieldOptions, colors})

  const chartData = useMemo(
    () =>
      staticGraphDatasets(CellType.StaticDoughnut)({
        rawData,
        fieldOptions,
        tableOptions,
        colors,
      }),
    [isUpdated]
  )

  const dynamicOption = useMemo(
    () =>
      staticGraphOptions[CellType.StaticDoughnut]({
        axes,
      }),
    [isUpdated, axes]
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
