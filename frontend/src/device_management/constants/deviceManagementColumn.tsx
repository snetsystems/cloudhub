import React from 'react'
import {ColumnInfo, DeviceData, ShellInfo} from 'src/types'

interface Props {
  onEditClick: (deviceData: DeviceData) => void
  onConsoleClick: (shell: ShellInfo) => void
}
export const columns = ({onEditClick, onConsoleClick}: Props): ColumnInfo[] => {
  return [
    {key: 'id', name: '', options: {checkbox: true}},
    {
      key: 'organization',
      name: 'Organization',
      options: {
        sorting: true,
      },
    },
    {
      key: 'device_ip',
      name: 'Device Ip',
      options: {
        sorting: true,
      },
      render: item => {
        return (
          <div>
            <span>{item}</span>
          </div>
        )
      },
    },
    {
      key: 'hostname',
      name: 'Hostname',
      options: {
        sorting: true,
      },
    },
    {
      key: 'device_type',
      name: 'Device Type',
      options: {
        sorting: true,
      },
    },
    {
      key: 'device_os',
      name: 'Device OS',
      options: {
        sorting: true,
      },
    },

    {
      key: 'device_id',
      name: 'Device Id',
      options: {
        isAccordion: true,
      },
    },
    {
      key: 'device_id',
      name: 'Device Id',
      options: {
        sorting: true,
      },
    },
    {
      key: 'device_type',
      name: 'Monitorting',
      options: {
        sorting: true,
      },
    },
    {
      key: 'device_os',
      name: 'Modeling',
      options: {
        sorting: true,
      },
    },
    {
      key: 'device_id',
      name: 'Algorithm',
      options: {
        sorting: true,
      },
    },
    {
      key: 'id',
      name: 'Edit',
      options: {
        sorting: true,
      },
      render: (_, rowData) => {
        return (
          <button
            className={`btn btn-default btn-xs btn-square`}
            onClick={e => {
              e.stopPropagation()
              onEditClick(rowData)
            }}
          >
            <span className={`icon pencil`} />
          </button>
        )
      },
    },
    {
      key: 'id',
      name: 'Console',
      options: {
        sorting: true,
      },
      render: (_, rowData: DeviceData) => (
        <button
          className="btn btn-sm btn-default icon bash agent-row--button-sm"
          title={'Open SSH Terminal'}
          onClick={e => {
            e.stopPropagation()
            onConsoleClick({
              isNewEditor: false,
              addr: rowData.device_ip,
            })
          }}
        ></button>
      ),
    },
  ]
}
export const IMPORT_FILE_DEVICE_STATUS_COLUMNS: ColumnInfo[] = [
  {
    key: 'index',
    name: 'Index',
    options: {
      sorting: true,
    },
  },
  {
    key: 'ip',
    name: 'IP',
    options: {
      sorting: true,
    },
  },
  {
    key: 'status',
    name: 'Status',
    options: {
      sorting: true,
    },
    render: value => {
      return (
        <div
          className={`${
            value === 'OK'
              ? 'device-management-import--success'
              : 'device-management-import--fail'
          }`}
        >
          {value}
        </div>
      )
    },
  },
  {
    key: 'message',
    name: 'Message',
    options: {
      sorting: true,
    },
    render: value => {
      return (
        <div
          className={`${
            value === 'Success'
              ? 'device-management-import--success'
              : 'device-management-import--fail'
          }`}
        >
          {value}
        </div>
      )
    },
  },
]
