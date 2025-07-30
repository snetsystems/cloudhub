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
import {orgNameToId} from '../utils/deviceMapping'
import {
  VM_LEVEL_DROPDOWN_ITEMS,
  BAREMETAL_VENDOR_DROPDOWN_ITEMS,
} from 'src/shared/constants/venders'
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
    key: 'deviceType',
    name: 'DeviceType',
    options: {
      thead: {
        className: 'w-10',
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
        className: 'w-10',
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
    key: 'vendor',
    name: 'Vendor',
    options: {
      thead: {
        className: 'w-15',
      },
    },
    render: (value, rowData) => (
      <div className={`${rowData.isDeletable ? 'isDeletable' : ''}`}>
        <InputDropdownWrapper
          items={[
            ...VM_LEVEL_DROPDOWN_ITEMS,
            ...BAREMETAL_VENDOR_DROPDOWN_ITEMS,
          ]}
          selectedItem={value}
          setSelectedItem={text => {
            onChangeAlias(text, rowData, 'vendor')
          }}
          onChange={text => {
            const value = text
            onChangeAlias(value, rowData, 'vendor')
          }}
          placeholder={'Input Vendor'}
        />
        {/* <MatchingAliasDropdownWrapper
          items={[
            ...VM_LEVEL_DROPDOWN_ITEMS,
            ...BAREMETAL_VENDOR_DROPDOWN_ITEMS,
          ]}
          selectedItem={value}
          setSelectedItem={text => {
            onChangeAlias(text, rowData, 'vendor')
          }}
        /> */}
      </div>
    ),
  },
  {
    key: 'aliasName',
    name: 'Target',
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
          <div className="mapping-table-host">
            <InputDropdownWrapper
              items={allTagValues?.[rowData.deviceType] || []}
              selectedItem={value}
              setSelectedItem={text => {
                onChangeAlias(text, rowData, 'aliasName')
              }}
              className="dropdown-stretch"
              onChange={text => {
                const value = text
                onChangeAlias(value, rowData, 'aliasName')
              }}
              placeholder={rowData.hostname}
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
              setMappingInfo({
                ...rowData,
                orgId: orgNameToId(e.text, organizations || []),
              })
            }} // change tenant
            selected={org[0]?.name ?? value ?? ''}
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
