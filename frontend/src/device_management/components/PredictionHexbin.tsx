import React, {useEffect, useRef, useState} from 'react'

// Library
import * as d3 from 'd3'
import {hexbin} from 'd3-hexbin'

// Components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import PredictionTooltip from 'src/device_management/components/PredictionTooltip'

// Constants
import {DEFAULT_CELL_BG_COLOR} from 'src/dashboards/constants'
import {TOOLTIP_OFFSET_X} from 'src/device_management/constants'

// Type
import {HexagonData, HexagonInputData, PredictionTooltipNode} from 'src/types'

// Utils
import {statusCal} from 'src/device_management/utils'

// Redux
import {connect} from 'react-redux'

interface Props {
  onHexbinClick: (host: string, filteredHexbinHost?: string) => void
  inputData: HexagonInputData[]
  isMouseInComponent: boolean

  filteredHexbinHost?: string
  alertHostList?: string[]
}

interface GenerateHexagonData {
  x: number
  y: number
}

const HEX_RADIUS = 30
const HEX_PADDING = 5
const PREFIX_PARENT_HEIGHT = 45

const PredictionHexbin = ({
  onHexbinClick,
  inputData,
  filteredHexbinHost,
  alertHostList,
  isMouseInComponent,
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
      blinkHexbinHost()
      highlightHexbinHost()
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

  useEffect(() => {
    blinkHexbinHost()
  }, [alertHostList])

  useEffect(() => {
    if (!isMouseInComponent) {
      setIsTooltipActive(false)
    }
  }, [isMouseInComponent])

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
            tempPosition.x = d.x + TOOLTIP_OFFSET_X / 2
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
        setIsMouseOn(false)
      })
      .on('click', function () {
        d3.select(this).attr('x', d => {
          onHexbinClick(d[0].name, filteredHexbinHost)
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

  const blinkHexbinHost = () => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)

    svg.selectAll('.hexagon').each(function (d) {
      const hexagon = d3.select(this)

      if (alertHostList.includes(d[0]?.name)) {
        hexagon.attr('class', 'hexagon blink')
      } else {
        hexagon.attr('class', 'hexagon')
      }
    })
  }

  const generateHexagonData = (): (GenerateHexagonData &
    HexagonInputData)[] => {
    const hexagonData = []
    const svgWidth = svgRef.current.clientWidth
    const hexWidth = Math.sqrt(3) * HEX_RADIUS // Hexagon width
    const hexHeight = 2 * HEX_RADIUS // Hexagon height
    let xOffset = 0
    let yOffset = 0
    for (let i = 0; i < inputData.length; i++) {
      const isOddRow = Math.floor(yOffset / ((hexHeight * 3) / 4)) % 2 === 1
      const x = xOffset + (isOddRow ? HEX_RADIUS * 1.5 : 0)
      const y = yOffset + hexHeight * 0.75
      hexagonData.push({
        x: x + HEX_PADDING,
        y: y + HEX_PADDING,
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
      hexagonData.reduce((max, d) => Math.max(max, d.y), 0) + HEX_RADIUS
    svgRef.current.style.height = `${maxHeight}px`
    const hexbinGenerator = hexbin<HexagonData>()
      .extent([
        [0, 0],
        [svgWidth, svgHeight],
      ])
      .radius(HEX_RADIUS)
      .x(d => d.x)
      .y(d => d.y)

    svg
      .selectAll('.hexagon')
      .data(hexbinGenerator(hexagonData))
      .enter()
      .append('path')
      .attr('class', 'hexagon')
      .attr('d', hexbinGenerator.hexagon(HEX_RADIUS - HEX_PADDING))
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('fill', d => d[0]?.statusColor)

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
      gap.height =
        tooltipPosition.y +
        childWidth.height -
        parentHeight -
        PREFIX_PARENT_HEIGHT
    }

    position.x =
      gap.width > 0
        ? tooltipPosition.x - childWidth.width - TOOLTIP_OFFSET_X
        : tooltipPosition.x + TOOLTIP_OFFSET_X / 2
    position.y =
      gap.height > 0 ? tooltipPosition.y - gap.height : tooltipPosition.y

    return (
      <div
        ref={childrenRef}
        onMouseMove={() => {
          setIsTooltipActive(false)
        }}
        style={{
          top: `${position.y}px`,
          left: `${position.x}px`,
        }}
        className={`prediction-tooltip ${
          !isMouseInComponent || (!isTooltipActive && !isMouseOn)
            ? 'hidden'
            : 'active'
        } `}
      >
        <PredictionTooltip
          cpu={tooltip.cpu}
          memory={tooltip.memory}
          traffic={tooltip.traffic}
          name={tooltip.name}
          status={statusCal((tooltip.cpu + tooltip.memory) / 2)}
        />
      </div>
    )
  }

  return (
    <FancyScrollbar style={{height: 'calc(100% - 45px)'}} autoHide={true}>
      <div
        ref={parentRef}
        style={{
          paddingLeft: '12px',
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
    predictionDashboard: {filteredHexbinHost, alertHostList},
  } = state
  return {
    filteredHexbinHost,
    alertHostList,
  }
}

const mdtp = () => ({})

export default connect(mstp, mdtp, null)(PredictionHexbin)
