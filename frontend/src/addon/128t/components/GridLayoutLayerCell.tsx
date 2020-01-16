import React, {PureComponent, CSSProperties} from 'react'

// Component
import GridLayoutCellHeader from 'src/addon/128t/components/GridLayoutCellHeader'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

// type
import {Router, TopSource, TopSession, GridCell} from 'src/addon/128t/types'

interface Props {
  isEditable: boolean
  cell: GridCell<Router[] | TopSource[] | TopSession[]>
}
class GridLayoutLayerCell extends PureComponent<Props> {
  private cellBackgroundColor: string = DEFAULT_CELL_BG_COLOR
  private cellTextColor: string = DEFAULT_CELL_TEXT_COLOR

  constructor(props) {
    super(props)
  }

  public render() {
    const {isEditable, cell, children} = this.props
    return (
      <>
        <div className="dash-graph" style={this.cellStyle}>
          <GridLayoutCellHeader
            isEditable={isEditable}
            cellName={`${cell.sources.length} ${cell.name}`}
            cellBackgroundColor={this.cellBackgroundColor}
            cellTextColor={this.cellTextColor}
          />
          <div className="dash-graph--container">{children}</div>
        </div>
      </>
    )
  }

  private get cellStyle(): CSSProperties {
    return {
      backgroundColor: this.cellBackgroundColor,
      borderColor: this.cellBackgroundColor,
    }
  }
}

export default GridLayoutLayerCell
