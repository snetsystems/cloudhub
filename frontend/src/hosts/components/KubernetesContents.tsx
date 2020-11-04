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

interface Props {
  handleOnSetActiveEditorTab: (tab: string) => void
  handleOnClickPodName: () => void
  handleResize: (proportions: number[]) => void
  proportions: number[]
  activeTab: string
  script: string
  height: number
}

const dummyData = require('src/hosts/containers/flare-2.json')

class KubernetesContents extends PureComponent<Props> {
  private myRef = createRef<HTMLDivElement>()

  private containerStyles = {
    width: '100%',
    height: '100%',
    backgroundColor: '#292933',
  }

  constructor(props: Props) {
    super(props)
  }

  public componentDidMount() {
    this.drawChart()
  }

  public drawChart() {
    const dimensions = this.myRef.current.getBoundingClientRect()
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
      .attr('stroke', 'black')
      .attr('fill', d => (d.children ? 'white' : 'black'))
      .attr('pointer-events', d => (d.children ? 'all' : 'none'))
      .on('click', function() {
        d3.select(this).attr('fill', 'red')
      })
      .on('mouseout', function() {
        d3.select(this).attr('fill', 'white')
      })
    node
      .filter(d => d.height === 0)
      .append('path')
      .attr('class', 'hexagon')
      .attr('d', d => generateHexagon(d.r + 8))
      .attr('stroke', 'black')
      .attr('fill', d => (d.children ? 'none' : 'white'))
      .on('click', function() {
        d3.select(this).attr('fill', 'red')
      })
      .on('mouseout', function() {
        console.log('node mouseout')
        d3.select(this).attr('fill', 'white')
      })
    node
      .filter(d => d.height !== 0)
      .append('text')
      .attr('fill', d => (d.height == 2 ? 'white' : 'black'))
      .append('textPath')
      .attr('xlink:href', d => '#' + d.data.name)
      .attr('startOffset', '50%')
      .attr('font-size', d => (d.height == 2 ? '15px' : '12px'))
      .text(d => d.data.name)
    //document.querySelector('.hexagon').
    const autoBox = () => {
      this.myRef.current.appendChild(svg.node())
      const {x, y, width, height} = svg.node().getBBox()
      this.myRef.current.removeChild(svg.node())
      return [x, y, width, height]
    }
    return this.myRef.current.append(svg.attr('viewBox', `${autoBox()}`).node())
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
