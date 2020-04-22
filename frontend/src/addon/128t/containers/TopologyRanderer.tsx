// Libraries
import React, {PureComponent} from 'react'
import {Graph} from 'react-d3-graph'

// Error Handler
import {ErrorHandling} from 'src/shared/decorators/errors'

//type
import {Router} from 'src/addon/128t/types'

interface Props {
  routersData: Router[]
}

interface State {
  nodeData: {nodes: object[]; links: object[]}
}

const fakeDataCoord = {
  nodes: [
    {id: 'node1', x: 10, y: 10},
    {id: 'node2', x: 20, y: 50},
    {id: 'node3', x: 30, y: 100},
    {id: 'node4', x: 300, y: 200},
    {id: 'node5', x: 100, y: 30},
    {id: 'node6', x: 120, y: 70},
    {id: 'node7', x: 250, y: 180},
    {id: 'node8', x: 140, y: 220},
  ],
  links: [
    {source: 'node1', target: 'node2'},
    {source: 'node1', target: 'node3'},
    {source: 'node6', target: 'node8'},
  ],
}

const config = {
  width: 800,
  nodeHighlightBehavior: true,
  staticGraphWithDragAndDrop: true,
  directed: true,
  node: {
    color: 'lightblue',
    size: 350,
    fontSize: 16,
    highlightFontSize: 16,
    highlightStrokeColor: 'blue',
    labelProperty: 'label',
  },
  link: {
    highlightColor: 'blue',
  },
  d3: {
    alphaTarget: 0.05,
    gravity: -400,
    linkLength: 180,
    linkStrength: 1,
    disableLinkForce: true,
  },
}

const containerStyles = {
  width: '100%',
  height: '100hv',
  backgroundColor: '#eee',
}

@ErrorHandling
class TopologyRanderer extends PureComponent<Props, State> {
  private useRef = React.createRef<HTMLDivElement>()
  constructor(props: Props) {
    super(props)
    this.state = {
      nodeData: {
        nodes: [
          {
            id: 'root',
            x: 357.4541964470222,
            y: 30.856071089519045,
            svg:
              'http://marvel-force-chart.surge.sh/marvel_force_chart_img/marvel.png',
          },
          {id: 'node1', x: 88.21984684535903, y: 301.08500827029377},
          {id: 'node2', x: 188.77240578709893, y: 301.08500827029377},
          {id: 'node3', x: 275.7182913434341, y: 301.08500827029377},
          {id: 'node4', x: 359.73334757198757, y: 301.08500827029377},
          {id: 'node5', x: 442.61764962262214, y: 301.08500827029377},
          {id: 'node6', x: 525.5133033012221, y: 301.08500827029377},
          {id: 'node7', x: 649.3008262733337, y: 352.2624284985469},
        ],
        links: [
          {source: 'root', target: 'node1'},
          {source: 'root', target: 'node2'},
          {source: 'root', target: 'node3'},
          {source: 'root', target: 'node4'},
          {source: 'root', target: 'node5'},
          {source: 'root', target: 'node6'},
          {source: 'root', target: 'node7'},
          {source: 'node7', target: 'root'},
        ],
      },
    }
  }

  public onNodePositionChange = function(nodeId, x, y) {
    console.log(`Node ${nodeId} moved to new position x= ${x} y= ${y}`)
  }

  public componentWillMount() {}

  public componentDidMount() {
    // console.log(this.props.routersData)
    // const {nodes} = this.state
    // const node = this.props.routersData.map(m => {
    //   return {id: m.assetId}
    // })
    // //this.setState({nodes: node})
    // console.log(nodes)
  }

  public render() {
    const {nodeData} = this.state

    return (
      <div style={containerStyles} ref={this.useRef}>
        <Graph
          id="graph-id"
          data={nodeData}
          config={config}
          onNodePositionChange={this.onNodePositionChange}
        />
      </div>
    )
  }
}

export default TopologyRanderer
