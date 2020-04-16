// Libraries
import React, {PureComponent} from 'react'

// Components
import {TableBodyRowItem} from 'src/addon/128t/reusable/layout'

// Constants
import {DEVICE_CONNECTIONS_TABLE_SIZING} from 'src/addon/128t/constants'

// Type
import {DeviceConnection} from 'src/addon/128t/types'

// Error Handler
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  url: DeviceConnection['url']
  focusedInDeviceConnection: DeviceConnection['url']
  onClickRow: (url: string) => void
}

@ErrorHandling
class DeviceConnectionsTableRow extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  render() {
    const {url, onClickRow, focusedInDeviceConnection} = this.props
    const {DEVICE_CONNECTIONS_URL} = DEVICE_CONNECTIONS_TABLE_SIZING

    return (
      <div
        className={this.focusedClasses(focusedInDeviceConnection)}
        onClick={() => onClickRow(url)}
      >
        <TableBodyRowItem
          title={url}
          width={DEVICE_CONNECTIONS_URL}
          className={'align--end'}
        />
      </div>
    )
  }

  private focusedClasses = (focusedInDeviceConnection): string => {
    const {url} = this.props
    if (url === focusedInDeviceConnection) return 'hosts-table--tr focused'
    return 'hosts-table--tr'
  }
}

export default DeviceConnectionsTableRow
