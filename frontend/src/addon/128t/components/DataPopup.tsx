// Libraries
import React, {PureComponent, MouseEvent, CSSProperties} from 'react'

// Components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import OncueServiceTable from 'src/addon/128t/components/OncueServiceTable'
import ProtocolModulesTable from 'src/addon/128t/components/ProtocolModulesTable'
import DeviceConnectionsTable from 'src/addon/128t/components/DeviceConnectionsTable'
import ConnectionsTable from 'src/addon/128t/components/ConnectionsTable'

// Type
import {OncueData} from 'src/addon/128t/types'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  hanldeOnDismiss: () => void
  handleOnClickProtocolModulesRow: (name: string) => void
  handleOnClickDeviceConnectionsRow: (url: string) => void
  popupPosition: {top: number; right: number}
  oncueData: OncueData
  routerDataPopupAutoRefresh: number
  onChooseRouterDataPopupAutoRefresh: (milliseconds: number) => void
  onManualRouterDataPopupRefresh: () => void
}

@ErrorHandling
class DataPopup extends PureComponent<Props> {
  private MAX_HEIGHT = 500

  public constructor(props: Props) {
    super(props)
  }

  public render() {
    const {
      oncueData,
      routerDataPopupAutoRefresh,
      onChooseRouterDataPopupAutoRefresh,
      onManualRouterDataPopupRefresh,
    } = this.props

    window.addEventListener('keyup', event => {
      const escapeKeyCode = 27
      // fallback for browsers that don't support event.key
      if (event.key === 'Escape' || event.keyCode === escapeKeyCode) {
        this.props.hanldeOnDismiss()
      }
    })

    return (
      <div className="data-popup-container">
        <div style={this.stylePosition} className={this.handleToolTipClassName}>
          <button className="data-popup-dismiss" onClick={this.handleDismiss} />
          <div className="data-popup-contents">
            <FancyScrollbar
              autoHeight={true}
              maxHeight={this.MAX_HEIGHT}
              autoHide={false}
            >
              <div className="datapopup-table--container">
                <div className="datapopup-table--section">
                  <div className="datapopup-table--section--full">
                    <OncueServiceTable
                      oncueData={oncueData}
                      routerDataPopupAutoRefresh={routerDataPopupAutoRefresh}
                      onChooseRouterDataPopupAutoRefresh={
                        onChooseRouterDataPopupAutoRefresh
                      }
                      onManualRouterDataPopupRefresh={
                        onManualRouterDataPopupRefresh
                      }
                    />
                  </div>
                </div>
                <div className="datapopup-table--section">
                  <div className="datapopup-table--section--half width-50">
                    <ProtocolModulesTable
                      oncueData={oncueData}
                      onClickRow={this.props.handleOnClickProtocolModulesRow}
                    />
                  </div>
                  <div className="datapopup-table--section--half width-50">
                    <DeviceConnectionsTable
                      oncueData={oncueData}
                      onClickRow={this.props.handleOnClickDeviceConnectionsRow}
                    />
                  </div>
                </div>
                <div className="datapopup-table--section">
                  <div className="datapopup-table--section--full">
                    <ConnectionsTable oncueData={oncueData} />
                  </div>
                </div>
              </div>
            </FancyScrollbar>
          </div>
        </div>
      </div>
    )
  }

  private get handleToolTipClassName() {
    return 'data-popup-item'
  }

  private get stylePosition(): CSSProperties {
    const {
      popupPosition: {top, right},
    } = this.props

    const position = {
      top: `${top}px`,
      left: `${right}px`,
    }
    return position
  }

  private handleDismiss = (e: MouseEvent<HTMLElement>) => {
    this.props.hanldeOnDismiss()
    e.preventDefault()
    e.stopPropagation()
  }
}

export default DataPopup
