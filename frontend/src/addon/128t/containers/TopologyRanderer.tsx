// Libraries
import React, {PureComponent} from 'react'
import {Graph} from 'react-d3-graph'
import _ from 'lodash'

// Error Handler
import {ErrorHandling} from 'src/shared/decorators/errors'

//type
import {Router} from 'src/addon/128t/types'

interface GraphNodeData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface GraphNode {
  id: string
  name?: string
  label?: string
  x?: number
  y?: number
  size?: number
  svg?: string
  labelPosition?: string
}

interface GraphLink {
  source: string
  target: string
}

interface Props {
  routersData: Router[]
}

interface State {
  nodeData: GraphNodeData
}

@ErrorHandling
class TopologyRanderer extends PureComponent<Props, State> {
  private useRef = React.createRef<HTMLDivElement>()

  private imgTopNodeUrl = require('src/addon/128t/components/assets/topology-cloudhub.svg')
  private imgConductorUrl = require('src/addon/128t/components/assets/conductor.png')
  private imgNodeUrl = require('src/addon/128t/components/assets/topology-router.svg')

  private defaultMargin = {left: 100, right: 100, top: 100, bottom: 300}
  private config = {
    width: 0,
    height: 0,
    nodeHighlightBehavior: true,
    staticGraphWithDragAndDrop: true,
    directed: true,
    node: {
      color: '#f58220',
      fontColor: '#fff',
      size: 350,
      fontSize: 16,
      fontWeight: 'normal',
      highlightFontSize: 16,
      highlightStrokeColor: 'blue',
      labelProperty: 'label',
      symbolType: 'circle',
      labelPosition: 'bottom',
    },
    link: {
      highlightColor: '#f58220',
    },
    d3: {
      alphaTarget: 0.05,
      gravity: -400,
      linkLength: 300,
      linkStrength: 1,
      disableLinkForce: true,
    },
  }
  private containerStyles = {
    width: '100%',
    height: '100%',
    backgroundColor: '#292933',
  }

  constructor(props: Props) {
    super(props)
    this.state = {
      nodeData: {
        nodes: [
          {
            id: 'root',
            label: 'CloudHub',
            svg: this.imgTopNodeUrl,
            size: 600,
            labelPosition: 'top',
          },
        ],
        links: null,
      },
    }
  }

  public onNodePositionChange = (
    nodeId: string,
    x: number,
    y: number
  ): void => {
    const {nodeData} = this.state
    const beforeNodeData = nodeData

    // console.log(`Node ${nodeId} moved to new position x= ${x} y= ${y}`)

    beforeNodeData.nodes = beforeNodeData.nodes.map(m =>
      m.id === nodeId ? {...m, x: x, y: y} : m
    )

    this.setState({
      nodeData: {
        nodes: nodeData.nodes.map(m =>
          m.id === nodeId ? {...m, x: x, y: y} : m
        ),
        links: nodeData.links,
      },
    })
  }

  public componentWillMount() {
    const nodeData: GraphNodeData = {
      nodes: this.props.routersData.map(m => {
        if (m.role === 'conductor') {
          return {id: m.assetId, label: m.assetId, svg: this.imgConductorUrl}
        } else {
          return {id: m.assetId, label: m.assetId, svg: this.imgNodeUrl}
        }
      }),
      links: this.props.routersData.map(m => {
        return {source: 'root', target: m.assetId}
      }),
    }

    this.setState({
      nodeData: {
        nodes: this.state.nodeData.nodes.concat(nodeData.nodes),
        links: nodeData.links,
      },
    })
  }

  private getXCoordinate(index: number) {
    const dimensions = this.useRef.current.getBoundingClientRect()

    const widthGap =
      (dimensions.width -
        (this.defaultMargin.left + this.defaultMargin.right)) /
      this.state.nodeData.nodes.length

    return this.defaultMargin.left + widthGap * index
  }

  public componentDidMount() {
    console.log('componentDidMount', this.state.nodeData)

    const {nodeData} = this.state

    const dimensions = this.useRef.current.getBoundingClientRect()

    this.config.width = dimensions.width
    this.config.height = dimensions.height

    // this.setState({
    //   nodeData: {
    //     nodes: nodeData.nodes.map((m, index) =>
    //       m.id === 'root'
    //         ? {...m, x: dimensions.width / 2, y: this.defaultMargin.top}
    //         : {
    //             ...m,
    //             x: this.getXCoordinate(index),
    //             y: dimensions.height - this.defaultMargin.bottom,
    //           }
    //     ),
    //     links: nodeData.links,
    //   },
    // })

    this.setState({
      nodeData: {
        nodes: nodeData.nodes.map((m, index) =>
          m.id === 'root'
            ? {...m, x: dimensions.width / 2, y: this.defaultMargin.top}
            : {
                ...m,
                x: this.getXCoordinate(index),
                y: dimensions.height - this.defaultMargin.bottom,
              }
        ),
        links: nodeData.links,
      },
    })

    // const dimensions = this.useRef.current.getBoundingClientRect()

    // config.width = dimensions.width
    // config.height = dimensions.height

    // const width =
    //   (dimensions.width - (defaultMargin.left + defaultMargin.right)) / 6

    // const data: GraphNodeData = {
    //   nodes: [
    //     {
    //       id: 'root',
    //       x: dimensions.width / 2,
    //       y: 100,
    //       svg:
    //         'http://marvel-force-chart.surge.sh/marvel_force_chart_img/marvel.png',
    //     },
    //     {id: 'node1', x: 100, y: dimensions.height - 300},
    //     {id: 'node2', x: 100 + width, y: dimensions.height - 300},
    //     {id: 'node3', x: 100 + width * 2, y: dimensions.height - 300},
    //     {id: 'node4', x: 100 + width * 3, y: dimensions.height - 300},
    //     {id: 'node5', x: 100 + width * 4, y: dimensions.height - 300},
    //     {id: 'node6', x: 100 + width * 5, y: dimensions.height - 300},
    //     {id: 'node7', x: 100 + width * 6, y: dimensions.height - 300},
    //   ],
    //   links: [
    //     {source: 'root', target: 'node1'},
    //     {source: 'root', target: 'node2'},
    //     {source: 'root', target: 'node3'},
    //     {source: 'root', target: 'node4'},
    //     {source: 'root', target: 'node5'},
    //     {source: 'root', target: 'node6'},
    //     {source: 'root', target: 'node7'},
    //     {source: 'node7', target: 'root'},
    //   ],
    // }

    // this.setState({nodeData: data})
  }

  public render() {
    const {nodeData} = this.state

    return (
      <div style={this.containerStyles} ref={this.useRef}>
        {this.state.nodeData.nodes[0].x > 0 ? (
          <Graph
            id="graph-id"
            data={nodeData}
            config={this.config}
            onNodePositionChange={this.onNodePositionChange}
          />
        ) : (
          <></>
        )}
      </div>
    )
  }
}

export default TopologyRanderer
