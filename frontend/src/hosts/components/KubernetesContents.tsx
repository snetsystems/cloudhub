// Library
import React, {PureComponent, createRef} from 'react'
import _ from 'lodash'
import * as d3 from 'd3'

// Component
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {ButtonShape, Radio} from 'src/reusable_ui'
import {TableBody, TableBodyRowItem} from 'src/addon/128t/reusable/layout'

import {KubernetesItem} from 'src/hosts/containers/KubernetesPage'
import KubernetesBasicsTable from 'src/hosts/components/KubernetesBasicsTable'
import KubernetesRawData from 'src/hosts/components/KubernetesRawData'
import KubernetesTooltip from 'src/hosts/components/KubernetesTooltip'

// Constants
import {HANDLE_VERTICAL} from 'src/shared/constants'
import {KUBERNETES_BASICS_TABLE_SIZE} from 'src/hosts/constants/tableSizing'
import chroma from 'chroma-js'

interface Props {
  handleOnSetActiveEditorTab: (tab: string) => void
  handleOnClickPodName: () => void
  handleOnClickVisualizePod: (target: string) => void
  handleResize: (proportions: number[]) => void
  handleOpenTooltip: (target: any) => void
  handleCloseTooltip: () => void
  proportions: number[]
  activeTab: string
  script: string
  height: number
  focuseNode: {}
  isToolipActive: boolean
  toolipPosition: {top: number; right: number; left: number}
  tooltipNode: {name: string; cpu: number; memory: number}
  kubernetesItem: KubernetesItem
  kubernetesRelationItem: string[]
}

interface State {}

class KubernetesContents extends PureComponent<Props, State> {
  private myRef = createRef<HTMLDivElement>()
  private containerStyles = {
    width: '100%',
    height: '100%',
    backgroundColor: '#292933',
  }

  private kubernetesStatusColor = chroma
    .scale(['#30e7f1', '#00cc2c', '#ff9e00', '#ff0000'])
    .mode('lrgb')

  private clusterTypeColorset = {
    ClusterRoles: '#0033cc',
    CR: '#0033cc',
    ClusterRoleBindings: '#0033cc',
    CRB: '#0033cc',
    Namespace: '#7f7f7f',
    Service: '#0033cc',
    SVC: '#0033cc',
    Secrets: '#ffd966',
    SR: '#ffd966',
    ServiceAccounts: '#0033cc',
    SA: '#0033cc',
    ReplicaSet: '#e2f0d9',
    RS: '#e2f0d9',
    Deployment: '#ffd966',
    DP: '#ffd966',
    Node: '#2e75b6',
    Pod: '#2e75b6',
    Job: '#fed2d2',
    CronJob: '#fed2d2',
    CJ: '#0033cc',
    Ingress: '#0033cc',
    IGS: '#0033cc',
    ReplicationController: '#9dc3e6',
    RC: '#9dc3e6',
    Configmaps: '#0033cc',
    CM: '#0033cc',
    Roles: '#a27bb3',
    RL: '#a27bb3',
    RoleBindings: '#a27bb3',
    RB: '#a27bb3',
    DaemonSet: '#74b8ba',
    DS: '#74b8ba',
  }

  constructor(props: Props) {
    super(props)
    this.state = {
      toolipPosition: undefined,
    }
  }

  public componentDidUpdate(prevProps: Props) {
    if (
      this.props.kubernetesItem &&
      prevProps.kubernetesItem !== this.props.kubernetesItem
    ) {
      this.drawChart()
    }
  }

  public drawChart = () => {
    const _this = this
    const dimensions = _this.myRef.current.getBoundingClientRect()

    const data = d3
      .pack()
      .size([dimensions.width, dimensions.height])
      .padding(30)(
      d3
        .hierarchy(this.props.kubernetesItem)
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

    const node = svg
      .append('g')
      .attr('pointer-events', 'all')
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
      .filter(d => d.height !== 0)
      .append('circle')
      .attr('class', 'nodeWrapper')
      .attr('r', d => d.r)
      .attr('fill', d => _this.clusterTypeColorset[d.data.type])
      .attr('data-type', d => d.data.type)
      .attr('pointer-events', d => (d.children ? 'all' : 'none'))
      .on('click', function() {
        d3.select(this).attr(
          'stroke',
          chroma(
            _this.clusterTypeColorset[d3.select(this).attr('data-type')]
          ).darken(3)
        )
        d3.select(this).attr('stroke-width', '3px')
        d3.select(this).attr(
          'fill',
          chroma(
            _this.clusterTypeColorset[d3.select(this).attr('data-type')]
          ).darken()
        )
      })
      .on('mouseout', function() {
        d3.select(this).attr('stroke', null)
        d3.select(this).attr(
          'fill',
          _this.clusterTypeColorset[d3.select(this).attr('data-type')]
        )
      })
    node
      .filter(d => d.height === 0)
      .on('mouseleave', function() {
        const path = this.children[1]
        const target = d3.select(path)
        const cpu = target.attr('data-cpu')
        const memory = target.attr('data-memory')
        const pick = cpu > memory ? cpu : memory

        target.attr('fill', _this.kubernetesStatusColor(pick / 100))
      })
      .append('path')
      .attr('class', 'hexagon')
      .attr('d', d => generateHexagon(d.r + 8))
      .attr('stroke', 'black')
      .attr('fill', d =>
        d.children
          ? 'none'
          : (() => {
              const cpu = d.data.cpu
              const memory = d.data.memory
              const pick = cpu > memory ? cpu : memory

              return _this.kubernetesStatusColor(pick / 100)
            })()
      )
      .attr('data-cpu', d => d.data.cpu)
      .attr('data-memory', d => d.data.memory)
      .attr('data-name', d => d.data.name)
      .attr('id', d => 'Node' + d.data.name)
      .attr('data-relation', d => d.data?.relationNodes)
      .on('mouseover', function() {
        _this.props.handleOpenTooltip(this)

        d3.selectAll('.relation-focuse:not(.pined)').classed(
          'relation-focuse',
          false
        )

        d3.select(this).classed('relation-focuse', true)

        let relation = d3.select(this).attr('data-relation')
        if (relation) {
          _.map(relation.split(','), node => {
            d3.select(`#Node${node}`).classed('relation-focuse', true)
          })
        }
      })
      .on('mouseleave', function() {
        _this.props.handleCloseTooltip()
        const target = d3.select(this)

        const isPined = target.attr('class').match(/pined/g)

        if (isPined) {
          return
        }
        target.classed('relation-focuse', false)

        const relation = target.attr('data-relation')
        if (relation) {
          _.forEach(relation.split(','), node => {
            d3.select(`#Node${node}`).classed('relation-focuse', false)
            d3.select(`#Node${node}`).classed('pined', false)
          })
        }
      })
      .on('click', function() {
        _this.props.handleOnClickVisualizePod(d3.select(this).attr('data-name'))
      })
      .on('dblclick', function() {
        _this.tooglePinedTooltip(this)
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
      .text(d => d.data.name)

    const autoBox = () => {
      this.myRef.current.appendChild(svg.node())
      const {x, y, width, height} = svg.node().getBBox()
      this.myRef.current.removeChild(svg.node())
      return [x, y, width, height]
    }

    return this.myRef.current.append(svg.attr('viewBox', `${autoBox()}`).node())
  }

  private tooglePinedTooltip = target => {
    const pinTarget = d3.select(target)
    const beforePinTarget = d3.select('.pined')
    const isPined = !pinTarget.attr('class').match(/pined/g)
    const isBeforePined = !beforePinTarget.empty()

    if (isBeforePined) {
      beforePinTarget.classed('pined', false)
      beforePinTarget.classed('relation-focuse', false)

      const beforeRelation = beforePinTarget.attr('data-relation')
      if (beforeRelation) {
        _.forEach(beforeRelation.split(','), node => {
          d3.select(`#Node${node}`).classed('relation-focuse', false)
          d3.select(`#Node${node}`).classed('pined', false)
        })
      }
    }

    pinTarget.classed('pined', isPined)
    pinTarget.classed('relation-focuse', isPined)

    const relation = pinTarget.attr('data-relation')
    if (relation) {
      _.forEach(relation.split(','), node => {
        d3.select(`#Node${node}`).classed('relation-focuse', isPined)
        d3.select(`#Node${node}`).classed('pined', isPined)
      })
    }
  }

  public render() {
    return (
      <div style={{height: `calc(100% - ${this.props.height}px)`}}>
        <Threesizer
          orientation={HANDLE_VERTICAL}
          divisions={this.virticalDivisions}
          onResize={this.props.handleResize}
        />
      </div>
    )
  }

  private get virticalDivisions() {
    const {proportions} = this.props
    const [leftSize, rightSize] = proportions

    return [
      {
        handleDisplay: 'none',
        headerButtons: [],
        menuOptions: [],
        render: this.KubernetesVisualize,
        headerOrientation: HANDLE_VERTICAL,
        size: leftSize,
      },
      {
        name: 'Details',
        headerButtons: [],
        menuOptions: [],
        render: this.KubernetesInformation,
        headerOrientation: HANDLE_VERTICAL,
        size: rightSize,
      },
    ]
  }
  private KubernetesVisualize = () => {
    return (
      <FancyScrollbar>
        <div style={{width: '100%', height: '100%'}}>
          <div style={this.containerStyles} ref={this.myRef}></div>
          {this.tooltip}
        </div>
        <div> Charts Layout </div>
      </FancyScrollbar>
    )
  }

  private get tooltip() {
    if (this.props.isToolipActive) {
      return (
        <KubernetesTooltip
          tipPosition={this.props.toolipPosition}
          tooltipNode={this.props.tooltipNode}
          statusColor={this.kubernetesStatusColor}
        />
      )
    }
  }

  private KubernetesInformation = () => {
    const {
      handleOnSetActiveEditorTab,
      handleOnClickPodName,
      activeTab,
      script,
      focuseNode,
    } = this.props
    const {HeaderWidth, DataWidth} = KUBERNETES_BASICS_TABLE_SIZE

    return (
      <FancyScrollbar>
        <div className="kubernetes-detail-display">
          <TableBody>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: HeaderWidth}}
              >
                Pod
              </div>
              <TableBodyRowItem
                title={
                  <div className="pod-name" onClick={handleOnClickPodName}>
                    {focuseNode}
                  </div>
                }
                width={DataWidth}
                className={'align--start'}
              />
            </div>
          </TableBody>
          <div className={'kubernetes-radio-btn--container'}>
            <Radio shape={ButtonShape.StretchToFit}>
              <Radio.Button
                id="hostspage-tab-Basic"
                titleText="Basic"
                value="Basic"
                active={activeTab === 'Basic'}
                onClick={handleOnSetActiveEditorTab}
              >
                Basic
              </Radio.Button>
              <Radio.Button
                id="hostspage-tab-Detail"
                titleText="Detail"
                value="Detail"
                active={activeTab === 'Detail'}
                onClick={handleOnSetActiveEditorTab}
              >
                Raw Data
              </Radio.Button>
            </Radio>
          </div>
          {activeTab === 'Basic' ? (
            <KubernetesBasicsTable />
          ) : (
            <KubernetesRawData script={script} />
          )}
        </div>
      </FancyScrollbar>
    )
  }
}

export default KubernetesContents
