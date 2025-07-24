import React from 'react'
import TableComponent from 'src/device_management/components/TableComponent'
import {newDeviceTableColumns} from '../constants/newDviceTableColumns'
import {DeviceMeta, Organization} from 'src/types'
import {createDeviceMapping} from '../apis/deviceMapping'

export const NewDeviceTable = ({
  newDevice,
  setNewDevice,
  organizations,
  getDeviceList,
}: {
  newDevice: DeviceMeta[]
  setNewDevice: (newDevice: DeviceMeta[]) => void
  organizations: Organization[]
  getDeviceList: () => void
}) => {
  const onChangeInput = (target: string, value: string) => {
    const device = newDevice[0]
    device[target] = value
    setNewDevice([device])
  }

  const saveDevice = async () => {
    await createDeviceMapping(newDevice[0], organizations)
      .then(() => {
        setNewDevice([])
      })
      .catch(err => {
        console.log('saveDevice err', err)
      })

    await getDeviceList()
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
