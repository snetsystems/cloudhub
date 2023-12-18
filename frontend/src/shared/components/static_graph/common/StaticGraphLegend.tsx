// Library
import type {
  ChartType,
  DefaultDataPoint,
  ChartData,
  ChartConfiguration,
  LegendItem,
} from 'chart.js'
import {useEffect, useState} from 'react'
import {Chart as ChartJS} from 'chart.js'
import React from 'react'
import _ from 'lodash'
import classnames from 'classnames'

// Components
import LoadingDots from 'src/shared/components/LoadingDots'
import {getMaxContentLength} from 'src/shared/utils/staticGraph'

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

const toggleVisibilityWithType = <
  TType extends ChartType = ChartType,
  TData = DefaultDataPoint<TType>
>(
  type: string,
  chartInstance: ChartJS<TType, TData[], unknown>,
  index: number
) => {
  switch (type) {
    case 'pie':
    case 'doughnut': {
      return {
        isVisible: chartInstance.getDataVisibility(index),
        dataVisibility: (itemIndex: number, isVisible: boolean) => {
          const isCurrentlyVisible = chartInstance.getDataVisibility(itemIndex)
          if (isCurrentlyVisible !== isVisible) {
            chartInstance.toggleDataVisibility(itemIndex)
          }
        },
      }
    }

    default: {
      return {
        isVisible: chartInstance.isDatasetVisible(index),
        dataVisibility: (itemIndex: number, isVisible: boolean) =>
          chartInstance.setDatasetVisibility(itemIndex, isVisible),
      }
    }
  }
}

const getActiveItem = (hidden: boolean) => {
  return classnames('static-graph-static-legend--item', {
    disabled: hidden,
  })
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
  const [legendItems, setLegendItems] = useState<LegendItem[]>([])
  const [clickStatus, setClickStatus] = useState<boolean>(false)
  const [maxContent, setMaxContent] = useState<number>()

  const {type} = chartInstance.config as ChartConfiguration<
    TType,
    TData,
    TLabel
  >
  useEffect(() => {
    if (chartInstance) {
      const chartInstanceLegendItems = chartInstance.legend.legendItems
      const maxLegendLength = getMaxContentLength(
        chartInstanceLegendItems,
        'text'
      )

      setMaxContent(maxLegendLength)
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

  const toggleVisibility = (
    index: number,
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    const {isVisible, dataVisibility} = toggleVisibilityWithType(
      type,
      chartInstance,
      index
    )

    if (e.shiftKey || e.metaKey) {
      dataVisibility(index, !isVisible)
      const newLegendItems = _.map(legendItems, (v, i) =>
        index === i ? {...v, hidden: !v.hidden} : v
      )
      setLegendItems(newLegendItems)
      chartInstance.update()
      return
    }

    const prevClickStatus = clickStatus && isVisible
    const newLegendItems = _.map(legendItems, (item, i) => {
      const hidden = index === i ? false : !prevClickStatus
      dataVisibility(i, !hidden)
      return {...item, hidden}
    })

    setLegendItems(newLegendItems)
    setClickStatus(!prevClickStatus)
    chartInstance.update()
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
              onMouseDown={e => toggleVisibility(i, e)}
              style={{
                ...legendStyle.item,
              }}
            >
              <div
                style={{
                  backgroundColor: v.strokeStyle as string,
                }}
                className="static-graph-static-legend--item--maker"
              />
              <span>{v.text}</span>
            </div>
          )
      )}
    </div>
  )
}
