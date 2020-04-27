// Libraries
import React, {PureComponent} from 'react'
import {Graph} from 'react-d3-graph'
import _ from 'lodash'

// Components
import {
  Table,
  TableBody,
  TableBodyRowItem,
  usageIndacator,
} from 'src/addon/128t/reusable/layout'
import {fixedDecimalPercentage} from 'src/shared/utils/decimalPlaces'

// constants
import {TOPOLOGY_TABLE_SIZING} from 'src/addon/128t/constants'

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
    directed: false,
    node: {
      color: '#f58220',
      fontColor: '#fff',
      size: 2000,
      fontSize: 16,
      fontWeight: 'normal',
      highlightFontSize: 16,
      highlightStrokeColor: 'blue',
      renderLabel: false,
      symbolType: 'circle',
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

  private initNodes = [
    {
      id: 'root',
      label: 'CloudHub',
      svg: this.imgTopNodeUrl,
      size: 600,
      labelPosition: 'top',
    },
  ]

  private TOPOLOGY_ROLE = {
    COUNDUCTOR: 'conductor',
    ROOT: 'root',
  }

  constructor(props: Props) {
    super(props)
    this.state = {
      nodeData: {
        nodes: this.initNodes,
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

    const nodes = nodeData.nodes.map(m =>
      m.id === nodeId ? {...m, x: x, y: y} : m
    )

    this.setState({
      nodeData: {
        ...nodeData,
        nodes,
      },
    })
  }

  public componentWillMount() {
    const {routersData} = this.props
    const nodes = routersData.map(m =>
      m.role === this.TOPOLOGY_ROLE.COUNDUCTOR
        ? {id: m.assetId, label: m.assetId, svg: this.imgConductorUrl}
        : {
            id: m.assetId,
            label: m.assetId,
            svg: this.imgNodeUrl,
          }
    )

    const links = routersData.map(m => ({
      source: this.TOPOLOGY_ROLE.ROOT,
      target: m.assetId,
    }))

    const nodeData: GraphNodeData = {
      nodes,
      links,
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

  private generateCustomNode = ({node}) => {
    const {routersData} = this.props
    const routerData = _.find(routersData, r => r.assetId === node.id)
    const {assetId, cpuUsage, diskUsage, memoryUsage} = routerData
    const {TABLE_ROW_IN_HEADER, TABLE_ROW_IN_BODY} = TOPOLOGY_TABLE_SIZING

    return (
      <div className={'topology-table-container'}>
        <strong className={'hosts-table-title'}>{assetId}</strong>
        <Table>
          <TableBody>
            <>
              <div className={this.focusedClasses()}>
                <div
                  className={this.headerClasses()}
                  style={{width: TABLE_ROW_IN_HEADER}}
                >
                  cpu usage
                </div>
                <TableBodyRowItem
                  title={usageIndacator({
                    value: fixedDecimalPercentage(cpuUsage, 2),
                  })}
                  width={TABLE_ROW_IN_BODY}
                ></TableBodyRowItem>
              </div>
              <div className={this.focusedClasses()}>
                <div
                  className={this.headerClasses()}
                  style={{width: TABLE_ROW_IN_HEADER}}
                >
                  disk usage
                </div>
                <TableBodyRowItem
                  title={usageIndacator({
                    value: fixedDecimalPercentage(diskUsage, 2),
                  })}
                  width={TABLE_ROW_IN_BODY}
                ></TableBodyRowItem>
              </div>
              <div className={this.focusedClasses()}>
                <div
                  className={this.headerClasses()}
                  style={{width: TABLE_ROW_IN_HEADER}}
                >
                  memory usage
                </div>
                <TableBodyRowItem
                  title={usageIndacator({
                    value: fixedDecimalPercentage(memoryUsage, 2),
                  })}
                  width={TABLE_ROW_IN_BODY}
                ></TableBodyRowItem>
              </div>
            </>
          </TableBody>
        </Table>
      </div>
    )
  }

  public componentDidMount() {
    const {nodeData} = this.state
    const dimensions = this.useRef.current.getBoundingClientRect()
    const {width, height} = dimensions

    const nodes = nodeData.nodes.map((m, index) =>
      m.id === 'root'
        ? {...m, x: dimensions.width / 2, y: this.defaultMargin.top}
        : {
            ...m,
            x: this.getXCoordinate(index),
            y: dimensions.height - this.defaultMargin.bottom,
            viewGenerator: (node: GraphNode) => this.generateCustomNode({node}),
          }
    )

    this.config = {
      ...this.config,
      width,
      height,
    }

    this.setState({
      nodeData: {
        ...nodeData,
        nodes,
      },
    })
  }

  public render() {
    const {nodeData} = this.state

    return (
      <div style={this.containerStyles} ref={this.useRef}>
        {nodeData.nodes[0].x > 0 ? (
          <Graph
            id="swan-topology"
            data={nodeData}
            config={this.config}
            onNodePositionChange={this.onNodePositionChange}
          />
        ) : null}
      </div>
    )
  }

  private focusedClasses = (): string => {
    return 'hosts-table--tr'
  }

  private headerClasses = (): string => {
    return 'hosts-table--th'
  }
}

export default TopologyRanderer
