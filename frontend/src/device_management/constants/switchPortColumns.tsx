import React from 'react'

import i18n from 'src/i18n'
import SeverityBadge from 'src/device_management/components/SeverityBadge'
import {
  PORT_LINK_LABEL,
  PortLinkStatus,
  portLinkSeverity,
} from 'src/device_management/constants/portLinkStatus'
import {formatSinceChange} from 'src/device_management/utils/switchPortRows'
import {formatDateTimeForDeviceData} from 'src/device_management/utils'
import {AlignType, ColumnInfo} from 'src/types'

/** A count that only draws attention when it is a fault. */
const countCell = (isFault = false) => (value: number) =>
  isFault && value > 0 ? (
    <SeverityBadge label={`${value}`} severity="fail" />
  ) : (
    <>{value ?? 0}</>
  )

/**
 * Percentages adding up to 100 across the columns that render, the same rule
 * as the optics cell, so the split holds at any cell width.
 */
export const switchPortDeviceColumns: ColumnInfo[] = [
  {
    key: 'sysName',
    name: 'Device',
    align: AlignType.LEFT,
    parentHeader: 'Device',
    options: {sorting: true, thead: {style: {width: '15%'}}},
  },
  {
    key: 'model',
    name: 'Model',
    align: AlignType.CENTER,
    parentHeader: 'Device',
    options: {sorting: true, thead: {style: {width: '9%'}}},
  },
  {
    key: 'ip',
    name: 'IP',
    align: AlignType.LEFT,
    parentHeader: 'Device',
    options: {sorting: true, isIP: true, thead: {style: {width: '9%'}}},
  },
  {
    key: 'location',
    name: 'Location',
    align: AlignType.LEFT,
    parentHeader: 'Device',
    options: {sorting: true, thead: {style: {width: '10%'}}},
  },
  {
    key: 'up',
    name: 'UP',
    align: AlignType.CENTER,
    parentHeader: 'Ports',
    options: {sorting: true, thead: {style: {width: '7%'}}},
    render: countCell(),
  },
  {
    key: 'down',
    name: 'DOWN',
    align: AlignType.CENTER,
    parentHeader: 'Ports',
    options: {sorting: true, thead: {style: {width: '7%'}}},
    render: countCell(true),
  },
  {
    key: 'longDown',
    name: 'LONG DOWN',
    align: AlignType.CENTER,
    parentHeader: 'Ports',
    options: {sorting: true, thead: {style: {width: '9%'}}},
    render: countCell(),
  },
  {
    key: 'shutdown',
    name: 'SHUTDOWN',
    align: AlignType.CENTER,
    parentHeader: 'Ports',
    options: {sorting: true, thead: {style: {width: '8%'}}},
    render: countCell(),
  },
  {
    key: 'unused',
    name: 'UNUSED',
    align: AlignType.CENTER,
    parentHeader: 'Ports',
    options: {sorting: true, thead: {style: {width: '7%'}}},
    render: countCell(),
  },
  {
    key: 'other',
    name: 'Other',
    align: AlignType.CENTER,
    parentHeader: 'Ports',
    options: {sorting: true, thead: {style: {width: '6%'}}},
    render: countCell(),
  },
  {
    key: 'checkedAt',
    name: 'Checked At',
    align: AlignType.CENTER,
    parentHeader: 'Ports',
    options: {sorting: true, thead: {style: {width: '13%'}}},
    render: (value, _row, _c, _r, timeZone) => (
      <>{value ? formatDateTimeForDeviceData(value, timeZone) : '-'}</>
    ),
  },
  {
    key: 'ports',
    name: 'Ports',
    align: AlignType.CENTER,
    parentHeader: 'Ports',
    // No width: TableBase drops the accordion column from the table it draws
    // and only reads this one for the key holding the nested rows.
    options: {isAccordion: true},
    render: value => <>{(value as unknown[])?.length ?? 0}</>,
  },
]

export const switchPortColumns: ColumnInfo[] = [
  {key: 'ifName', name: 'Port', align: AlignType.LEFT},
  {
    key: 'alias',
    name: 'Alias',
    align: AlignType.LEFT,
    render: value => (
      <div className="ellipsis-text" title={value || ''}>
        {value || '-'}
      </div>
    ),
  },
  {key: 'admin', name: 'Admin', align: AlignType.CENTER},
  {key: 'oper', name: 'Oper', align: AlignType.CENTER},
  {
    key: 'status',
    name: 'Status',
    align: AlignType.CENTER,
    render: value => {
      const status = value as PortLinkStatus
      const label = PORT_LINK_LABEL[status]
      return label ? (
        <SeverityBadge label={label} severity={portLinkSeverity(status)} />
      ) : (
        <>-</>
      )
    },
  },
  {
    key: 'sinceChangeTicks',
    name: 'Last Change',
    align: AlignType.CENTER,
    render: (value, row) =>
      row?.status === 'unused' ? (
        <>{i18n.t('switch_ports.since_boot')}</>
      ) : (
        <>{formatSinceChange(value as number | null)}</>
      ),
  },
]
