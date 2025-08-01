import React from 'react'
import Dropdown from 'src/shared/components/Dropdown'
import {
  AlignType,
  ColumnInfo,
  DeviceMeta,
  DropdownItem,
  Me,
  Organization,
} from 'src/types'
import _ from 'lodash'
import ConfirmButton from 'src/shared/components/ConfirmButton'
import {orgIdToName, orgNameToId} from '../utils/deviceMapping'
import InputDropdownWrapper from 'src/shared/components/InputDropdownWrapper'
export const mappingTableColumns = (
  me: Me,
  setMappingInfo: (device: DeviceMeta) => void,
  deleteDevice: (hostName: string) => void,
  onChangeAlias: (value: string, rowData: DeviceMeta, key: string) => void,
  organizations?: Organization[],
  allTagValues?: {
    [deviceType: string]: DropdownItem[]
  }
): ColumnInfo[] => [
  {
    key: 'hostname',
    name: 'Hostname',
    options: {
      thead: {
        className: 'w-18',
      },
    },
    render: (value, rowData) => (
      <div
        className={`${rowData.isDeletable ? 'isDeletable' : ''}`}
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
        className={`${rowData.isDeletable ? 'isDeletable' : ''}`}
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
        className={`${rowData.isDeletable ? 'isDeletable' : ''}`}
        title={value}
      >
        {value}
      </div>
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
    render: (value, rowData) => (
      <div className={`flow-line ${rowData.isDeletable ? 'isDeletable' : ''}`}>
        <div className={'provider--arrow'}>
          <span />
          <div title={value} className="mapping-table-host">
            <InputDropdownWrapper
              items={allTagValues?.[rowData.deviceType] || []}
              selectedItem={value}
              setSelectedItem={text => {
                if (text !== value) {
                  onChangeAlias(text, rowData, 'aliasName')
                }
              }}
              className="dropdown-stretch"
              onChange={text => {
                if (text !== value) {
                  onChangeAlias(text, rowData, 'aliasName')
                }
              }}
              placeholder={rowData.hostname}
              disabled={!me.superAdmin || rowData.isDeletable}
              autofocus={false}
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
      const org = organizations?.filter(org => org.id === value) || []

      return (
        <div
          className={`agent-select--button-box ${
            rowData.isDeletable ? 'isDeletable' : ''
          }`}
          title={orgIdToName(value, organizations || [])}
        >
          <Dropdown
            items={organizations?.map(org => ({text: org.name})) || []}
            onChoose={e => {
              setMappingInfo({
                ...rowData,
                orgId: orgNameToId(e.text, organizations || []),
              })
            }} // change tenant
            selected={
              org[0]?.name ?? orgIdToName(value, organizations || []) ?? ''
            }
            className="dropdown-stretch"
            disabled={!me.superAdmin}
          />
        </div>
      )
    },
  },
  {
    key: 'isDeletable',
    name: '',
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
