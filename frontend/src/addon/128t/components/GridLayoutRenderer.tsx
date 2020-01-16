// Libraries
import React, {PureComponent} from 'react'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
const GridLayout = WidthProvider(ReactGridLayout)

// Components
import GridLayoutLayer from 'src/addon/128t/components/GridLayoutLayer'

// Utils
import {fastMap} from 'src/utils/fast'

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

interface Props {
  focusedAssetId: string
  isLayoutMoveEnale: boolean
  onPositionChange: (
    cells: GridCell<Router[] | TopSource[] | TopSession[]>[]
  ) => void
  onClickTableRow: (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedAssetId: string
  ) => () => void
  cells: GridCell<Router[] | TopSource[] | TopSession[]>[]
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
      cells,
      isLayoutMoveEnale,
      onClickTableRow,
      focusedAssetId,
    } = this.props
    const {rowHeight} = this.state

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
        {fastMap(cells, cell => (
          <div key={cell.i}>
            <GridLayoutLayer
              key={cell.i}
              cell={cell}
              isEditable={isLayoutMoveEnale}
              onClickTableRow={onClickTableRow}
              focusedAssetId={focusedAssetId}
            />
          </div>
        ))}
      </GridLayout>
    )
  }

  private handleLayoutChange = layout => {
    if (!this.props.onPositionChange) {
      return
    }

    let changed = false

    const newCells = this.props.cells.map(cell => {
      const l = layout.find(ly => ly.i === cell.i)

      if (
        cell.x !== l.x ||
        cell.y !== l.y ||
        cell.h !== l.h ||
        cell.w !== l.w
      ) {
        changed = true
      }

      const newLayout = {
        x: l.x,
        y: l.y,
        h: l.h,
        w: l.w,
      }

      return {
        ...cell,
        ...newLayout,
      }
    })
    if (changed) {
      this.props.onPositionChange(newCells)
    }
  }

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
