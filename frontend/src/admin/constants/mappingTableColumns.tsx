import React from 'react'
import {Dropdown} from 'src/shared/components/Dropdown'
import {AlignType, ColumnInfo, DeviceMeta, Me, Organization} from 'src/types'
import _ from 'lodash'
import ConfirmButton from 'src/shared/components/ConfirmButton'

export const mappingTableColumns = (
  me: Me,
  setMappingInfo: (
    hostName: string,
    org: string,
    aliasName: string,
    deviceType: string,
    ip: string
  ) => void,
  deleteDevice: (hostName: string) => void,
  onChangeAlias: (
    e: React.ChangeEvent<HTMLInputElement>,
    rowData: DeviceMeta,
    rowIndex: number
  ) => void,
  organizations?: Organization[]
): ColumnInfo[] => [
  {
    key: 'hostname',
    name: 'Hostname',
    options: {
      thead: {
        className: 'w-15',
      },
    },
    render: (value, rowData) => (
      <div
        className={`input-cte__disabled ${
          rowData.isDeletable ? 'isDeletable' : ''
        }`}
        title={value}
      >
        {value}
      </div>
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
    render: (value, rowData) => (
      <div
        className={`input-cte__disabled ${
          rowData.isDeletable ? 'isDeletable' : ''
        }`}
        title={value}
      >
        {value}
      </div>
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
    render: (value, rowData) => (
      <div
        className={`input-cte__disabled ${
          rowData.isDeletable ? 'isDeletable' : ''
        }`}
        title={value}
      >
        {value}
      </div>
    ),
  },

  {
    key: 'aliasName',
    name: 'Target',
    options: {
      thead: {
        className: 'w-35',
        align: AlignType.CENTER,
      },
    },
    render: (value, rowData, _, rowIndex) => (
      <div className={`flow-line ${rowData.isDeletable ? 'isDeletable' : ''}`}>
        <div className={'provider--arrow'}>
          <span />
          <div className="host">
            <input
              type="text"
              className="input-cte"
              value={value}
              placeholder={rowData.hostname}
              onChange={e => {
                onChangeAlias(e, rowData, rowIndex)
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
    render: (value, rowData) => {
      const org =
        organizations?.map(org => {
          if (org.id === value) {
            return org
          }
        }) || []

      return (
        <div
          className={`agent-select--button-box ${
            rowData.isDeletable ? 'isDeletable' : ''
          }`}
        >
          <Dropdown
            items={organizations?.map(org => ({text: org.name})) || []}
            onChoose={e => {
              setMappingInfo(
                rowData.hostname,
                e.text, // org
                rowData.aliasName, // aliasName
                rowData.deviceType,
                rowData.ip
              )
            }} // change tenant
            selected={org[0]?.name ?? value}
            className="dropdown-stretch"
            disabled={!me.superAdmin}
          />
        </div>
      )
    },
  },
  {
    key: 'isDeletable',
    name: 'Delete',
    options: {
      thead: {
        className: 'w-5',
      },
    },
    render: (value, rowData) => (
      <div className="mapping-table-center">
        <div className="delete-button">
          {value ? (
            <ConfirmButton
              confirmAction={() => deleteDevice(rowData.hostname)}
              confirmText="Delete Device"
              size="btn-sm"
              square={true}
              icon="trash"
            />
          ) : null}
        </div>
      </div>
    ),
  },
]
