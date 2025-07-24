import React from 'react'
import {Dropdown} from 'src/shared/components/Dropdown'
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
import MatchingAliasDropdownWrapper from 'src/log_analysis/components/MatchingAliasDropdownWrapper'
import {orgNameToId} from '../utils/deviceMapping'

export const mappingTableColumns = (
  me: Me,
  setMappingInfo: (device: DeviceMeta) => void,
  deleteDevice: (hostName: string) => void,
  onChangeAlias: (
    value: string,
    rowData: DeviceMeta,
    rowIndex: number,
    key: string
  ) => void,
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
        className: 'w-10',
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
        className: 'w-10',
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
    key: 'vendor',
    name: 'Vendor',
    options: {
      thead: {
        className: 'w-15',
      },
    },
    render: (value, rowData, _, rowIndex) => (
      <div className={`${rowData.isDeletable ? 'isDeletable' : ''}`}>
        <input
          type="text"
          className="input-cte"
          value={value}
          onChange={e => {
            onChangeAlias(e.target.value, rowData, rowIndex, 'vendor')
          }}
        />
        {/* <MatchingAliasDropdownWrapper
          items={allTagValues?.[rowData.deviceType] || []}
          selectedItem={value}
          setSelectedItem={text => {
            onChangeAlias(text, rowData, rowIndex, 'vendor')
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
    render: (value, rowData, _, rowIndex) => (
      <div className={`flow-line ${rowData.isDeletable ? 'isDeletable' : ''}`}>
        <div className={'provider--arrow'}>
          <span />
          <div className="host">
            <MatchingAliasDropdownWrapper
              items={allTagValues?.[rowData.deviceType] || []}
              selectedItem={value}
              setSelectedItem={text => {
                onChangeAlias(text, rowData, rowIndex, 'aliasName')
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
              setMappingInfo({
                ...rowData,
                orgId: orgNameToId(e.text, organizations || []),
              })
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
