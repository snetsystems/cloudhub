import React, {useEffect, useMemo, useRef, useState} from 'react'
import * as d3 from 'd3'
import type {HierarchyRectangularNode} from 'd3-hierarchy'
import {TokenData} from 'src/dashboards/types'

interface TreemapNode {
  name: string
  value?: number
  children?: TreemapNode[]
}

interface WeightedTokenData extends TokenData {
  weight: number
}

interface LogAnalysisTreeMapProps {
  data: TokenData[]
  width: number
  height: number
  colorPalette?: string[]
  padding?: number
  topN?: number
  minTileWidth?: number
  minTileHeight?: number
  onRectClick: (token: string) => void
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
    className="tree-map-modal"
    style={{
      left: x,
      top: y,
    }}
  >
    <span className="tree-map-modal__title">{name}</span>
    <div className="tree-map-modal__divider" />
    <span>
      {value} <span className="tree-map-modal__percent">({percent}%)</span>
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
  minTileWidth = 30,
  minTileHeight = 30,
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
  }>({visible: false, x: 0, y: 0, name: '', value: 0, percent: ''})

  const sortAndTrim = (src: TokenData[], n: number): TokenData[] => {
    const sorted = [...src].sort((a, b) => b.value - a.value)
    return n > 0 && sorted.length > n ? sorted.slice(0, n) : sorted
  }

  const getTextColor = (bg: string): string => {
    const {r, g, b} = d3.rgb(bg)
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return lum > 0.6 ? '#222' : '#fff'
  }

  const addWeights = (
    src: TokenData[],
    w: number,
    h: number,
    minW: number,
    minH: number
  ): WeightedTokenData[] => {
    const total = src.reduce((s, d) => s + d.value, 0)
    const areaPerCount = (w * h) / total
    const minArea = minW * minH
    const minCount = Math.ceil(minArea / areaPerCount)

    return src.map(d => ({
      ...d,
      weight: d.value < minCount ? minCount : d.value,
    }))
  }

  const {displayData, effectiveData, overflowCount, realTotal} = useMemo(() => {
    if (!data || width === 0 || height === 0)
      return {
        displayData: [],
        effectiveData: [],
        overflowCount: 0,
        realTotal: 0,
      }

    const sorted = sortAndTrim(data, topN)
    const maxTiles = Math.floor(
      (width * height) / (minTileWidth * minTileHeight)
    )

    const overflowCnt = Math.max(sorted.length - maxTiles, 0)
    const eff = overflowCnt > 0 ? sorted.slice(0, maxTiles) : sorted

    return {
      displayData: sorted,
      effectiveData: eff,
      overflowCount: overflowCnt,
      realTotal: sorted.reduce((s, d) => s + d.value, 0),
    }
  }, [data, width, height, topN, minTileWidth, minTileHeight])

  useEffect(() => {
    if (effectiveData.length === 0 || width === 0 || height === 0) return

    const weighted = addWeights(
      effectiveData,
      width,
      height,
      minTileWidth,
      minTileHeight
    )

    const maxTiles = Math.floor(
      (width * height) / (minTileWidth * minTileHeight)
    )
    const trimmed = weighted.slice(0, maxTiles)

    const rootData: TreemapNode = {
      name: 'root',
      children: trimmed.map(d => ({name: d.text, value: d.weight})),
    }
    const root = d3
      .hierarchy(rootData)
      .sum(d => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    d3.treemap<TreemapNode>().size([width, height]).padding(padding)(root)

    const leaves = root.leaves() as HierarchyRectangularNode<TreemapNode>[]

    const color = d3
      .scaleOrdinal<string>()
      .domain(leaves.map(l => l.data.name))
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
        onRectClick(d.data.name)
      })
      .on('mouseenter', (evt, d) => {
        const original = displayData.find(x => x.text === d.data.name)
        const pct =
          original && realTotal > 0
            ? ((original.value / realTotal) * 100).toFixed(2)
            : '0.00'
        setTooltip({
          visible: true,
          x: evt.clientX + 10,
          y: evt.clientY + 10,
          name: d.data.name,
          value: original?.value ?? 0,
          percent: pct,
        })
      })
      .on('mousemove', evt =>
        setTooltip(t => ({...t, x: evt.clientX + 10, y: evt.clientY + 10}))
      )
      .on('mouseleave', () => setTooltip(t => ({...t, visible: false})))

    // --- label
    nodes
      .append('text')
      .filter(d => {
        const w = d.x1 - d.x0
        const h = d.y1 - d.y0
        return w >= 30 && h >= 20 && w < width * 0.7
      })
      .attr('x', 6)
      .attr('y', 20)
      .attr('fill', d => getTextColor(color(d.data.name)))
      .attr('font-size', 14)
      .style('font-weight', 600)
      .text(function (d) {
        const original = displayData.find(x => x.text === d.data.name)
        const pct =
          original && realTotal > 0
            ? ((original.value / realTotal) * 100).toFixed(2)
            : '0.00'
        let label = `${d.data.name} ${pct}%`
        const boxWidth = d.x1 - d.x0 - 12
        const txt = d3.select(this)
        txt.text(label)
        let len = (txt.node() as SVGTextElement).getComputedTextLength()
        while (label.length && len > boxWidth) {
          label = label.slice(0, -1)
          txt.text(label + '…')
          len = (txt.node() as SVGTextElement).getComputedTextLength()
        }
        return len > boxWidth ? label + '…' : label
      })
      .attr('pointer-events', 'none')
  }, [
    effectiveData,
    displayData,
    realTotal,
    width,
    height,
    padding,
    colorPalette,
    minTileWidth,
    minTileHeight,
    onRectClick,
  ])
  return (
    <div className="relative-full">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{display: 'block'}}
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
      {overflowCount > 0 && (
        <span className="hidden-indicator">+{overflowCount} more</span>
      )}
    </div>
  )
}

export default LogAnalysisTreeMap
