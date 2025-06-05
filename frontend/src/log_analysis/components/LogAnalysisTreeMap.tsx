import React, {useEffect, useRef, useState} from 'react'
import * as d3 from 'd3'
import type {HierarchyRectangularNode} from 'd3-hierarchy'
import {TokenData} from 'src/dashboards/types'

interface TreemapNode {
  name: string
  value?: number
  children?: TreemapNode[]
}

interface LogAnalysisTreeMapProps {
  data: TokenData[]
  width: number
  height: number
  colorPalette?: string[]
  padding?: number
  topN?: number
  maxLabelLength?: number
  minTileWidth?: number
  minTileHeight?: number
  onRectClick: (token: string, rawCount: number, percent: number) => void
}

const DEFAULT_COLORS = [
  ...d3.schemeCategory10,
  ...d3.schemePaired,
  ...d3.schemeSet3,
]

const TreemapTooltip: React.FC<{
  x: number
  y: number
  name: string
  value: number
  percent: string
}> = ({x, y, name, value, percent}) => (
  <div
    style={{
      position: 'fixed',
      left: x,
      top: y,
      pointerEvents: 'none',
      zIndex: 2000,
      border: '2px solid #fa991c',
      borderRadius: 4,
      background: '#1f2131',
      boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
      padding: '6px 10px 6px',
      minWidth: 140,
      color: '#fff',
      fontSize: 13,
      lineHeight: 1.35,
      whiteSpace: 'nowrap',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
    }}
  >
    <span style={{fontWeight: 700, fontSize: 14}}>{name}</span>

    <div
      style={{
        height: 1,
        background: '#545667',
        opacity: 0.85,
        margin: '2px 0px 6px',
      }}
    />

    <span>
      {value}{' '}
      <span style={{fontWeight: 700, color: '#ffcf82'}}>({percent}%)</span>
    </span>
  </div>
)

const LogAnalysisTreeMap: React.FC<LogAnalysisTreeMapProps> = ({
  data,
  width,
  height,
  colorPalette = DEFAULT_COLORS,
  padding = 2,
  topN = 20,
  maxLabelLength = 12,
  minTileWidth = 5,
  minTileHeight = 5,
  onRectClick,
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{
    visible: boolean
    x: number
    y: number
    name: string
    value: number
    percent: string
  }>({
    visible: false,
    x: 0,
    y: 0,
    name: '',
    value: 0,
    percent: '',
  })

  const getDisplayData = (data: TokenData[], topN: number): TokenData[] => {
    let sorted = [...data].sort((a, b) => b.value - a.value)
    if (topN > 0 && sorted.length > topN) sorted = sorted.slice(0, topN)
    return sorted
  }

  const getLuminance = (color: string): number => {
    const c = d3.rgb(color)
    return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255
  }

  const getTextColor = (bgColor: string): string => {
    return getLuminance(bgColor) > 0.6 ? '#222' : '#fff'
  }

  const adjustDataForMinTileSize = (
    input: TokenData[],
    width: number,
    height: number,
    minTileWidth: number,
    minTileHeight: number
  ): TokenData[] => {
    const total = input.reduce((sum, d) => sum + d.value, 0)
    const totalArea = width * height
    const areaPerCount = totalArea / total
    const minArea = minTileWidth * minTileHeight
    const minCount = Math.ceil(minArea / areaPerCount)
    return input.map(d => (d.value < minCount ? {...d, count: minCount} : d))
  }

  useEffect(() => {
    if (!data || data.length === 0) return
    if (width === 0 || height === 0) return

    const displayData = getDisplayData(data, topN)

    const adjustedData = adjustDataForMinTileSize(
      displayData,
      width,
      height,
      minTileWidth,
      minTileHeight
    )

    const realTotal = displayData.reduce((sum, d) => sum + d.value, 0)

    const rootData: TreemapNode = {
      name: 'root',
      children: adjustedData.map(d => ({
        name: d.text,
        value: d.value,
      })),
    }

    const root = d3
      .hierarchy(rootData)
      .sum(d => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

    d3.treemap<TreemapNode>().size([width, height]).padding(padding)(root)

    const leaves = (root.leaves() as HierarchyRectangularNode<TreemapNode>[]).filter(
      d => d.x1 - d.x0 >= minTileWidth && d.y1 - d.y0 >= minTileHeight
    )

    const color = d3
      .scaleOrdinal<string>()
      .domain(leaves.map(d => d.data.name))
      .range(colorPalette)

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const nodes = svg
      .selectAll<SVGGElement, HierarchyRectangularNode<TreemapNode>>('g')
      .data(leaves)
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`)

    nodes
      .append('rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', d => color(d.data.name))
      .style('cursor', 'pointer')
      .on('click', (_, d) => {
        const original = displayData.find(x => x.text === d.data.name)!
        const pct = (original.value / realTotal) * 100
        onRectClick?.(d.data.name, original.value, pct)
      })
      .on('mouseenter', function (event, d) {
        const original = displayData.find(x => x.text === d.data.name)
        const percent =
          original && realTotal > 0
            ? (((original.value ?? 0) / realTotal) * 100).toFixed(2)
            : '0.00'
        setTooltip({
          visible: true,
          x: event.clientX + 10,
          y: event.clientY + 10,
          name: d.data.name,
          value: original?.value ?? 0,
          percent,
        })
      })
      .on('mousemove', function (event) {
        setTooltip(tooltip => ({
          ...tooltip,
          x: event.clientX + 10,
          y: event.clientY + 10,
        }))
      })
      .on('mouseleave', () => {
        setTooltip(tooltip => ({...tooltip, visible: false}))
      })

    nodes
      .append('text')
      .filter(d => {
        const boxWidth = d.x1 - d.x0
        const boxHeight = d.y1 - d.y0
        if (d.x1 - d.x0 < minTileWidth || d.y1 - d.y0 < minTileHeight)
          return false
        if (d.x1 - d.x0 > width * 0.7) return false
        if (boxWidth < 30) return false
        if (boxHeight < 20) return false
        return true
      })
      .attr('x', 6)
      .attr('y', 20)
      .attr('fill', d => getTextColor(color(d.data.name)))
      .attr('font-size', 14)
      .style('font-weight', 600)
      .text(function (d) {
        const original = displayData.find(x => x.text === d.data.name)
        const percent =
          original && realTotal > 0
            ? (((original.value ?? 0) / realTotal) * 100).toFixed(2)
            : '0.00'
        let label = `${d.data.name} ${percent}%`
        const boxWidth = d.x1 - d.x0 - 12
        let textElem = d3.select(this)
        textElem.text(label)
        let textLength = (textElem.node() as SVGTextElement).getComputedTextLength()
        if (textLength > boxWidth) {
          while (label.length > 0 && textLength > boxWidth) {
            label = label.slice(0, -1)
            textElem.text(label + '…')
            textLength = (textElem.node() as SVGTextElement).getComputedTextLength()
          }
          return label + '…'
        }
        return label
      })
      .attr('pointer-events', 'none')
  }, [
    data,
    width,
    height,
    colorPalette,
    padding,
    topN,
    maxLabelLength,
    minTileWidth,
    minTileHeight,
  ])

  return (
    <div style={{position: 'relative', width: '100%', height: '100%'}}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{
          display: 'block',
        }}
      />
      {tooltip.visible && (
        <TreemapTooltip
          x={tooltip.x}
          y={tooltip.y}
          name={tooltip.name}
          value={tooltip.value}
          percent={tooltip.percent}
        />
      )}
    </div>
  )
}

export default LogAnalysisTreeMap
