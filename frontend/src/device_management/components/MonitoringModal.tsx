import React from 'react'
import TableComponent from 'src/device_management/components/TableComponent'
import {deviceApplyMonitoringColumn} from 'src/device_management/constants/deviceManagementColumn'
import {ApplyMonitoringProps} from 'src/types'
import {
  MONITORING_MODAL_INFO,
  SYSTEM_MODAL,
} from 'src/device_management/constants'

interface Props {
  data: ApplyMonitoringProps[]
  type: typeof SYSTEM_MODAL[keyof typeof SYSTEM_MODAL]
}

function SystemConfirmModal({data, type}: Props) {
  const message = (type: string) => {
    switch (type) {
      case SYSTEM_MODAL.LEARNING:
        return MONITORING_MODAL_INFO.learningMessage

      case SYSTEM_MODAL.MONITORING:
        return MONITORING_MODAL_INFO.monitoringMessage

      case SYSTEM_MODAL.DELETE:
        return MONITORING_MODAL_INFO.deleteGeneralMessage

      case SYSTEM_MODAL.MONITORING_DELETE:
        return MONITORING_MODAL_INFO.deleteMonitoringMessage

      default:
        break
    }
  }

  return (
    <div className="device-modal--childNode">
      <TableComponent
        data={data}
        tableTitle={'Device List'}
        columns={deviceApplyMonitoringColumn}
        isSearchDisplay={false}
        bodyClassName="device-management-modal-body"
      />

      {message(type)}
    </div>
  )
}

export default SystemConfirmModal
