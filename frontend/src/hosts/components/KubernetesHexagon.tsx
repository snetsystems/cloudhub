// Libraries
import React, {PureComponent, createRef} from 'react'
import * as d3 from 'd3'

// Components
import PageSpinner from 'src/shared/components/PageSpinner'

// Constants
import {
  kubernetesStatusColor,
  clusterTypeColorset,
} from 'src/hosts/constants/color'

interface Props {
  handleOnSetActiveEditorTab: (tab: string) => void
  handleOnClickPodName: () => void
  handleOnClickVisualizePod: (target: string) => void
  handleResize: (proportions: number[]) => void
  handleOpenTooltip: (target: any) => void
  handleCloseTooltip: () => void
  data: any
  focuseNode: string
}

interface State {}

class KubernetesHexagon extends PureComponent<Props, State> {
  private containerStyles = {
    width: '100%',
    height: '100%',
    backgroundColor: '#292933',
  }

  private ref = createRef<HTMLDivElement>()

  constructor(props: Props) {
    super(props)
  }

  public componentDidUpdate() {
    const removeGroup = d3.select('svg.kubernetes-svg').data(this.props.data)
    removeGroup.exit().remove()

    this.drawChart()
  }

  public render() {
    return this.props.data ? (
      <div ref={this.ref} style={this.containerStyles} />
    ) : (
      <PageSpinner />
    )
  }

  private drawChart = () => {
    const _this = this
    const {onMouseClick, onMouseDBClick, onMouseOver, onMouseLeave} = _this
    const {width, height} = _this.ref.current.getBoundingClientRect()

    const data = d3
      .pack()
      .size([width, height])
      .padding(30)(
      d3
        .hierarchy(this.props.data)
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
        hexagonPoly
          .map(function(p) {
            return [p[0] * hexRadius, p[1] * hexRadius].join(',')
          })
          .join('l') +
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
      .create('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('font', '10px sans-serif')
      .style('overflow', 'visible')
      .attr('text-anchor', 'middle')
      .classed('kubernetes-svg', true)

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
      .attr('pointer-events', d => (d.children ? 'all' : 'none'))
      .on('mouseover', function() {
        onMouseOver(this)
      })
      .on('mouseleave', function() {
        onMouseLeave(this)
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
      .on('dblclick', function() {
        onMouseDBClick(this)
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
      return [x, y, width, height]
    }

    this.ref.current.append(svg.attr('viewBox', `${autoBox()}`).node())
  }

  private onMouseClick = (target: SVGSVGElement) => {
    // focuseNode 설정
    this.props.handleOnClickVisualizePod(d3.select(target).attr('data-label'))
  }

  private onMouseDBClick = (target: SVGSVGElement) => {
    // 고정
    console.log('dbclick')
  }

  private onMouseOver = (target: SVGSVGElement) => {
    // 툴팁 열기
    this.props.handleOpenTooltip(target)
  }

  private onMouseLeave = (target: SVGSVGElement) => {
    // 툴팁 닫기
    this.props.handleCloseTooltip()
  }
}

export default KubernetesHexagon
