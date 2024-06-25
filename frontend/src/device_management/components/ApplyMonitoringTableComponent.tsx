import React, {useEffect} from 'react'
import TableComponent from './TableComponent'
import {deviceApplyMonitoringColumn} from '../constants/deviceManagementColumn'
import {ApplyMonitoringProps} from 'src/types'
import {MONITORING_MODAL_INFO} from '../constants'

interface Props {
  value: ApplyMonitoringProps[]
  setValue: (value: ApplyMonitoringProps[]) => void
}

//toggle btn issue
const ApplyMonitoringTableComponent = ({value, setValue}: Props) => {
  const updateValidArray = (isCreateLearning: boolean, rowIndex: number) => {
    const newAry = value

    newAry[rowIndex] = {
      ...newAry[rowIndex],
      ...{isCreateLearning: !isCreateLearning},
    }

    setValue(newAry)
  }

  return (
    <div className="device-modal--childNode">
      <TableComponent
        data={value}
        tableTitle="Apply Monitoring List"
        columns={deviceApplyMonitoringColumn}
        isSearchDisplay={false}
        bodyClassName="device-management-modal-body"
        options={{
          tbodyRow: {onClick: item => console.log('row click: ', item)},
        }}
      />
      {MONITORING_MODAL_INFO.returnMessage}
    </div>
  )
}

export default ApplyMonitoringTableComponent
