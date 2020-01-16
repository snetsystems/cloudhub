// Libraries
import React, {PureComponent} from 'react'
import classnames from 'classnames'
import chroma from 'chroma-js'

// Error Handler
import {ErrorHandling} from 'src/shared/decorators/errors'

// constants
import {DEFAULT_CELL_BG_COLOR} from 'src/dashboards/constants'

interface Props {
  isEditable: boolean
  cellName: string
  cellBackgroundColor: string
  cellTextColor: string
}

@ErrorHandling
class GridLayoutCellHeader extends PureComponent<Props> {
  public render() {
    return (
      <div className={this.headingClass}>
        {this.cellName}
        {this.headingBar}
      </div>
    )
  }

  private get headingClass() {
    const {isEditable} = this.props
    return classnames('dash-graph--heading', {
      'dash-graph--draggable dash-graph--heading-draggable grid-layout--draggable': isEditable,
      'dash-graph--heading-draggable': isEditable,
    })
  }

  private get cellName(): JSX.Element {
    const {cellName, cellTextColor, cellBackgroundColor} = this.props

    const className = classnames('dash-graph--name', {
      'dash-graph--name__default': false,
      'dash-graph--name__note': false,
    })

    let nameStyle = {}

    if (cellBackgroundColor !== DEFAULT_CELL_BG_COLOR) {
      nameStyle = {
        color: cellTextColor,
      }
    }

    return (
      <span className={className} style={nameStyle}>
        {cellName}
      </span>
    )
  }

  private get headingBar(): JSX.Element {
    const {isEditable, cellBackgroundColor} = this.props

    if (isEditable) {
      let barStyle

      if (cellBackgroundColor !== DEFAULT_CELL_BG_COLOR) {
        barStyle = {
          backgroundColor: chroma(cellBackgroundColor).brighten(),
        }
      }

      return (
        <>
          <div className="dash-graph--heading-bar" style={barStyle} />
          <div className="dash-graph--heading-dragger" />
        </>
      )
    }
  }
}

export default GridLayoutCellHeader
