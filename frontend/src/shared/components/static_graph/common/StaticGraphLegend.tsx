// Library
import type {
  ChartType,
  DefaultDataPoint,
  ChartData,
  ChartConfiguration,
} from 'chart.js'
import {useEffect, useState} from 'react'
import {Chart as ChartJS} from 'chart.js'
import React from 'react'
import _ from 'lodash'
import classnames from 'classnames'

// Constants
import {LEGEND_MIN_MARGIN_WIDTH} from 'src/shared/constants/staticGraph'
import {ColorString} from 'src/types/colors'
// Components
import LoadingDots from 'src/shared/components/LoadingDots'

export interface StaticGraphLegendProps<
  TType extends ChartType = ChartType,
  TData = DefaultDataPoint<TType>,
  TLabel = unknown
> {
  chartInstance: ChartJS<TType, TData[], unknown>
  legendStyle: {[x: string]: React.CSSProperties}
  data: ChartData<TType, TData[], TLabel>

  handleUpdateData?: (data: ChartData<TType, TData[], TLabel>) => void
}

const findLongestString = (arr: any[]) => {
  return _.reduce(
    arr,
    (longest, current) => {
      const compareText = _.isArray(current.text)
        ? {text: _.join(current.text, '/')}
        : current

      return compareText.text.length > longest.text.length
        ? compareText
        : longest
    },
    {text: ''}
  )
}

const measureTextWidthCanvas = (text: string, font: string): number => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (context) {
    context.font = font
    const metrics = context.measureText(text)
    return metrics.width
  }
  return 0
}

export const StaticGraphLegend = <
  TType extends ChartType = ChartType,
  TData = DefaultDataPoint<TType>,
  TLabel = unknown
>({
  chartInstance,
  legendStyle,
  data,
}: StaticGraphLegendProps<TType, TData, TLabel>): React.ReactElement => {
  const [legendItems, setLegendItems] = useState([])
  const [maxContent, setMaxContent] = useState<number>()

  const {type} = chartInstance.config as ChartConfiguration<
    TType,
    TData,
    TLabel
  >
  useEffect(() => {
    if (chartInstance) {
      const chartInstanceLegendItems = chartInstance.legend.legendItems
      const maxLengthLegend = findLongestString(chartInstanceLegendItems)
      const textWidthCanvas = measureTextWidthCanvas(
        maxLengthLegend.text,
        '11px Roboto'
      )

      setMaxContent(textWidthCanvas + LEGEND_MIN_MARGIN_WIDTH)
      setLegendItems(chartInstanceLegendItems)
    }
  }, [chartInstance, data])

  if (!chartInstance) {
    return (
      <LoadingDots
        className={'graph-panel__refreshing openstack-dots--loading'}
      />
    )
  }

  const toggleVisibility = (index: number) => {
    const newLegendItems = _.map(legendItems, (v, i) =>
      index === i ? {...v, hidden: !v.hidden} : v
    )

    if (type === 'pie' || type === 'doughnut') {
      chartInstance.toggleDataVisibility(index)
    } else {
      const isHidden = chartInstance.isDatasetVisible(index)
      chartInstance.setDatasetVisibility(index, !isHidden)
    }

    chartInstance.update()
    setLegendItems(newLegendItems)
  }

  const getActiveItem = hidden => {
    return classnames('static-graph-static-legend--item', {
      disabled: hidden,
    })
  }

  return (
    <div
      style={{
        ...legendStyle.container,
        gridTemplateColumns: `repeat(auto-fill, minmax(${maxContent}px, 1fr))`,
      }}
      className="static-graph-static-legend"
    >
      {_.map(
        legendItems,
        (v, i) =>
          v.text !== '' && (
            <div
              className={getActiveItem(v.hidden)}
              key={`static-legend--${i}-${v.text}`}
              onMouseDown={() => toggleVisibility(i)}
              style={{
                ...legendStyle.item,
              }}
            >
              <div
                style={{backgroundColor: v.fillStyle}}
                className="static-graph-static-legend--item--maker"
              />
              <span>{v.text}</span>
            </div>
          )
      )}
    </div>
  )
}
