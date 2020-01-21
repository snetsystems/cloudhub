// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import classnames from 'classnames'
import chroma from 'chroma-js'

// components
import GridLayoutSearchBar from 'src/addon/128t/components/GridLayoutSearchBar'

// type
import {ErrorHandling} from 'src/shared/decorators/errors'

import {DEFAULT_CELL_BG_COLOR} from 'src/dashboards/constants'

export interface Props {
  isEditable: boolean
  cellBackgroundColor: string
  cellTextColor: string
}

interface State {}

@ErrorHandling
class RouterMaps extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {}
  }

  public render() {
    return (
      <div className={`panel`}>
        <div className="panel-heading">
          <div className={this.headingClass}>
            {this.cellName}
            {this.headingBar}
            <GridLayoutSearchBar
              placeholder="Filter by Ip..."
              onSearch={this.updateSearchTerm}
            />
          </div>
        </div>
        <div className="panel-body">{this.mapData}</div>
      </div>
    )
  }

  private get mapData() {
    return (
      <>
        <div>mapSource</div>
      </>
    )
  }

  private get headingClass(): string {
    const {isEditable} = this.props
    return classnames('dash-graph--heading', {
      'dash-graph--draggable dash-graph--heading-draggable': isEditable,
      'dash-graph--heading-draggable': isEditable,
    })
  }

  private get cellName(): JSX.Element {
    const {cellTextColor, cellBackgroundColor} = this.props

    let nameStyle = {}

    if (cellBackgroundColor !== DEFAULT_CELL_BG_COLOR) {
      nameStyle = {
        color: cellTextColor,
      }
    }

    return (
      <h2
        className={`dash-graph--name grid-layout--draggable`}
        style={nameStyle}
      >
        Routers in Map
      </h2>
    )
  }

  private get headingBar(): JSX.Element {
    const {isEditable, cellBackgroundColor} = this.props

    if (isEditable) {
      let barStyle = {}

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

  public updateSearchTerm = (searchTerm: string): void => {
    this.setState({searchTerm})
  }
}

export default RouterMaps
