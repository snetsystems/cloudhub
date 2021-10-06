import React, {PureComponent} from 'react'
import {
  CLOUD_HOST_SECURITY_TABLE_SIZING,
  CLOUD_HOST_STORAGE_TABLE_SIZING,
} from '../constants/tableSizing'

interface Props {
  rowData: any
}

class TopologyStorageTableRow extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }
  public render() {
    const {
      rowData: {
        volumeId,
        deviceName,
        volumeSize,
        attachmentStatus,
        attachmentTime,
        encrypted,
        deleteOnTermination,
      },
    } = this.props

    const {
      VolumeIdWidth,
      DeviceNameWidth,
      VolumeSizeWidth,
      VolumeStatusWidth,
      AttachTimeWidth,
      EncryptedWidth,
      DelOnTermWidth,
    } = CLOUD_HOST_STORAGE_TABLE_SIZING
    console.log('props: ', this.props.rowData)

    return (
      <>
        <div className={`hosts-table--tr`}>
          <div className="hosts-table--td" style={{width: VolumeIdWidth}}>
            {volumeId}
          </div>
          <div className="hosts-table--td" style={{width: DeviceNameWidth}}>
            {deviceName}
          </div>
          <div
            className="monotype hosts-table--td"
            style={{width: VolumeSizeWidth}}
          >
            {volumeSize}
          </div>
          <div
            className="monotype hosts-table--td"
            style={{width: VolumeStatusWidth}}
          >
            {attachmentStatus}
          </div>
          <div
            className="monotype hosts-table--td"
            style={{width: AttachTimeWidth}}
          >
            {attachmentTime}
          </div>
          <div
            className="monotype hosts-table--td"
            style={{width: EncryptedWidth}}
          >
            {encrypted}
          </div>

          <div
            className="monotype hosts-table--td"
            style={{width: DelOnTermWidth}}
          >
            {deleteOnTermination}
          </div>
        </div>
      </>
    )
  }
}

export default TopologyStorageTableRow
