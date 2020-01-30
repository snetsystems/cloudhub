// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'

// components
import GridLayoutSearchBar from 'src/addon/128t/components/GridLayoutSearchBar'
import {
  CellName,
  HeadingBar,
  PanelHeader,
  Panel,
  PanelBody,
} from 'src/addon/128t/reusable/layout'

// type
import {ErrorHandling} from 'src/shared/decorators/errors'

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
    const {isEditable, cellTextColor, cellBackgroundColor} = this.props
    return (
      <Panel>
        <PanelHeader isEditable={isEditable}>
          <CellName
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            value={[]}
            name={'Routers in Map'}
          />
          <HeadingBar
            isEditable={isEditable}
            cellBackgroundColor={cellBackgroundColor}
          />
          <GridLayoutSearchBar
            placeholder="Filter by Ip..."
            onSearch={this.updateSearchTerm}
          />
        </PanelHeader>
        <PanelBody>{this.mapData}</PanelBody>
      </Panel>
    )
  }

  private get mapData() {
    return (
      <>
        <div>mapSource</div>
      </>
    )
  }

  private updateSearchTerm = (searchTerm: string): void => {
    this.setState({searchTerm})
  }
}

export default RouterMaps
