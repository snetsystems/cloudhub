// Libraries
import React, {PureComponent, createRef} from 'react'
import * as d3 from 'd3'
import _ from 'lodash'
import {connect} from 'react-redux'

// Components
import PageSpinner from 'src/shared/components/PageSpinner'
import LoadingSpinner from 'src/flux/components/LoadingSpinner'
import {NoHostsState} from 'src/addon/128t/reusable'

// Constants
import {
  kubernetesStatusColor,
  clusterTypeColorset,
} from 'src/clouds/constants/color'

// Actions
import {setSelectedPersistentVolume} from 'src/clouds/actions/kubernetesPowerFlex'

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
  dispatch: (action: any) => void
  highlightVolumes: string[]
  handleHighlightVolumes: (highlightVolumes: any) => void
}

interface State {}

class KubernetesHexagon extends PureComponent<Props, State> {
  private containerStyles = {
    width: '100%',
    height: '100%',
    backgroundColor: '#292933',
  }

  private ref = createRef<HTMLDivElement>()

  private clickedTarget: any = null
  private clickedOnce = false
  private timeout: ReturnType<typeof setTimeout> | null = null

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
    if (
      _.isEmpty(this.props.kubernetesD3Data.name) ||
      this.props.kubernetesD3Data.children.length === 0
    ) {
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
      highlightVolumes,
      handleHighlightVolumes,
    } = _this.props

    const esc = (v: any) =>
      typeof (window as any).CSS !== 'undefined' &&
      typeof (window as any).CSS.escape === 'function'
        ? (window as any).CSS.escape(String(v))
        : String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&')

    const dimensions = this.ref.current!.getBoundingClientRect()
    const data = d3
      .pack()
      .size([dimensions.width, dimensions.height])
      .padding(40)(
      d3
        .hierarchy(kubernetesD3Data)
        .sum((d: any) => d.value || 0)
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

    const generateHexagon = (hexRadius: number) => {
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
      .outerRadius((d: any) => d)
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
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`)

    node
      .append('path')
      .attr('id', (d: any) => d.data.name)
      .attr('d', (d: any) => circle(d.r + 4))
      .attr('display', 'none')

    node
      .filter(
        (d: any) =>
          d.depth > 0 &&
          d.depth < 3 &&
          d.data.type !== 'CR' &&
          d.data.type !== 'CRB' &&
          d.data.type !== 'PV'
      )
      .append('circle')
      .attr('data-name', (d: any) => d.data.name)
      .attr('data-label', (d: any) => d.data.label)
      .attr('data-type', (d: any) => d.data.type)
      .attr('data-limit-cpu', (d: any) => _.get(d.data, 'data.cpu'))
      .attr('data-limit-memory', (d: any) => _.get(d.data, 'data.memory'))
      .attr('class', 'nodeWrapper')
      .attr('r', (d: any) => d.r)
      .attr('fill', (d: any) => clusterTypeColorset[d.data.type])
      // .attr('stroke', 'black')
      .on('mouseover', function () {
        onMouseOver(this)
      })
      .on('mouseleave', function () {
        onMouseLeave(this)
      })
      .on('click', function (_: any, data: any) {
        onMouseClick(this, data)
      })
      .on('mousedown', function (event: any) {
        event.preventDefault()
      })

    const hex = node
      .filter(
        (d: any) =>
          d.depth === 3 ||
          (d.depth === 2 &&
            (d.data.type === 'CR' ||
              d.data.type === 'CRB' ||
              d.data.type === 'PV'))
      )
      .append('path')
      .attr('class', 'hexagon')
      .attr('data-name', (d: any) => esc(d.data.name))
      .attr('data-label', (d: any) => d.data.label)
      .attr('data-type', (d: any) => d.data.type)

      .attr(
        'data-volume-name',
        (d: any) => (d.data && d.data.volume_name) || null
      )
      .attr('data-volume-spec', (d: any) => {
        const volumeSpec = d.data.volume_spec?.trim()
        return volumeSpec || null
      })
      .attr('data-limit-cpu', (d: any) => _.get(d.data, 'data.cpu'))
      .attr('data-limit-memory', (d: any) => _.get(d.data, 'data.memory'))
      .attr('d', (d: any) => generateHexagon(d.r + 5))
      .classed('hexagon-alert', (d: any) => {
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
      .on('click', function (_: any, data: any) {
        onMouseClick(this, data)
      })
      .on('mousedown', function (event: any) {
        event.preventDefault()
      })

    hex.each(function (d: any) {
      const r = d.r
      const g = d3.select(this.parentNode as SVGGElement)

      if (!g.select('path.checkmark').empty()) return
      const x1 = -0.82 * r
      const y1 = -0.12 * r
      const x2 = -0.24 * r
      const y2 = 0.68 * r
      const x3 = 0.66 * r
      const y3 = -0.7 * r

      const q1x = -0.6 * r
      const q1y = 0.02 * r
      const pathD = `M ${x1},${y1} Q ${q1x},${q1y} ${x2},${y2} L ${x3},${y3}`

      g.append('path')
        .attr('class', 'checkmark')
        .attr('d', pathD)
        .attr('fill', 'none')
        .attr('stroke', '#000')
        .attr('stroke-width', Math.max(3, 0.15 * r))
        .attr('stroke-linejoin', 'miter')
        .attr('stroke-miterlimit', 10)
        .attr('stroke-linecap', 'round')
        .style('pointer-events', 'none')
    })

    d3.select(`path`).classed('kubernetes-focuse', false)
    d3.select(`path[data-name=${esc(focuseNode.name)}]`).classed(
      'kubernetes-focuse',
      true
    )

    d3.select(`path`).classed('kubernetes-pin', false)
    _.forEach(pinNode, pin => {
      d3.select(`path[data-name=${esc(pin)}]`).classed('kubernetes-pin', true)
    })

    handleHighlightVolumes(highlightVolumes)
    // d3.select(`path`).classed('kubernetes-volume', false)
    // _.forEach(highlightVolumes, volume => {
    //   d3.select(`path[data-name=${esc(`PersistentVolume_${volume}`)}]`).classed(
    //     'kubernetes-volume',
    //     true
    //   )
    // })

    const textNode = svg
      .append('g')
      .attr('pointer-events', 'all')
      .classed('top-group', true)
      .selectAll('g')
      .data(data.descendants().slice(1))
      .join('g')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`)

    textNode
      .filter(
        (d: any) =>
          !(
            d.depth === 3 ||
            (d.depth === 2 &&
              (d.data.type === 'CR' ||
                d.data.type === 'CRB' ||
                d.data.type === 'PV'))
          )
      )
      .append('text')
      .attr('fill', 'white')
      .append('textPath')
      .attr('xlink:href', (d: any) => '#' + d.data.name)
      .attr('startOffset', '50%')
      .attr('font-size', (d: any) => (d.depth == 1 ? '12px' : '9px'))
      .text((d: any) => {
        const label = d.data.label || ''

        if (d.depth === 1) {
          const r = d.r || 0
          if (r < 14) return ''

          let maxLen = 8
          if (r >= 40) maxLen = 22
          else if (r >= 32) maxLen = 16
          else if (r >= 24) maxLen = 12
          else if (r >= 18) maxLen = 10

          if (label.length > maxLen) {
            const head = Math.max(0, maxLen - 3)
            return label.substring(0, head) + '...'
          }
          return label
        }

        return label
      })

    let d3NodeObject: any = {}
    node
      .select(`circle[data-type=${'Node'}]`)
      .data()
      .forEach((s: any) => {
        d3NodeObject[s.data.label] = {
          ...d3NodeObject[s.data.label],
          name: s.data.label,
          cpu: s.data.data.cpu,
          memory: s.data.data.memory,
        }
      })

    let d3PodObject: any = {}
    node
      .select(`path[data-type=${'Pod'}]`)
      .data()
      .forEach((s: any) => {
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
          .select(`circle[data-label=${esc(d3ModNod['name'])}]`)
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
          .select(`path[data-label=${esc(d3ModPod['name'])}]`)
          .attr('fill', 'gray')
      }
    )

    _.forEach(kubernetesObject, m => {
      if (m['type'] === 'Node') {
        if (
          _.find(
            node.select(`circle[data-type=${'Node'}]`).data(),
            (nodeData: any) => nodeData.data.label === m['name']
          )
        ) {
          const cpuUsage =
            (parseFloat(m['cpu']) /
              parseFloat(
                node
                  .select(`circle[data-label=${esc(m['name'])}]`)
                  .attr('data-limit-cpu')
              )) *
            100
          const memoryUsage =
            (parseFloat(m['memory']) /
              parseFloat(
                node
                  .select(`circle[data-label=${esc(m['name'])}]`)
                  .attr('data-limit-memory')
              )) *
            100
          const pick = cpuUsage > memoryUsage ? cpuUsage : memoryUsage
          node
            .select(`circle[data-label=${esc(m['name'])}]`)
            .attr('data-cpu', `${cpuUsage}`)
          node
            .select(`circle[data-label=${esc(m['name'])}]`)
            .attr('data-memory', `${memoryUsage}`)
            .attr(
              'fill',
              (kubernetesStatusColor(pick / 100) as unknown) as string
            )
        }
      } else if (m['type'] === 'PV') {
        if (
          _.find(
            node.select(`path[data-type=${'PV'}]`).data(),
            (pvData: any) => pvData.data.label === m['name']
          )
        ) {
          const iopsValue = m['iops'] || 0
          const bandwidthValue = m['bandwidth'] || 0
          const latencyValue = m['latency'] || 0

          const iopsUsage = (iopsValue / 100000) * 100
          const bandwidthUsage = (bandwidthValue / 700000) * 100

          const pick = iopsUsage > bandwidthUsage ? iopsUsage : bandwidthUsage
          const fillColor = (kubernetesStatusColor(
            pick / 100
          ) as unknown) as string

          node
            .select(`path[data-label=${esc(m['name'])}]`)
            .attr('data-iops', `${iopsValue}`)
            .attr('data-bandwidth', `${bandwidthValue}`)
            .attr('data-latency', `${latencyValue}`)
            .attr('fill', fillColor)

          // Color mapped PVCs that reference this PV (via data-volume-name)
          node
            .selectAll(`path[data-type=${'PVC'}]`)
            .filter(function () {
              return d3.select(this).attr('data-volume-name') === m['name']
            })
            .attr('fill', fillColor)
        }
      } else {
        if (
          _.find(
            node.select(`path[data-type=${'Pod'}]`).data(),
            (podData: any) => podData.data.label === m['name']
          )
        ) {
          const cpuUsage =
            (parseFloat(m['cpu']) /
              parseFloat(
                node
                  .select(`path[data-label=${esc(m['name'])}]`)
                  .attr('data-limit-cpu')
              )) *
            100
          const memoryUsage =
            (parseFloat(m['memory']) /
              parseFloat(
                node
                  .select(`path[data-label=${esc(m['name'])}]`)
                  .attr('data-limit-memory')
              )) *
            100

          const pick = cpuUsage > memoryUsage ? cpuUsage : memoryUsage
          node
            .select(`path[data-label=${esc(m['name'])}]`)
            .attr('data-cpu', `${cpuUsage}`)
          node
            .select(`path[data-label=${esc(m['name'])}]`)
            .attr('data-memory', `${memoryUsage}`)
            .attr(
              'fill',
              (kubernetesStatusColor(pick / 100) as unknown) as string
            )
        }
      }
    })

    const autoBox = () => {
      const svgNode = svg.node() as SVGSVGElement
      this.ref.current!.appendChild(svgNode)
      const {x, y, width, height} = svgNode.getBBox()
      this.ref.current!.removeChild(svgNode)
      return [x, y, width, height]
    }

    const svgNode = svg.attr('viewBox', `${autoBox()}`).node() as SVGSVGElement
    return this.ref.current!.appendChild(svgNode)
  }

  private handlePersistentVolumeSelection = (data: any) => {
    if (data.data && data.data.type === 'PV') {
      this.props.dispatch(setSelectedPersistentVolume([data.data.label]))
    } else {
      this.props.dispatch(setSelectedPersistentVolume(null))
    }
  }

  private runOnSingleClick = (data: any) => {
    this.handlePersistentVolumeSelection(data)
    this.props.handleOnClickVisualizePod(data)
    this.clickedOnce = false
    this.clickedTarget = null
  }

  private runOnDBClick = (data: any) => {
    // this.handlePersistentVolumeSelection(data)
    this.clickedOnce = false
    this.clickedTarget = null
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
    this.onMouseDBClick(data)
  }

  private onMouseClick = (target: any, data: D3K8sData) => {
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
    // this.handlePersistentVolumeSelection(data)
    this.props.handleDBClick(data)
    // this.props.handleOnClickVisualizePod(data)
  }

  private onMouseOver = (target: any) => {
    this.props.handleOpenTooltip(target)
    d3.select(target).classed('kubernetes-hover', true)
  }

  private onMouseLeave = (target: any) => {
    this.props.handleCloseTooltip()
    d3.select(target).classed('kubernetes-hover', false)
  }
}

const mstp = () => ({})
const mdtp = (dispatch: any) => ({dispatch})

export default connect(mstp, mdtp)(KubernetesHexagon)
