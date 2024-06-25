// Libraries
import React, {PureComponent} from 'react'

import {ErrorHandling} from 'src/shared/decorators/errors'
import TableComponent from 'src/device_management/components/TableComponent'
import {deviceconnectionColumn} from 'src/device_management/constants/deviceManagementColumn'
import {DeviceData} from 'src/types'

interface Props {
  deviceData: DeviceData
}

@ErrorHandling
export default class DeviceManagementCompletionStep extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {deviceData} = this.props

    return (
      <div className="device-management-connection--completion">
        <TableComponent
          data={[deviceData]}
          tableTitle="Device Information"
          columns={deviceconnectionColumn}
          isSearchDisplay={false}
        />
      </div>
    )
  }
}
