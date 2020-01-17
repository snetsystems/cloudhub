// Libraries
import React, {PureComponent} from 'react'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
const GridLayout = WidthProvider(ReactGridLayout)

// Components
import GridLayoutLayer from 'src/addon/128t/components/GridLayoutLayer'

// table
import RouterTable from 'src/addon/128t/components/RouterTable'
import TopSourcesTable from 'src/addon/128t/components/TopSourcesTable'
import TopSessionsTable from 'src/addon/128t/components/TopSessionsTable'

// Utils
import {fastMap, fastReduce} from 'src/utils/fast'

// Constants
import {
  // TODO: get these const values dynamically
  STATUS_PAGE_ROW_COUNT,
  PAGE_HEADER_HEIGHT,
  PAGE_CONTAINER_MARGIN,
  LAYOUT_MARGIN,
} from 'src/shared/constants'

//type
import {Router, TopSource, TopSession, GridCell} from 'src/addon/128t/types'
// import {GridSource} from '../containers/SwanSdplexStatusPage'

interface Props {
  layout: {}
  focusedAssetId: string
  routersData: Router[]
  topSessionsData: TopSession[]
  topSourcesData: TopSource[]
  isLayoutMoveEnale: boolean
  onClickTableRow: (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedAssetId: string
  ) => () => void
  onPositionChange: (cells) => void
}

interface State {
  rowHeight: number
}

class GridLayoutRenderer extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      rowHeight: this.calculateRowHeight(),
    }
  }

  public render() {
    const {
      isLayoutMoveEnale,
      onClickTableRow,
      focusedAssetId,
      routersData,
      topSourcesData,
      topSessionsData,
      layout,
    } = this.props
    const {rowHeight} = this.state
    const cells = [
      {
        i: 'routers',
        x: 0,
        y: 0,
        w: 12,
        h: 3,
        sources: routersData,
        name: 'Routers',
      },
      {
        i: 'topSources',
        x: 0,
        y: 1,
        w: 5,
        h: 4,
        sources: topSourcesData,
        name: 'Top Sources',
      },
      {
        i: 'topSessions',
        x: 6,
        y: 1,
        w: 7,
        h: 4,
        sources: topSessionsData,
        name: 'Top Sessions',
      },
    ]

    console.log('routersData', routersData)
    console.log('cells', cells)
    return (
      <GridLayout
        layout={cells}
        cols={12}
        rowHeight={rowHeight}
        margin={[LAYOUT_MARGIN, LAYOUT_MARGIN]}
        containerPadding={[0, 0]}
        useCSSTransforms={false}
        onLayoutChange={this.handleLayoutChange}
        draggableHandle={'.grid-layout--draggable'}
        isDraggable={isLayoutMoveEnale}
        isResizable={isLayoutMoveEnale}
      >
        <div key="routers">
          <RouterTable
            routers={routersData}
            onClickTableRow={onClickTableRow}
            focusedAssetId={focusedAssetId}
          />
        </div>
        <div key="topSources">
          <TopSourcesTable topSources={topSourcesData} />
        </div>
        <div key="topSessions">
          <TopSessionsTable topSessions={topSessionsData} />
        </div>
      </GridLayout>
    )
  }

  // private handleLayoutChange = layout => {
  //   if (!this.props.onPositionChange) {
  //     return
  //   }

  //   let changed = false

  //   const newCells = this.props.cells.map(cell => {
  //     const l: {
  //       x: number
  //       y: number
  //       h: number
  //       w: number
  //       name: string
  //       sources: Router[] | TopSource[] | TopSession[]
  //     } = layout.find(
  //       (ly: GridCell<Router[] | TopSource[] | TopSession[]>) => ly.i === cell.i
  //     )

  //     if (
  //       cell.x !== l.x ||
  //       cell.y !== l.y ||
  //       cell.h !== l.h ||
  //       cell.w !== l.w
  //     ) {
  //       changed = true
  //     }

  //     const newLayout = {
  //       x: l.x,
  //       y: l.y,
  //       h: l.h,
  //       w: l.w,
  //     }

  //     return {
  //       ...cell,
  //       ...newLayout,
  //     }
  //   })
  //   if (changed) {
  //     this.props.onPositionChange(newCells)
  //   }
  // }

  private calculateRowHeight = () => {
    return (
      (window.innerHeight -
        STATUS_PAGE_ROW_COUNT * LAYOUT_MARGIN -
        PAGE_HEADER_HEIGHT -
        PAGE_CONTAINER_MARGIN -
        PAGE_CONTAINER_MARGIN) /
      STATUS_PAGE_ROW_COUNT
    )
  }
}

export default GridLayoutRenderer
