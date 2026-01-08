import React from 'react'
import {Dropdown} from 'src/shared/components/Dropdown'
import {AlignType, ColumnInfo, DeviceMeta, Organization} from 'src/types'
import _ from 'lodash'
import ConfirmButton from 'src/shared/components/ConfirmButton'

export const newDeviceTableColumns = (
  organizations?: Organization[],
  onChangeInput?: (target: string, value: string) => void,
  setNewDevice?: (newDevice: DeviceMeta[]) => void,
  saveDevice?: () => void
): ColumnInfo[] => [
  {
    key: 'hostname',
    name: 'Hostname',
    options: {
      thead: {
        className: 'w-18',
      },
    },
    render: value => (
      <input
        type="text"
        className="input-cte"
        value={value}
        placeholder={'Host name'}
        onChange={e => {
          onChangeInput?.('hostname', e.target.value)
        }}
      />
    ),
  },
  {
    key: 'deviceType',
    name: 'DeviceType',
    options: {
      thead: {
        className: 'w-15',
      },
    },
    render: value => (
      <input
        type="text"
        className="input-cte"
        value={value}
        placeholder={'Device type'}
        onChange={e => {
          onChangeInput?.('deviceType', e.target.value)
        }}
      />
    ),
  },
  {
    key: 'ip',
    name: 'IP',
    options: {
      thead: {
        className: 'w-15',
      },
    },
    render: value => (
      <input
        type="text"
        className="input-cte"
        value={value}
        placeholder={'IP'}
        onChange={e => {
          onChangeInput?.('ip', e.target.value)
        }}
      />
    ),
  },
  {
    key: 'aliasName',
    name: 'Matching Alias',
    options: {
      thead: {
        className: 'w-30',
        align: AlignType.CENTER,
      },
    },
    render: value => (
      <div className={`flow-line`}>
        <div className={'provider--arrow'}>
          <span />
          <div className="mapping-table-host">
            <input
              type="text"
              className="input-cte"
              value={value}
              placeholder={'Matching Alias'}
              onChange={e => {
                onChangeInput?.('aliasName', e.target.value)
              }}
            />
          </div>
        </div>
      </div>
    ),
  },

  {
    key: 'orgId',
    name: 'Organization',
    render: value => (
      <div className={`agent-select--button-box`}>
        <Dropdown
          items={organizations?.map(org => ({text: org.name})) || []}
          onChoose={e => {
            onChangeInput('orgId', e.text)
          }} // change tenant
          selected={value}
          className="dropdown-stretch"
        />
      </div>
    ),
  },
  {
    key: '_',
    name: '',
    options: {
      thead: {
        className: 'w-5',
      },
    },
    render: () => (
      <div className="mapping-table-center">
        <div className="save-button">
          <ConfirmButton
            confirmAction={() => saveDevice()}
            confirmText="Save Device"
            size="btn-sm"
            square={true}
            icon="checkmark"
          />
        </div>
        <div className="delete-button">
          <ConfirmButton
            confirmAction={() => setNewDevice([])}
            confirmText="Delete Device"
            size="btn-sm"
            square={true}
            icon="trash"
          />
        </div>
      </div>
    ),
  },
]
