import React from 'react'
import TableComponent from 'src/device_management/components/TableComponent'
import {newDeviceTableColumns} from '../constants/newDviceTableColumns'
import {DeviceMeta, NotificationAction, Organization} from 'src/types'
import {createDeviceMapping} from '../apis/deviceMapping'
import {
  notifyCreateDeviceFailed,
  notifyCreateDeviceSucceeded,
} from 'src/shared/copy/notifications'

export const NewDeviceTable = ({
  newDevice,
  setNewDevice,
  organizations,
  getDeviceList,
  notify,
}: {
  newDevice: DeviceMeta[]
  setNewDevice: (newDevice: DeviceMeta[]) => void
  organizations: Organization[]
  getDeviceList: () => Promise<void>
  notify?: NotificationAction
}) => {
  const onChangeInput = (target: string, value: string) => {
    const device = newDevice[0]
    device[target] = value
    setNewDevice([device])
  }

  const saveDevice = async () => {
    try {
      await createDeviceMapping(newDevice[0], organizations)
      notify(notifyCreateDeviceSucceeded())
    } catch (error) {
      notify(notifyCreateDeviceFailed(error.data.message ?? ''))
      throw new Error(error.data.message ?? '')
    }

    getDeviceList()
    setNewDevice([])
  }

  return (
    <div className="panel-body">
      <TableComponent
        tableTitle="New Device"
        columns={newDeviceTableColumns(
          organizations || [],
          onChangeInput,
          setNewDevice,
          saveDevice
        )}
        data={newDevice}
        isSearchDisplay={false}
        bodyClassName={`mapping-table`}
      />
    </div>
  )
}
