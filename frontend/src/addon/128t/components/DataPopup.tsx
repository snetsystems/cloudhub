// Libraries
import React, {PureComponent, MouseEvent, CSSProperties, createRef} from 'react'

// Components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import OncueServiceTable from 'src/addon/128t/components/OncueServiceTable'
import ProtocolModulesTable from 'src/addon/128t/components/ProtocolModulesTable'
import DeviceConnectionsTable from 'src/addon/128t/components/DeviceConnectionsTable'
import ConnectionsTable from 'src/addon/128t/components/ConnectionsTable'

// Types
// import {FluxToolbarFunction} from 'src/types/flux'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  handleOnClick: () => void
  hanldeOnDismiss: () => void
  data: {name: string}
  popupPosition: {top: number; right: number}
}

interface State {
  bottomPosition: number | null
}

const MAX_HEIGHT = 400

@ErrorHandling
class DataPopup extends PureComponent<Props, State> {
  private tooltipRef = createRef<HTMLDivElement>()

  public constructor(props: Props) {
    super(props)
    this.state = {bottomPosition: null}
  }

  public componentDidMount() {}

  public render() {
    const {data} = this.props

    return (
      <>
        <div
          style={this.stylePosition}
          className={this.handleToolTipClassName}
          ref={this.tooltipRef}
          onBlur={this.props.hanldeOnDismiss}
        >
          <button className="data-popup-dismiss" onClick={this.handleDismiss} />{' '}
          <div className="data-popup-contents">
            <FancyScrollbar
              autoHeight={true}
              maxHeight={MAX_HEIGHT}
              autoHide={false}
            >
              <div className="datapopup-table--container">
                <div className="datapopup-table--section">
                  <div className="datapopup-table--section--full">
                    <OncueServiceTable />
                  </div>
                </div>
                <div className="datapopup-table--section">
                  <div className="datapopup-table--section--half">
                    <ProtocolModulesTable />
                  </div>
                  <div className="datapopup-table--section--half">
                    <DeviceConnectionsTable />
                  </div>
                </div>
                <div className="datapopup-table--section">
                  <div className="datapopup-table--section--full">
                    <ConnectionsTable />
                  </div>
                </div>
              </div>
            </FancyScrollbar>
          </div>
        </div>
      </>
    )
  }

  private get handleToolTipClassName() {
    return 'data-popup-item'
  }

  private get stylePosition(): CSSProperties {
    const {
      popupPosition: {top, right}
    } = this.props
    // const {bottomPosition} = this.state
    console.log('DataPopup stylePosition', this.props.popupPosition)
    const position = {
      top: `${top}px`,
      left: `${right}px`
    }
    return position
  }

  private handleDismiss = (e: MouseEvent<HTMLElement>) => {
    const {hanldeOnDismiss} = this.props

    hanldeOnDismiss()
    e.preventDefault()
    e.stopPropagation()
  }
}

export default DataPopup
