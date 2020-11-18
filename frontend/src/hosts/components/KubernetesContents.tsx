// Library
import React, {PureComponent, createRef} from 'react'
import * as d3 from 'd3'

// Component
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {ButtonShape, Radio} from 'src/reusable_ui'
import {TableBody, TableBodyRowItem} from 'src/addon/128t/reusable/layout'

import KubernetesBasicsTable from 'src/hosts/components/KubernetesBasicsTable'
import KubernetesRawData from 'src/hosts/components/KubernetesRawData'

// Constants
import {HANDLE_VERTICAL} from 'src/shared/constants'
import {KUBERNETES_BASICS_TABLE_SIZE} from 'src/hosts/constants/tableSizing'
import chroma from 'chroma-js'

interface Props {
  handleOnSetActiveEditorTab: (tab: string) => void
  handleOnClickPodName: () => void
  handleResize: (proportions: number[]) => void
  proportions: number[]
  activeTab: string
  script: string
  height: number
}

interface State {
  toolipIsActive: boolean
  toolipPosition: {top: number; right: number}
}

const dummyData = require('src/hosts/containers/flare-2.json')
class KubernetesContents extends PureComponent<Props, State> {
  private myRef = createRef<HTMLDivElement>()
  private containerStyles = {
    width: '100%',
    height: '100%',
    backgroundColor: '#292933',
  }

  private customChroma = chroma
    .scale(['#30e7f1', '#00cc2c', '#ff9e00', '#ff0000'])
    .mode('lrgb')

  private clusterTypeColorset = {
    namespace: '#7f7f7f',
    job: '#fed2d2',
    cronJob: '#fed2d2',
    node: '#2e75b6',
    replicaSet: '#e2f0d9',
    replicaControll: '#9dc3e6',
    statefullSet: '#a27bb3',
    deployment: '#ffd966',
    daemonSet: '#74b8ba',
    statusDead: '#7f7f7f',
    service: '#0033cc',
    ingress: '#0033cc',
  }

  constructor(props: Props) {
    super(props)
    this.state = {
      toolipIsActive: false,
      toolipPosition: undefined,
    }
  }

  public componentDidMount() {
    this.drawChart()
  }

  public drawChart = () => {
    const _this = this
    const dimensions = _this.myRef.current.getBoundingClientRect()

    const data = d3
      .pack()
      .size([dimensions.width, dimensions.height])
      .padding(30)(
      d3
        .hierarchy(dummyData)
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

    const glow = svg
      .append('defs')
      .append('filter')
      .attr('id', 'glow')
      .attr('width', '200%')
      .attr('height', '200%')
      .attr('x', '-50%')
      .attr('y', '-50%')

    glow
      .append('feGaussianBlur')
      .attr('stdDeviation', '10')
      .attr('result', 'coloredBlur')

    const glowMerge = glow.append('feMerge')
    glowMerge.append('feMergeNode').attr('in', 'coloredBlur')
    glowMerge.append('feMergeNode').attr('in', 'SourceGraphic')

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
        const cpu = target.attr('data-testCPU')
        const memory = target.attr('data-testMemory')
        const pick = cpu > memory ? cpu : memory

        target.attr('fill', _this.customChroma(pick / 100))
      })
      .append('path')
      .attr('class', 'hexagon')
      .attr('d', d => generateHexagon(d.r + 8))
      .attr('stroke', 'black')
      .attr('fill', d =>
        d.children
          ? 'none'
          : (() => {
              const cpu = d.data.testCPU
              const memory = d.data.testMemory
              const pick = cpu > memory ? cpu : memory

              return _this.customChroma(pick / 100)
            })()
      )
      .attr('data-testCPU', d => d.data.testCPU)
      .attr('data-testMemory', d => d.data.testMemory)
      .attr('data-name', d => d.data.name)
      .on('click', function() {
        _this.onClickNode(this)
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

  private getParent = target => {
    let currentParent = target.parentNode

    while (currentParent) {
      if (currentParent.parentNode.tagName === 'svg') {
        break
      } else {
        currentParent = currentParent.parentNode
      }
    }

    return currentParent.parentNode
  }

  private onClickNode = (target: HTMLElement) => {
    const _this = this
    const targetPosition = target.parentElement
      .getAttribute('transform')
      .match(/(\d+\.\d+|\d+)/g)
    const [tagetPositionX, targetPositionY] = targetPosition
    const containerG = this.getParent(target)

    d3.select('svg')
      .selectAll('path')
      .style('filter', null)

    d3.select(target).style('filter', 'url("#glow")')
    d3.select(containerG)
      .select('foreignObject')
      .remove()
    d3
      .select(containerG)
      .append('foreignObject')
      .attr('x', function() {
        let x = parseFloat(tagetPositionX)

        return x + 16
      })
      .attr('y', function() {
        var y = parseInt(targetPositionY)

        return y - 18.5
      })
      .attr('width', 235)
      .attr('height', 76)
      .attr('overflow', 'visible').html(`
        <div class="flux-functions-toolbar--tooltip" style="transform: translateY(0px); width: 100%;">
          <div class="flux-functions-toolbar--tooltip-contents" style="flex-direction: column; align-items: unset; padding: 5px">
            <button class="flux-functions-toolbar--tooltip-dismiss tooltip-dismiss"></button>
            <div>
              <button class="button button-sm button-default button-square tooltip-pin" title="Pin" tabindex="0" style="height: 20px; width: 20px; line-height: 16px;">
                <span class="button-icon icon pin" style="font-size: 10px;"></span>
              </button>
            </div>
            <div class="hosts-table--tbody">
              <div class="hosts-table--tr">
                <div class="hosts-table--th align--start" style="width: 40%; font-size: 10px; padding: 4px 2px">CPU</div>
                <div class="hosts-table--td align--start" style="width: 60%; white-space: unset; padding: 0 0; font-size: 10px;">
                  <div class="UsageIndacator-container">
                    <div class="UsageIndacator-value" >${d3
                      .select(target)
                      .attr('data-testCPU')} %</div>
                  <div class="UsageIndacator" style="background: ${_this.customChroma(
                    d3.select(target).attr('data-testCPU') / 100
                  )}"></div>
                </div>
                </div>
              </div>
              <div class="hosts-table--tr">
                <div class="hosts-table--th align--start" style="width: 40%; font-size: 10px; padding: 4px 2px" >MEMORY</div>
                <div class="hosts-table--td align--start" style="width: 60%; white-space: unset; padding: 0 0; font-size: 10px;">
                <div class="UsageIndacator-container">
                  <div class="UsageIndacator-value">${d3
                    .select(target)
                    .attr('data-testMemory')} %</div>
                  <div class="UsageIndacator" style="background: ${_this.customChroma(
                    d3.select(target).attr('data-testMemory') / 100
                  )}"></div>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    `)

    d3.select('.tooltip-dismiss').on('click', function() {
      d3.select('foreignObject').remove()
      d3.select(target).style('filter', null)
      d3.select('path.focuse:not(.pin)').classed('focuse', false)
      _this.onDismissTooltip()
    })

    d3.select('.tooltip-pin').on('click', function() {
      _this.onPinToolip()
    })
  }

  // private onMouseoutNode = () => {
  //   this.onDismissTooltip()
  // }

  // private onOpenTooltip = () => {
  //   this.setState({toolipIsActive: true})
  // }

  private onDismissTooltip = () => {
    console.log('dismiss tooltip')
  }

  private onPinToolip = () => {
    console.log('pin tooltip')
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
        </div>
        <div> Charts Layout </div>
      </FancyScrollbar>
    )
  }

  private KubernetesInformation = () => {
    const {
      handleOnSetActiveEditorTab,
      handleOnClickPodName,
      activeTab,
      script,
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
                    {`kubernetes-dashboard-78fcd5ddd-4j4s4`}
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
