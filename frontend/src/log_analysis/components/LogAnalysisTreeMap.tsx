// Library
import React, {useEffect, useRef, useState} from 'react'
import * as d3 from 'd3'

// Components
import LogAnalysisDashboardHeader from 'src/log_analysis/components/LogAnalysisDashboardHeader'
import LoadingDots from 'src/shared/components/LoadingDots'

// Constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

interface TokenData {
  token: string
  count: number
}

interface Props {
  data: TokenData[]
}

const LogAnalysisTreeMap: React.FC<Props> = ({data}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({width: 0, height: 0})

  useEffect(() => {
    if (!svgRef.current) return

    const {width, height} = svgRef.current.getBoundingClientRect()
    setDimensions({width, height})

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const {width, height} = entry.contentRect
        setDimensions({width, height})
      }
    })
    resizeObserver.observe(svgRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!data || data.length === 0) return
    const {width, height} = dimensions
    if (width === 0 || height === 0) return

    const root = d3
      .hierarchy({
        name: 'root',
        children: data.map(d => ({name: d.token, value: d.count})),
      })
      .sum(d => (d as any).value)
      .sort((a, b) => b.value! - a.value!)

    const treemapLayout = d3
      .treemap<TokenData>()
      .size([width, height])
      .padding(1)
    treemapLayout(root)

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const nodes = svg
      .selectAll<SVGGElement, d3.HierarchyRectangularNode<TokenData>>('g')
      .data(root.leaves())
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`)

    nodes
      .append('rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', 'steelblue')

    nodes
      .append('text')
      .attr('x', 4)
      .attr('y', 14)
      .attr('fill', 'white')
      .text(d => `${d.data.name} (${d.data.value})`)
  }, [data, dimensions])

  return (
    <>
      <svg
        ref={svgRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </>
  )
}

export default LogAnalysisTreeMap
