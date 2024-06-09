import React from 'react'
import {ColumnInfo} from 'src/types'

export const predictionColumn: ColumnInfo[] = [
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
    key: 'algorithm',
    name: 'Algorithm',
    options: {
      sorting: true,
    },
  },
  {
    key: 'epsilon',
    name: 'epsilon',
    options: {
      sorting: true,
    },
  },
  {
    key: 'learning_state',
    name: 'State',
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
