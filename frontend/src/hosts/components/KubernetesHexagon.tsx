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
import {D3K8sData, FocuseNode, KubernetesObject} from 'src/hosts/types'

interface Props {
  handleOnClickPodName: () => void
  handleOnClickVisualizePod: (target: SVGSVGElement) => void
  handleDBClick: (data: any) => void
  handleResize: (proportions: number[]) => void
  handleOpenTooltip: (target: any) => void
  handleCloseTooltip: () => void
  kubernetesObject: KubernetesObject
  kubernetesD3Data: D3K8sData
  focuseNode: FocuseNode
  pinNode: string[]
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

  public componentDidUpdate(prevProps: Props) {
    if (
      this.props.kubernetesD3Data &&
      JSON.stringify(prevProps.kubernetesD3Data) !==
        JSON.stringify(this.props.kubernetesD3Data)
    ) {
      d3.select('svg.kubernetes-svg')
        .selectAll('g')
        .remove()

      this.drawChart()
    }
  }

  public render() {
    return (
      <div ref={this.ref} style={this.containerStyles}>
        {!this.props.kubernetesD3Data.name ? (
          <PageSpinner />
        ) : (
          <svg
            className={'kubernetes-svg'}
            style={{
              width: '100%',
              height: '100%',
              font: '10px sans-serif',
              overflow: 'visible',
              textAnchor: 'middle',
            }}
          />
        )}
      </div>
    )
  }

  private drawChart() {
    const _this = this
    const {onMouseClick, onMouseOver, onMouseLeave} = _this
    const {
      kubernetesD3Data,
      kubernetesObject,
      pinNode,
      focuseNode,
    } = _this.props

    const dimensions = this.ref.current.getBoundingClientRect()
    const data = d3
      .pack()
      .size([dimensions.width, dimensions.height])
      .padding(40)(
      d3
        .hierarchy(kubernetesD3Data)
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

    const svg = d3.select('svg')

    svg.selectAll('g').remove()

    const node = svg
      .append('g')
      .attr('pointer-events', 'all')
      .classed('top-group', true)
      .selectAll('g')
      .data(data.descendants().slice(1))
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)

    node
      .append('path')
      .attr('id', d => d.data.name)
      .attr('d', d => circle(d.r + 4))
      .attr('display', 'none')

    node
      .filter(
        d =>
          d.depth > 0 &&
          d.depth < 3 &&
          d.data.type !== 'CR' &&
          d.data.type !== 'CRB'
      )
      .append('circle')
      .attr('data-name', d => d.data.name)
      .attr('data-label', d => d.data.label)
      .attr('data-type', d => d.data.type)
      .attr('data-limit-cpu', d => _.get(d.data, 'data.cpu'))
      .attr('data-limit-memory', d => _.get(d.data, 'data.memory'))
      .attr('class', 'nodeWrapper')
      .attr('r', d => d.r)
      .attr('fill', d => clusterTypeColorset[d.data.type])
      .attr('stroke', 'black')
      .attr('pointer-events', d => (d.children ? 'all' : 'none'))
      .on('mouseover', function() {
        onMouseOver(this)
      })
      .on('mouseleave', function() {
        onMouseLeave(this)
      })
      .on('click', function() {
        onMouseClick(this, data)
      })
      .on('mousedown', function() {
        d3.event.preventDefault()
      })

    node
      .filter(
        d =>
          d.depth === 3 ||
          (d.depth === 2 && (d.data.type === 'CR' || d.data.type === 'CRB'))
      )
      .append('path')
      .attr('class', 'hexagon')
      .attr('data-name', d => d.data.name)
      .attr('data-label', d => d.data.label)
      .attr('data-type', d => d.data.type)
      .attr('data-limit-cpu', d => _.get(d.data, 'data.cpu'))
      .attr('data-limit-memory', d => _.get(d.data, 'data.memory'))
      .attr('d', d => generateHexagon(d.r + 5))
      .classed('hexagon-alert', d => {
        let isAlert = false

        if (
          (d.data.type === 'Pod' &&
            d.data.status !== 'Running' &&
            d.data.status !== 'Succeeded') ||
          (d.data.type === 'DP' && d.data.status !== 'Succeeded')
        ) {
          isAlert = true
        }

        return isAlert
      })
      .attr('stroke', 'black')
      .attr('fill', 'white')
      .on('mouseover', function() {
        onMouseOver(this)
      })
      .on('mouseleave', function() {
        onMouseLeave(this)
      })
      .on('click', function(data) {
        onMouseClick(this, data)
      })
      .on('mousedown', function() {
        d3.event.preventDefault()
      })

    d3.select(`path`).classed('kubernetes-focuse', false)
    d3.select(`path[data-name=${focuseNode.name}]`).classed(
      'kubernetes-focuse',
      true
    )

    d3.select(`path`).classed('kubernetes-pin', false)
    _.forEach(pinNode, pin => {
      d3.select(`path[data-name=${pin}]`).classed('kubernetes-pin', true)
    })

    const textNode = svg
      .append('g')
      .attr('pointer-events', 'all')
      .classed('top-group', true)
      .selectAll('g')
      .data(data.descendants().slice(1))
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)

    textNode
      .filter(d => d.height > 0)
      .append('text')
      .attr('fill', 'white')
      .append('textPath')
      .attr('xlink:href', d => '#' + d.data.name)
      .attr('startOffset', '50%')
      .attr('font-size', d => (d.depth == 1 ? '12px' : '9px'))
      .text(d => d.data.label)

    let d3NodeObject = {}
    node
      .select(`circle[data-type=${'Node'}]`)
      .data()
      .forEach(s => {
        d3NodeObject[s.data.label] = {
          ...d3NodeObject[s.data.label],
          name: s.data.label,
          cpu: s.data.data.cpu,
          memory: s.data.data.memory,
        }
      })

    let d3PodObject = {}
    node
      .select(`path[data-type=${'Pod'}]`)
      .data()
      .forEach(s => {
        d3PodObject[s.data.label] = {
          ...d3PodObject[s.data.label],
          name: s.data.label,
          cpu: s.data.data.cpu,
          memory: s.data.data.memory,
        }
      })

    _.forEach(
      _.filter(
        d3NodeObject,
        f =>
          !_.map(
            _.filter(kubernetesObject, k8sObj => k8sObj['type'] === 'Node'),
            m => m['name']
          ).includes(f['name'])
      ),
      d3ModNod => {
        node
          .select(`circle[data-label=${d3ModNod['name']}]`)
          .attr('fill', 'gray')
      }
    )

    _.forEach(
      _.filter(
        d3PodObject,
        f =>
          !_.map(
            _.filter(kubernetesObject, k8sObj => k8sObj['type'] === 'Pod'),
            m => m['name']
          ).includes(f['name'])
      ),
      d3ModPod => {
        node.select(`path[data-label=${d3ModPod['name']}]`).attr('fill', 'gray')
      }
    )

    _.forEach(kubernetesObject, m => {
      if (m['type'] === 'Node') {
        const cpuUsage =
          (parseFloat(m['cpu']) /
            parseFloat(
              node
                .select(`circle[data-label=${m['name']}]`)
                .attr('data-limit-cpu')
            )) *
          100
        const memoryUsage =
          (parseFloat(m['memory']) /
            parseFloat(
              node
                .select(`circle[data-label=${m['name']}]`)
                .attr('data-limit-memory')
            )) *
          100
        const pick = cpuUsage > memoryUsage ? cpuUsage : memoryUsage
        node
          .select(`circle[data-label=${m['name']}]`)
          .attr('data-cpu', `${cpuUsage}`)
        node
          .select(`circle[data-label=${m['name']}]`)
          .attr('data-memory', `${memoryUsage}`)
          .attr('fill', kubernetesStatusColor(pick / 100))
      } else {
        const cpuUsage =
          (parseFloat(m['cpu']) /
            parseFloat(
              node
                .select(`path[data-label=${m['name']}]`)
                .attr('data-limit-cpu')
            )) *
          100
        const memoryUsage =
          (parseFloat(m['memory']) /
            parseFloat(
              node
                .select(`path[data-label=${m['name']}]`)
                .attr('data-limit-memory')
            )) *
          100

        const pick = cpuUsage > memoryUsage ? cpuUsage : memoryUsage
        node
          .select(`path[data-label=${m['name']}]`)
          .attr('data-cpu', `${cpuUsage}`)
        node
          .select(`path[data-label=${m['name']}]`)
          .attr('data-memory', `${memoryUsage}`)
          .attr('fill', kubernetesStatusColor(pick / 100))
      }
    })

    const autoBox = () => {
      this.ref.current.appendChild(svg.node())
      const {x, y, width, height} = svg.node().getBBox()
      this.ref.current.removeChild(svg.node())
      return [x, y, width, height]
    }

    return this.ref.current.append(svg.attr('viewBox', `${autoBox()}`).node())
  }

  private runOnSingleClick = (target: SVGSVGElement) => {
    this.props.handleOnClickVisualizePod(target)
    this.clickedOnce = false
  }

  private runOnDBClick = (target: SVGSVGElement, data) => {
    this.clickedOnce = false
    clearTimeout(this.timeout)
    this.onMouseDBClick(target, data)
  }

  private onMouseClick = (target: SVGSVGElement, data: D3K8sData) => {
    if (this.clickedOnce) {
      this.runOnDBClick(target, data)
    } else {
      this.timeout = setTimeout(() => {
        this.runOnSingleClick(target)
      }, this.timer)
      this.clickedOnce = true
    }
  }

  private onMouseDBClick = (target: SVGSVGElement, data: any) => {
    this.props.handleDBClick(data)
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
