import React from 'react'

// Components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import TableComponent from 'src/device_management/components/TableComponent'

// Constants
import {deviceApplyMonitoringColumn} from 'src/device_management/constants/deviceManagementColumn'
import {
  MONITORING_MODAL_INFO,
  SYSTEM_MODAL,
} from 'src/device_management/constants'

// Type
import {MonitoringModalProps} from 'src/types'

interface Props {
  data: MonitoringModalProps[]
  type: typeof SYSTEM_MODAL[keyof typeof SYSTEM_MODAL]
}

function SystemConfirmModal({data, type}: Props) {
  const scrollMaxHeight = window.innerHeight * 0.4

  const message = (type: string) => {
    switch (type) {
      case SYSTEM_MODAL.LEARNING:
        return MONITORING_MODAL_INFO.learningMessage

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
      <FancyScrollbar
        autoHeight={true}
        maxHeight={scrollMaxHeight}
        children={
          <TableComponent
            data={data}
            tableTitle={'Device List'}
            columns={deviceApplyMonitoringColumn}
            isSearchDisplay={false}
          />
        }
      ></FancyScrollbar>
      {message(type)}
    </div>
  )
}

export default SystemConfirmModal
