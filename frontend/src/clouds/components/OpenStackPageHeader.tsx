// libraries
import React, {Component} from 'react'
import chroma from 'chroma-js'

// constents
import {DEFAULT_CELL_BG_COLOR} from 'src/dashboards/constants'

// error handler
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  cellName: string
  cellBackgroundColor: string
  cellTextColor: string
}

@ErrorHandling
class OpenStackPageHeader extends Component<Props> {
  public render() {
    return (
      <div
        className={
          'dash-graph--heading  dash-graph--heading-draggable openstacck-dash-graph--draggable'
        }
        style={{margin: 0, height: '40px', backgroundColor: '#292933'}}
      >
        {this.cellName}
        {this.props.children}
        {this.headingBar}
      </div>
    )
  }

  private get cellName(): JSX.Element {
    const {cellName, cellTextColor, cellBackgroundColor} = this.props

    let nameStyle = {}

    if (cellBackgroundColor !== DEFAULT_CELL_BG_COLOR) {
      nameStyle = {
        color: cellTextColor,
      }
    }

    return (
      <span className={'dash-graph--name'} style={nameStyle}>
        {cellName}
      </span>
    )
  }

  private get headingBar(): JSX.Element {
    const {cellBackgroundColor} = this.props

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

export default OpenStackPageHeader
