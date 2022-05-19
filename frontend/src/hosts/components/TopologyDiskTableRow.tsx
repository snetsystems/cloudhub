import React, {PureComponent} from 'react'

import {cspDisk} from 'src/hosts/types/cloud'
import {CLOUD_HOST_DISK_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

interface Props {
  rowData: cspDisk
}

class TopologyNetworkTableRow extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {
      rowData: {
        devicename,
        disksize,
        diskinterface,
        boot,
        autodelete,
        mode,
        type,
      },
    } = this.props
    const {
      DevicenameWidth,
      DisksizeWidth,
      InterfaceWidth,
      BootWidth,
      AutodeleteWidth,
      ModeWidth,
      TypeWidth,
    } = CLOUD_HOST_DISK_TABLE_SIZING

    return (
      <>
        <div className={`hosts-table--tr`}>
          <div className="hosts-table--td" style={{width: DevicenameWidth}}>
            {devicename}
          </div>
          <div className="hosts-table--td" style={{width: DisksizeWidth}}>
            {disksize}
          </div>
          <div
            className="monotype hosts-table--td"
            style={{width: InterfaceWidth}}
          >
            {diskinterface}
          </div>
          <div className="monotype hosts-table--td" style={{width: BootWidth}}>
            {boot}
          </div>
          <div
            className="monotype hosts-table--td"
            style={{width: AutodeleteWidth}}
          >
            {autodelete}
          </div>
          <div className="monotype hosts-table--td" style={{width: ModeWidth}}>
            {mode}
          </div>
          <div className="monotype hosts-table--td" style={{width: TypeWidth}}>
            {type}
          </div>
        </div>
      </>
    )
  }
}

export default TopologyNetworkTableRow
