import React from 'react'
import {ColumnInfo} from 'src/types'

export const columns: ColumnInfo[] = [
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
          <a
            onClick={e => {
              e.stopPropagation()
            }}
          >
            {item}
          </a>
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
]

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
