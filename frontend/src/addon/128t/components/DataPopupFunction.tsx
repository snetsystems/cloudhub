// Libraries
import React, {PureComponent, createRef} from 'react'

// Component
import DataPopup from 'src/addon/128t/components/DataPopup'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  handleOnClick: () => void
  handleOnMouseLeave: () => void
  hanldeOnDismiss: () => void
  data: {name: string}
  popupPosition: {top: number; right: number}
}

interface State {
  isActive: boolean
  clickPosition: {top: number; right: number}
}

@ErrorHandling
class DataPopupFunction extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {data} = this.props
    return (
      <div className="data-popup-container">
        <DataPopup
          data={this.props.data}
          hanldeOnDismiss={this.props.hanldeOnDismiss}
          popupPosition={this.props.popupPosition}
        />
      </div>
    )
  }
}

export default DataPopupFunction
