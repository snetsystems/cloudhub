// Libraries
import React, {PureComponent, createRef} from 'react'
import * as d3 from 'd3'
import _ from 'lodash'

// Components
import PageSpinner from 'src/shared/components/PageSpinner'

// Constants
import {
  kubernetesStatusColor,
  clusterTypeColorset,
} from 'src/hosts/constants/color'

// Types
import {KubernetesItem, FocuseNode} from 'src/hosts/types'

interface Props {
  handleOnClickPodName: () => void
  handleOnClickVisualizePod: (target: SVGSVGElement) => void
  handleDBClick: (target: SVGSVGElement) => void
  handleResize: (proportions: number[]) => void
  handleOpenTooltip: (target: any) => void
  handleCloseTooltip: () => void
  data: KubernetesItem
  focuseNode: FocuseNode
  pinNode: FocuseNode[]
}

interface State {}

class KubernetesHexagon extends PureComponent<Props, State> {
  private containerStyles = {
    width: '100%',
    height: '100%',
    backgroundColor: '#292933',
  }

  private ref = createRef<HTMLDivElement>()

  private clickedOnce = false
  private timeout = null
  private timer = 200

  constructor(props: Props) {
    super(props)
  }

  public componentDidUpdate() {
    d3.select('svg.kubernetes-svg')
      .selectAll('g')
      .remove()

    this.drawChart()
  }

  public render() {
    return (
      <div ref={this.ref} style={this.containerStyles}>
        {!this.props.data ? (
          <PageSpinner />
        ) : (
          <svg className={'kubernetes-svg'}></svg>
        )}
      </div>
    )
  }

  private drawChart = () => {
    const _this = this
    const {onMouseClick, onMouseOver, onMouseLeave} = _this
    const {focuseNode, pinNode, data: propsData} = _this.props
    const {width, height} = _this.ref.current.getBoundingClientRect()

    console.log({})

    const data = d3
      .pack()
      .size([width, height])
      .padding(40)(
      d3
        .hierarchy(propsData)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value)
    )

    const SQRT3 = Math.sqrt(3)
    const hexagonPoly = [
      [0, -1],
      [SQRT3 / 2, 0.5],
      [0, 1],
      [-SQRT3 / 2, 0.5],
      [-SQRT3 / 2, -0.5],
      [0, -1],
      [SQRT3 / 2, -0.5],
    ]
    const generateHexagon = hexRadius => {
      const hexagonPath =
        'm' +
        _.map(hexagonPoly, function(p) {
          return [p[0] * hexRadius, p[1] * hexRadius].join(',')
        }).join('l') +
        'z'
      return hexagonPath
    }

    const circle = d3
      .arc()
      .innerRadius(0)
      .outerRadius(d => d)
      .startAngle(-Math.PI)
      .endAngle(Math.PI)

    const svg = d3
      .select('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('font', '10px sans-serif')
      .style('overflow', 'visible')
      .attr('text-anchor', 'middle')

    const node = svg
      .append('g')
      .attr('pointer-events', 'all')
      .classed('top-group', true)
      .selectAll('g')
      .data(data.descendants().slice(1))
      .join('g')
      .classed('group', true)
      .attr('transform', d => `translate(${d.x},${d.y})`)

    node
      .append('path')
      .attr('id', d => d.data.name)
      .attr('d', d => circle(d.r + 4))
      .attr('display', 'none')

    node
      .filter(d => d.height !== 0)
      .append('circle')
      .attr('class', 'nodeWrapper')
      .attr('r', d => d.r)
      .attr('fill', d => clusterTypeColorset[d.data.type])
      .attr('data-type', d => d.data.type)
      .attr('data-name', d => d.data.name)
      .attr('data-label', d => d.data.label)
      .attr('pointer-events', d => (d.children ? 'all' : 'none'))
      .on('mouseover', function() {
        onMouseOver(this)
      })
      .on('mouseleave', function() {
        onMouseLeave(this)
      })
      .on('mousedown', function() {
        d3.event.preventDefault()
      })
      .on('click', function() {
        onMouseClick(this)
      })

    node
      .filter(d => d.height === 0)
      .on('mouseleave', function() {
        const path = this.children[1]
        const target = d3.select(path)
        const cpu = target.attr('data-cpu')
        const memory = target.attr('data-memory')
        const pick = cpu > memory ? cpu : memory

        target.attr('fill', kubernetesStatusColor(pick / 100))
      })
      .append('path')
      .attr('class', 'hexagon')
      .attr('data-type', d => d.data.type)
      .classed('kubernetes-focuse', d => {
        const {name, label} = focuseNode
        return d.data.name === name && d.data.label === label
      })
      .classed(
        'kubernetes-pin',
        d =>
          _.filter(
            pinNode,
            pin => d.data.name === pin.name && d.data.label === pin.label
          ).length > 0
      )
      .attr('d', d => generateHexagon(d.r + 5))
      .attr('stroke', 'black')
      .attr('fill', d =>
        d.children
          ? 'none'
          : (() => {
              const cpu = d.data.cpu
              const memory = d.data.memory
              const pick = cpu > memory ? cpu : memory

              return kubernetesStatusColor(pick / 100)
            })()
      )
      .attr('data-cpu', d => d.data.cpu)
      .attr('data-memory', d => d.data.memory)
      .attr('data-name', d => d.data.name)
      .attr('data-label', d => d.data.label)
      .attr('id', d => 'Node' + d.data.name)
      .on('mouseover', function() {
        onMouseOver(this)
      })
      .on('mouseleave', function() {
        onMouseLeave(this)
      })
      .on('click', function() {
        onMouseClick(this)
      })
      .on('mousedown', function() {
        d3.event.preventDefault()
      })

    node
      .filter(d => d.height !== 0)
      .append('text')
      .attr('fill', d => (d.height == 2 ? 'white' : 'black'))
      .append('textPath')
      .attr('xlink:href', d => '#' + d.data.name)
      .attr('startOffset', '50%')
      .attr('font-size', d => (d.height == 2 ? '15px' : '12px'))
      .attr('data-name', d => d.data.name)
      .attr('data-label', d => d.data.label)
      .text(d => d.data.label)

    const autoBox = () => {
      this.ref.current.appendChild(svg.node())
      const {x, y, width, height} = svg.node().getBBox()
      this.ref.current.removeChild(svg.node())
      console.log('autoBox: ', x, y, width, height)
      return [
        227.0439910888672,
        6.97705078125,
        676.3652954101562,
        779.7303466796875,
      ]
    }

    this.ref.current.append(svg.attr('viewBox', `${autoBox()}`).node())
  }

  private runOnSingleClick = (target: SVGSVGElement) => {
    this.props.handleOnClickVisualizePod(target)
    this.clickedOnce = false
  }

  private runOnDBClick = (target: SVGSVGElement) => {
    this.clickedOnce = false
    clearTimeout(this.timeout)
    this.onMouseDBClick(target)
  }

  private onMouseClick = (target: SVGSVGElement) => {
    if (this.clickedOnce) {
      this.runOnDBClick(target)
    } else {
      this.timeout = setTimeout(() => {
        this.runOnSingleClick(target)
      }, this.timer)
      this.clickedOnce = true
    }
  }

  private onMouseDBClick = (target: SVGSVGElement) => {
    this.props.handleDBClick(target)
    this.props.handleOnClickVisualizePod(target)
  }

  private onMouseOver = (target: SVGSVGElement) => {
    this.props.handleOpenTooltip(target)
    d3.select(target).classed('kubernetes-hover', true)
  }

  private onMouseLeave = (target: SVGSVGElement) => {
    this.props.handleCloseTooltip()
    d3.select(target).classed('kubernetes-hover', false)
  }
}

export default KubernetesHexagon
