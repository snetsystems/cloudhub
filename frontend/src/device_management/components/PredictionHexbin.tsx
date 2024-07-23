import React, {useEffect, useMemo, useRef, useState} from 'react'
import * as d3 from 'd3'
import {hexbin} from 'd3-hexbin'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {DEFAULT_CELL_BG_COLOR} from 'src/dashboards/constants'
import {PredictionTooltipNode} from 'src/types'
import PredictionTooltip from './PredictionTooltip'
import {TOOLTIP_WIDTH} from '../constants'
import {connect} from 'react-redux'

interface Props {
  onHexbinClick: (
    num: number,
    host: string,
    filteredHexbinHost?: string
  ) => void
  tooltipData: PredictionTooltipNode[]
  filteredHexbinHost?: string
}

interface HexagonData {
  x: number
  y: number
  statusColor: string
  hostname: string
  index: number
}

interface HexagonInputData extends PredictionTooltipNode {
  statusColor: string
}

interface GenerateHexagonData {
  x: number
  y: number
}

const hexRadius = 30
const hexPadding = 5

const PredictionHexbin = ({
  onHexbinClick,
  tooltipData,
  filteredHexbinHost,
}: Props) => {
  const parentRef = useRef<HTMLInputElement>(null)

  const childrenRef = useRef<HTMLInputElement>(null)

  const svgRef = useRef<SVGSVGElement>(null)

  const [isTooltipActive, setIsTooltipActive] = useState(false)

  const [isMouseOn, setIsMouseOn] = useState(false)

  const [tooltipNode, setTooltipNode] = useState<PredictionTooltipNode>({
    name: null,
    cpu: null,
    memory: null,
    traffic: null,
  })

  const [tooltipPosition, setTooltipPosition] = useState({
    x: 0,
    y: 0,
  })

  useEffect(() => {
    const resizeObserver = new ResizeObserver(_ => {
      generateHexagonData()
      drawHexagons()
      attachEventHandlers()
    })
    if (svgRef.current) {
      resizeObserver.observe(svgRef.current.parentNode as Element)
    }
    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    attachEventHandlers()
    highlightHexbinHost()
  }, [filteredHexbinHost])

  //initialize
  useEffect(() => {
    drawHexagons()
    attachEventHandlers()
  }, [])

  const statusCal = (valueUsage: number) => {
    if (typeof valueUsage === 'number') {
      const status =
        valueUsage < 0
          ? 'invalid'
          : valueUsage < 60
          ? 'normal'
          : valueUsage < 70
          ? 'warning'
          : valueUsage < 80
          ? 'danger'
          : valueUsage < 90
          ? 'critical'
          : valueUsage < 120
          ? 'emergency'
          : 'invalid'
      return status
    } else {
      return 'invalid'
    }
  }

  const statusHexColor = (status: string) => {
    //color change - prediction.scss
    switch (status) {
      case 'invalid':
        return '#545667'
      case 'normal':
        return '#2de5a5'
      case 'warning':
        return '#ffb94a'
      case 'danger':
        return '#dc4e58'
      case 'critical':
        return '#ff0000'
      case 'emergency':
        return '#ab0000'
      default:
        return '#545667'
    }
  }

  const inputData = useMemo<HexagonInputData[]>(() => {
    return tooltipData.map(hex => {
      if (typeof hex.cpu === 'number' && typeof hex.memory === 'number') {
        return {
          statusColor: statusHexColor(statusCal((hex.cpu + hex.memory) / 2)),
          name: hex.name,
          cpu: Number(hex.cpu.toFixed()),
          memory: Number(hex.memory.toFixed()),
          traffic: hex.traffic,
          status: statusCal((hex.cpu + hex.memory) / 2),
        }
      } else {
        return {
          statusColor: statusHexColor('invalid'),
          name: hex.name,
          cpu: -1,
          memory: -1,
          traffic: hex.traffic,
          status: 'invalid',
        }
      }
    })
  }, [tooltipData])

  const attachEventHandlers = () => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)

    svg
      .selectAll('.hexagon')
      .on('mouseover', function () {
        const tempPosition = {x: 0, y: 0}

        d3.select(this)
          .transition()
          .duration(150)
          .attr('transform', d => `translate(${d.x},${d.y}) scale(1.1)`)
          .style('cursor', 'pointer')
          .attr('x', d => {
            tempPosition.x = d.x + 15
            tempPosition.y = d.y + 15
            setTooltipNode({
              cpu: d[0].cpu,
              memory: d[0].memory,
              name: d[0].name,
              traffic: d[0].traffic,
            })
          })
        setIsTooltipActive(true)
        setIsMouseOn(true)
        setTooltipPosition(tempPosition)
      })
      .on('mouseout', function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('transform', d => `translate(${d.x},${d.y})`)
          .style('cursor', 'default')
        // setTooltipPosition({x: -999, y: -999})
        setIsMouseOn(false)
        // setIsTooltipActive(false)
      })
      .on('click', function () {
        d3.select(this).attr('x', d => {
          onHexbinClick(d[0].index, d[0].name, filteredHexbinHost)
        })
      })
  }

  const highlightHexbinHost = () => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)

    svg.selectAll('.hexagon').each(function (d) {
      const hexagon = d3.select(this)
      if (d[0].name === filteredHexbinHost) {
        hexagon.attr('stroke', '#f58220').attr('stroke-width', '3')
      } else {
        hexagon.attr('stroke', 'none').attr('stroke-width', '0')
      }
    })
  }

  const generateHexagonData = (): (GenerateHexagonData &
    HexagonInputData)[] => {
    const hexagonData = []
    const svgWidth = svgRef.current.clientWidth
    const hexWidth = Math.sqrt(3) * hexRadius // Hexagon의 폭
    const hexHeight = 2 * hexRadius // Hexagon height
    let xOffset = 0
    let yOffset = 0
    for (let i = 0; i < inputData.length; i++) {
      const isOddRow = Math.floor(yOffset / ((hexHeight * 3) / 4)) % 2 === 1
      const x = xOffset + (isOddRow ? hexRadius * 1.5 : 0)
      const y = yOffset + hexHeight * 0.75
      hexagonData.push({
        x: x + hexPadding,
        y: y + hexPadding,
        ...inputData[i],
        index: i,
      })
      if (x + hexWidth > svgWidth - hexHeight) {
        yOffset += (hexHeight * 3) / 4
        xOffset = 0
      } else {
        xOffset += hexWidth
      }
    }

    return hexagonData
  }

  const drawHexagons = () => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const hexagonData = generateHexagonData()
    const svgWidth = svgRef.current.clientWidth
    const svgHeight = svgRef.current.clientHeight
    const maxHeight =
      hexagonData.reduce((max, d) => Math.max(max, d.y), 0) + hexRadius
    svgRef.current.style.height = `${maxHeight}px`
    const hexbinGenerator = hexbin<HexagonData>()
      .extent([
        [0, 0],
        [svgWidth, svgHeight],
      ])
      .radius(hexRadius)
      .x(d => d.x)
      .y(d => d.y)

    svg
      .selectAll('.hexagon')
      .data(hexbinGenerator(hexagonData))
      .enter()
      .append('path')
      .attr('class', 'hexagon')
      .attr('d', hexbinGenerator.hexagon(hexRadius - hexPadding))
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('fill', d => d[0]?.statusColor)
      .filter(d => {
        return d[0]?.status === 'emergency'
      })
      .attr('class', 'hexagon blink')

    svg
      .selectAll('.hexagon-text')
      .data(hexagonData)
      .enter()
      .append('text')
      .attr('class', 'hexagon-text')
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('text-anchor', 'middle')
      .attr('dx', '.35em')
  }

  const tooltipComponent = (tooltip: PredictionTooltipNode) => {
    const gap = {width: 0, height: 0}
    const position = {x: 0, y: 0}
    const childWidth = {width: 0, height: 0}
    if (!!parentRef.current && !!childrenRef.current) {
      const {
        offsetWidth: parentWidth,
        offsetHeight: parentHeight,
      } = parentRef.current

      childWidth.width = childrenRef.current.offsetWidth
      childWidth.height = childrenRef.current.offsetHeight

      gap.width = tooltipPosition.x + childWidth.width - parentWidth
      gap.height = tooltipPosition.y + childWidth.height - parentHeight
    }

    position.x =
      gap.width > 0
        ? tooltipPosition.x - childWidth.width - 30
        : tooltipPosition.x
    position.y =
      gap.height > 0 ? tooltipPosition.y - gap.height : tooltipPosition.y

    return (
      <div
        ref={childrenRef}
        onMouseMove={() => {
          setIsTooltipActive(false)
        }}
        // onMouseOut={() => setIsTooltipActive(false)}
        style={{
          top: `${position.y}px`,
          left: `${position.x}px`,
        }}
        className={`prediction-tooltip ${
          isTooltipActive || isMouseOn ? 'active' : 'hidden'
        }`}
      >
        <div
          style={{width: TOOLTIP_WIDTH}}
          className="prediction-tooltip-content"
        >
          <PredictionTooltip
            cpu={tooltip.cpu}
            memory={tooltip.memory}
            traffic={tooltip.traffic}
            name={tooltip.name}
            status={statusCal((tooltip.cpu + tooltip.memory) / 2)}
          />
        </div>
      </div>
    )
  }

  return (
    <FancyScrollbar style={{height: 'calc(100% - 45px)'}} autoHide={true}>
      <div
        ref={parentRef}
        style={{
          backgroundColor: DEFAULT_CELL_BG_COLOR,
          height: 'calc(100% - 45px)',
        }}
        className={'tab-pannel'}
      >
        <svg ref={svgRef} style={{width: '100%', height: '80%'}}></svg>
        {tooltipComponent(tooltipNode)}
      </div>
    </FancyScrollbar>
  )
}

const mstp = state => {
  const {
    predictionDashboard: {filteredHexbinHost},
  } = state
  return {
    filteredHexbinHost,
  }
}

const mdtp = () => ({})

export default connect(mstp, mdtp, null)(PredictionHexbin)
