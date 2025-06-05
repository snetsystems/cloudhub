import React, {useRef, useEffect, useMemo} from 'react'
import * as d3 from 'd3'
import {schemeCategory10} from 'd3-scale-chromatic'
import {
  CloudWord,
  Orientation,
  ScaleType,
  TokenData,
} from '../utils/wordCloudLayout'
import {useWordCloudLayout} from '../hooks/useWordCloudLayout'

export interface WordCloudProps {
  data: TokenData[]
  width: number
  height: number
  topN?: number
  orientation?: Orientation
  scale?: ScaleType
  minFontSize?: number
  maxFontSize?: number
  padding?: number
  onSelect?: (tag: TokenData) => void
  duration?: number
  exitDuration?: number
  animate?: boolean
}

export default function WordCloud({
  data,
  width,
  height,
  topN = 100,
  orientation = 'single',
  scale = 'linear',
  minFontSize = 10,
  maxFontSize = 36,
  padding = 5,
  onSelect,
  duration = 600,
  exitDuration = 200,
  animate = true,
}: WordCloudProps) {
  const words: CloudWord[] = useWordCloudLayout({
    data,
    width,
    height,
    topN,
    orientation,
    scale,
    minFontSize,
    maxFontSize,
    padding,
  })

  const palette = useMemo(
    () =>
      d3
        .scaleOrdinal<string>()
        .domain(words.map(w => w.text))
        .range(schemeCategory10),
    [words]
  )

  const prevWordsRef = useRef<CloudWord[]>([])
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)

    let g = svg.select<SVGGElement>('g')
    if (g.empty()) {
      g = svg.append('g')
    }
    g.attr('transform', `translate(${width / 2},${height / 2})`)

    const sel = g
      .selectAll<SVGTextElement, CloudWord>('text')
      .data(words, d => d.text)

    const enter = sel
      .enter()
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('fill', d => palette(d.text))
      .style('font-family', 'Inter UI, sans-serif')
      .style('fill-opacity', 0)
      .text(d => d.text)
      .on('click', (_, d) =>
        onSelect?.({text: d.text, value: d.value, meta: d.meta})
      )

    const merged = enter.merge(sel as any)
    const hasPrev = prevWordsRef.current.length > 0
    const useTransition = animate && hasPrev

    if (useTransition) {
      merged
        .transition()
        .duration(duration)
        .attr(
          'transform',
          d => `translate(${d.x},${d.y}) rotate(${d.rotate ?? 0})`
        )
        .style('font-size', d => `${d.size}px`)
        .style('fill-opacity', 1)

      sel
        .exit()
        .transition()
        .duration(exitDuration)
        .style('fill-opacity', 0)
        .remove()
    } else {
      merged
        .attr(
          'transform',
          d => `translate(${d.x},${d.y}) rotate(${d.rotate ?? 0})`
        )
        .style('font-size', d => `${d.size}px`)
        .style('fill-opacity', 1)

      sel.exit().remove()
    }

    svg.attr('width', width).attr('height', height)
    prevWordsRef.current = words
  }, [words, width, height, onSelect, duration, exitDuration, palette, animate])

  return <svg ref={svgRef} />
}
