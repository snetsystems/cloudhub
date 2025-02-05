// Libraries
import React, {useEffect, useMemo, useRef, useState} from 'react'
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
import _ from 'lodash'

// Types
import {Axes, CellType, FluxTable, StaticLegendPositionType} from 'src/types'
import {TimeSeriesSeries, TimeSeriesServerResponse} from 'src/types/series'
import {ColorString} from 'src/types/colors'

// Utils
import {
  staticGraphDatasets,
  staticGraphOptions,
} from 'src/shared/utils/staticGraph'
import {useIsUpdated} from 'src/shared/utils/staticGraphHooks'

// Constants
import {LEGEND_POSITION} from 'src/shared/constants/staticGraph'

// Components
import ChartContainer from 'src/shared/components/static_graph/common/ChartContainer'
import {StaticGraphLegend} from 'src/shared/components/static_graph/common/StaticGraphLegend'
import {FieldOption, TableOptions} from 'src/types/dashboards'

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
  staticLegend: boolean
  staticLegendPosition: StaticLegendPositionType
  tableOptions: TableOptions
  fieldOptions: FieldOption[]
  showCount?: number | null
}

const RadarChart = ({
  axes,
  staticGraphStyle,
  data,
  colors,
  staticLegend,
  staticLegendPosition,
  tableOptions,
  fieldOptions,
  showCount,
}: Props) => {
  const chartRef = useRef<ChartJS<'radar', [], unknown>>(null)
  const [chartInstance, setChartInstance] = useState<
    ChartJS<'radar', [], unknown>
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
      staticGraphDatasets(CellType.StaticRadar)({
        rawData,
        colors,
        tableOptions,
        fieldOptions,
        showCount,
      }),
    [isUpdated, showCount]
  )
  const dynamicOption = useMemo(
    () =>
      staticGraphOptions[CellType.StaticRadar]({
        axes,
      }),
    [isUpdated, data, axes]
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
