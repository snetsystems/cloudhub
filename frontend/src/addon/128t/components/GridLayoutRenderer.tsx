// Libraries
import React, {PureComponent, CSSProperties} from 'react'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
const GridLayout = WidthProvider(ReactGridLayout)

// Components
import RouterTable from 'src/addon/128t/components/RouterTable'
import TopSourcesTable from 'src/addon/128t/components/TopSourcesTable'
import TopSessionsTable from 'src/addon/128t/components/TopSessionsTable'
import RouterMaps from 'src/addon/128t/components/RouterMaps'

// Constants
import {
  STATUS_PAGE_ROW_COUNT,
  PAGE_HEADER_HEIGHT,
  PAGE_CONTAINER_MARGIN,
  LAYOUT_MARGIN,
} from 'src/shared/constants'

import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

//type
import {Router, TopSource, TopSession} from 'src/addon/128t/types'
import {cellLayoutInfo} from 'src/addon/128t/containers/SwanSdplexStatusPage'

interface Props {
  layout: cellLayoutInfo[]
  focusedAssetId: string
  routersData: Router[]
  topSessionsData: TopSession[]
  topSourcesData: TopSource[]
  isSwanSdplexStatus: boolean
  onClickTableRow: (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedAssetId: string
  ) => () => void
  onPositionChange: (cellsLayout: cellLayoutInfo[]) => void
}

interface State {
  rowHeight: number
}

class GridLayoutRenderer extends PureComponent<Props, State> {
  private cellBackgroundColor: string = DEFAULT_CELL_BG_COLOR
  private cellTextColor: string = DEFAULT_CELL_TEXT_COLOR

  constructor(props: Props) {
    super(props)

    this.state = {
      rowHeight: this.calculateRowHeight(),
    }
  }

  public render() {
    const {
      layout,
      isSwanSdplexStatus,
      onClickTableRow,
      focusedAssetId,
      routersData,
      topSourcesData,
      topSessionsData,
    } = this.props
    const {rowHeight} = this.state

    return (
      <GridLayout
        layout={layout}
        cols={12}
        rowHeight={rowHeight}
        margin={[LAYOUT_MARGIN, LAYOUT_MARGIN]}
        containerPadding={[0, 0]}
        useCSSTransforms={true}
        onLayoutChange={this.handleLayoutChange}
        draggableHandle={'.grid-layout--draggable'}
        isDraggable={isSwanSdplexStatus}
        isResizable={isSwanSdplexStatus}
      >
        <div key="routers" className="dash-graph" style={this.cellStyle}>
          <RouterTable
            routers={routersData}
            onClickTableRow={onClickTableRow}
            focusedAssetId={focusedAssetId}
            isEditable={isSwanSdplexStatus}
            cellTextColor={this.cellTextColor}
            cellBackgroundColor={this.cellBackgroundColor}
          />
        </div>
        <div key="googleMaps" className="dash-graph" style={this.cellStyle}>
          <RouterMaps
            isEditable={isSwanSdplexStatus}
            cellTextColor={this.cellTextColor}
            cellBackgroundColor={this.cellBackgroundColor}
          />
        </div>
        <div key="topSources" className="dash-graph" style={this.cellStyle}>
          <TopSourcesTable
            topSources={topSourcesData}
            isEditable={isSwanSdplexStatus}
            cellTextColor={this.cellTextColor}
            cellBackgroundColor={this.cellBackgroundColor}
          />
        </div>
        <div key="topSessions" className="dash-graph" style={this.cellStyle}>
          <TopSessionsTable
            topSessions={topSessionsData}
            isEditable={isSwanSdplexStatus}
            cellTextColor={this.cellTextColor}
            cellBackgroundColor={this.cellBackgroundColor}
          />
        </div>
      </GridLayout>
    )
  }

  private handleLayoutChange = (cellsLayout: cellLayoutInfo[]): void => {
    if (!this.props.onPositionChange) return
    let changed = false
    const newCellsLayout = this.props.layout.map(lo => {
      const l = cellsLayout.find(cellLayout => cellLayout.i === lo.i)

      if (lo.x !== l.x || lo.y !== l.y || lo.h !== l.h || lo.w !== l.w) {
        changed = true
      }

      const newLayout = {
        x: l.x,
        y: l.y,
        h: l.h,
        w: l.w,
      }

      return {
        ...lo,
        ...newLayout,
      }
    })

    if (changed) {
      this.props.onPositionChange(newCellsLayout)
    }
  }

  private get cellStyle(): CSSProperties {
    return {
      backgroundColor: this.cellBackgroundColor,
      borderColor: this.cellBackgroundColor,
    }
  }

  private calculateRowHeight = (): number => {
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
