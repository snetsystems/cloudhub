// Libraries
import React, {PureComponent, createRef} from 'react'
import * as d3 from 'd3'
import _ from 'lodash'

// Components
import PageSpinner from 'src/shared/components/PageSpinner'
import LoadingSpinner from 'src/flux/components/LoadingSpinner'
import {NoHostsState} from 'src/addon/128t/reusable'

// Constants
import {
  kubernetesStatusColor,
  clusterTypeColorset,
} from 'src/clouds/constants/color'

// Types
import {D3K8sData, FocuseNode, KubernetesObject} from 'src/clouds/types'
import {RemoteDataState} from 'src/types'

interface Props {
  handleOnClickVisualizePod: (data: any) => void
  handleDBClick: (data: any) => void
  handleResize: (proportions: number[]) => void
  handleOpenTooltip: (target: any) => void
  handleCloseTooltip: () => void
  kubernetesObject: KubernetesObject
  kubernetesD3Data: D3K8sData
  focuseNode: FocuseNode
  pinNode: string[]
  remoteDataState: RemoteDataState
}

interface State {}

class KubernetesHexagon extends PureComponent<Props, State> {
  private containerStyles = {
    width: '100%',
    height: '100%',
    backgroundColor: '#292933',
  }

  private ref = createRef<HTMLDivElement>()

  private clickedTarget = null
  private clickedOnce = false
  private timeout = null

  private dbClickJudgementTimer = 300

  constructor(props: Props) {
    super(props)
  }

  public componentDidUpdate(prevProps: Props) {
    if (
      this.props.kubernetesD3Data &&
      JSON.stringify(prevProps.kubernetesD3Data) !==
        JSON.stringify(this.props.kubernetesD3Data)
    ) {
      d3.select('svg.kubernetes-svg').selectAll('g').remove()

      this.drawChart()
    }
  }

  public render() {
    return (
      <div ref={this.ref} style={this.containerStyles}>
        {this.renderKubernetes}
      </div>
    )
  }

  private get renderKubernetes() {
    if (_.isEmpty(this.props.kubernetesD3Data.name)) {
      return (
        <>
          {this.props.remoteDataState === RemoteDataState.Loading ? (
            <PageSpinner />
          ) : (
            <NoHostsState />
          )}
        </>
      )
    } else {
      return (
        <>
          {this.props.remoteDataState === RemoteDataState.Loading ? (
            <div
              style={{
                position: 'absolute',
                top: '0px',
                left: '0px',
                padding: '5px 20px',
              }}
            >
              <LoadingSpinner />
            </div>
          ) : null}
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
        </>
      )
    }
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
          .map(function (p) {
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
      .on('mouseover', function () {
        onMouseOver(this)
      })
      .on('mouseleave', function () {
        onMouseLeave(this)
      })
      .on('click', function (data) {
        onMouseClick(this, data)
      })
      .on('mousedown', function () {
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
      .on('mouseover', function () {
        onMouseOver(this)
      })
      .on('mouseleave', function () {
        onMouseLeave(this)
      })
      .on('click', function (data) {
        onMouseClick(this, data)
      })
      .on('mousedown', function () {
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
      .filter(
        d =>
          !(
            d.depth === 3 ||
            (d.depth === 2 && (d.data.type === 'CR' || d.data.type === 'CRB'))
          )
      )
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
          .select(
            `circle[data-label=${String(d3ModNod['name']).replace(
              /[.:*+?^${}()|[\]\\]/g,
              '\\$&'
            )}]`
          )
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
        node
          .select(
            `path[data-label=${String(d3ModPod['name']).replace(
              /[.:*+?^${}()|[\]\\]/g,
              '\\$&'
            )}]`
          )
          .attr('fill', 'gray')
      }
    )

    _.forEach(kubernetesObject, m => {
      if (m['type'] === 'Node') {
        if (
          _.find(
            node.select(`circle[data-type=${'Node'}]`).data(),
            nodeData => nodeData.data.label === m['name']
          )
        ) {
          const cpuUsage =
            (parseFloat(m['cpu']) /
              parseFloat(
                node
                  .select(
                    `circle[data-label=${String(m['name']).replace(
                      /[.:*+?^${}()|[\]\\]/g,
                      '\\$&'
                    )}]`
                  )
                  .attr('data-limit-cpu')
              )) *
            100
          const memoryUsage =
            (parseFloat(m['memory']) /
              parseFloat(
                node
                  .select(
                    `circle[data-label=${String(m['name']).replace(
                      /[.:*+?^${}()|[\]\\]/g,
                      '\\$&'
                    )}]`
                  )
                  .attr('data-limit-memory')
              )) *
            100
          const pick = cpuUsage > memoryUsage ? cpuUsage : memoryUsage
          node
            .select(
              `circle[data-label=${String(m['name']).replace(
                /[.:*+?^${}()|[\]\\]/g,
                '\\$&'
              )}]`
            )
            .attr('data-cpu', `${cpuUsage}`)
          node
            .select(
              `circle[data-label=${String(m['name']).replace(
                /[.:*+?^${}()|[\]\\]/g,
                '\\$&'
              )}]`
            )
            .attr('data-memory', `${memoryUsage}`)
            .attr('fill', kubernetesStatusColor(pick / 100))
        }
      } else {
        if (
          _.find(
            node.select(`path[data-type=${'Pod'}]`).data(),
            podData => podData.data.label === m['name']
          )
        ) {
          const cpuUsage =
            (parseFloat(m['cpu']) /
              parseFloat(
                node
                  .select(
                    `path[data-label=${String(m['name']).replace(
                      /[.:*+?^${}()|[\]\\]/g,
                      '\\$&'
                    )}]`
                  )
                  .attr('data-limit-cpu')
              )) *
            100
          const memoryUsage =
            (parseFloat(m['memory']) /
              parseFloat(
                node
                  .select(
                    `path[data-label=${String(m['name']).replace(
                      /[.:*+?^${}()|[\]\\]/g,
                      '\\$&'
                    )}]`
                  )
                  .attr('data-limit-memory')
              )) *
            100

          const pick = cpuUsage > memoryUsage ? cpuUsage : memoryUsage
          node
            .select(
              `path[data-label=${String(m['name']).replace(
                /[.:*+?^${}()|[\]\\]/g,
                '\\$&'
              )}]`
            )
            .attr('data-cpu', `${cpuUsage}`)
          node
            .select(
              `path[data-label=${String(m['name']).replace(
                /[.:*+?^${}()|[\]\\]/g,
                '\\$&'
              )}]`
            )
            .attr('data-memory', `${memoryUsage}`)
            .attr('fill', kubernetesStatusColor(pick / 100))
        }
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

  private runOnSingleClick = (data: any) => {
    this.props.handleOnClickVisualizePod(data)
    this.clickedOnce = false
    this.clickedTarget = null
  }

  private runOnDBClick = (data: any) => {
    this.clickedOnce = false
    this.clickedTarget = null
    clearTimeout(this.timeout)
    this.onMouseDBClick(data)
  }

  private onMouseClick = (target: SVGSVGElement, data: D3K8sData) => {
    if (this.clickedTarget === target && this.clickedOnce) {
      this.runOnDBClick(data)
    } else if (
      (this.clickedTarget === null && !this.clickedOnce) ||
      (this.clickedTarget !== target && this.clickedOnce)
    ) {
      this.timeout = setTimeout(() => {
        this.runOnSingleClick(data)
      }, this.dbClickJudgementTimer)

      this.clickedTarget = target
      this.clickedOnce = true
    }
  }

  private onMouseDBClick = (data: any) => {
    this.props.handleDBClick(data)
    this.props.handleOnClickVisualizePod(data)
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
