import React from 'react'

//Type
import {AlignType, ColumnInfo, DeviceData, ShellInfo, SortType} from 'src/types'

// Utils
import {
  formatDateTimeForDeviceData,
  formatMLKey,
} from 'src/device_management/utils'

interface Props {
  onEditClick: (deviceData: DeviceData) => void
  onConsoleClick: (shell: ShellInfo) => void
  isUserUnauthorized?: boolean
}

export const columns = ({
  onEditClick,
  onConsoleClick,
  isUserUnauthorized,
}: Props): ColumnInfo[] => {
  const columns: ColumnInfo[] = [
    {
      key: 'organization',
      name: 'Organization',
      align: AlignType.LEFT,
      options: {
        sorting: true,
      },
      render: item => {
        return (
          <div style={{textAlign: 'left'}}>
            <span>{item}</span>
          </div>
        )
      },
    },
    {
      key: 'device_ip',
      name: 'Device Ip',
      align: AlignType.LEFT,
      options: {
        sorting: true,
        isIP: true,
      },
      render: item => {
        return (
          <div style={{textAlign: 'left'}}>
            <span>{item}</span>
          </div>
        )
      },
    },
    {
      key: 'hostname',
      name: 'Hostname',
      align: AlignType.LEFT,
      options: {
        sorting: true,
      },
      render: item => {
        return (
          <div style={{textAlign: 'left'}}>
            <span>{item}</span>
          </div>
        )
      },
    },
    {
      key: 'device_type',
      name: 'Device Type',
      align: AlignType.CENTER,
      options: {
        sorting: true,
      },
    },
    {
      key: 'device_os',
      name: 'Device OS',
      align: AlignType.CENTER,
      options: {
        sorting: true,
      },
    },
    {
      key: 'isMonitoring',
      name: 'Monitoring',
      options: {
        sorting: true,
      },
      align: AlignType.CENTER,
      render: value => (
        <div
          className={`table-dot ${value ? 'dot-success' : ''} flex-center`}
        ></div>
      ),
    },
    {
      key: 'is_learning',
      name: 'Learning Enabled',
      align: AlignType.CENTER,
      render: value => (
        <div
          className={`device--indicator ${
            value ? 'indicator--primary' : ''
          } flex-center`}
        >
          {value ? 'Enabled' : 'Disabled'}
        </div>
      ),
    },
    {
      align: AlignType.CENTER,
      key: 'ml_function',
      name: 'ML Function',
      render: value => <div> {value ? formatMLKey(value) : '-'}</div>,
    },
    {
      key: 'learning_state',
      name: 'Learning State',
      align: AlignType.CENTER,
      render: value => <div> {value ? value : '-'}</div>,
    },
    {
      align: AlignType.CENTER,
      key: 'learning_update_datetime',
      name: 'Start Time',
      render: (value, _, __, ___, timeZone) => (
        <div
          className={`agent--indicator ${
            !!value ? 'indicator--primary' : 'indicator--fail'
          } `}
        >
          <div>
            {value ? formatDateTimeForDeviceData(value, timeZone) : '-'}
          </div>
        </div>
      ),
    },
    {
      align: AlignType.CENTER,
      key: 'learning_finish_datetime',
      name: 'End Time',
      render: (value, _, __, ___, timeZone) => (
        <div
          className={`agent--indicator ${
            !!value ? 'indicator--primary' : 'indicator--fail'
          } `}
        >
          <div>
            {value ? formatDateTimeForDeviceData(value, timeZone) : '-'}
          </div>
        </div>
      ),
    },
    {
      key: 'id',
      name: 'Console',
      align: AlignType.CENTER,
      render: (_, rowData: DeviceData) => (
        <button
          className="btn btn-sm btn-default icon bash agent-row--button-sm"
          title={'Open SSH Terminal'}
          onClick={e => {
            e.stopPropagation()
            onConsoleClick({
              isNewEditor: false,
              addr: rowData.device_ip,
              nodename: rowData.hostname,
              sshId: rowData.ssh_config.user_id,
              sshPw: rowData.ssh_config.password,
              port: `${rowData.ssh_config.port}`,
            })
          }}
        ></button>
      ),
    },
  ]

  if (!isUserUnauthorized) {
    columns.unshift({
      key: 'id',
      name: '',
      options: {checkbox: true},
    })
    columns.splice(columns.length - 1, 0, {
      key: 'is_collecting_cfg_written',
      name: 'Edit',
      align: AlignType.CENTER,
      render: (value, rowData: DeviceData) => {
        return (
          <button
            className={`btn btn-sm btn-default`}
            onClick={e => {
              e.stopPropagation()
              onEditClick(rowData)
            }}
            title={`${value ? '' : 'Not applied yet'}`}
          >
            {value ? (
              <div className={'pencil-confirm'} />
            ) : (
              <div className={'pencil-exclamation'} />
            )}
          </button>
        )
      },
    })
  }

  return columns
}
export const IMPORT_FILE_DEVICE_STATUS_COLUMNS: ColumnInfo[] = [
  {
    key: 'index',
    name: 'Index',
    options: {
      sorting: true,
      thead: {sort: SortType.DESC},
    },
    align: AlignType.CENTER,
  },
  {
    key: 'ip',
    name: 'IP',
    options: {
      sorting: true,
      isIP: true,
    },
    align: AlignType.CENTER,
  },
  {
    key: 'status',
    name: 'Status',
    options: {
      sorting: true,
    },
    align: AlignType.CENTER,
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
    align: AlignType.CENTER,
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

export const DEVICE_INFO_SELECTED_MONITORING: ColumnInfo[] = [
  {
    key: 'organization',
    name: 'Organization',
    align: AlignType.LEFT,
    options: {
      sorting: true,
    },
    render: item => {
      return (
        <div style={{textAlign: 'left'}}>
          <span>{item}</span>
        </div>
      )
    },
  },
  {
    key: 'device_ip',
    name: 'IP',
    align: AlignType.LEFT,
    options: {
      sorting: true,
      isIP: true,
    },
    render: item => {
      return (
        <div style={{textAlign: 'left'}}>
          <span>{item}</span>
        </div>
      )
    },
  },
  {
    key: 'hostname',
    name: 'Hostname',
    align: AlignType.LEFT,
    options: {
      sorting: true,
    },
    render: item => {
      return (
        <div style={{textAlign: 'left'}}>
          <span>{item}</span>
        </div>
      )
    },
  },
]

// export const deviceApplyMonitoringColumn = (
//   onLearningModelChange: (isCreateLearning: boolean, rowIndex: number) => void
// ): ColumnInfo[] => {
//   return [
//     {
//       key: 'organization',
//       name: 'Organization',
//       options: {
//         sorting: true,
//       },
//     },
//     {
//       key: 'device_ip',
//       name: 'IP',
//       options: {
//         sorting: true,
//       },
//       align: AlignType.RIGHT,
//     },
//     {
//       key: 'hostname',
//       name: 'Hostname',
//       options: {
//         sorting: true,
//       },
//     },
//     {
//       key: 'isMonitoring',
//       name: 'Monitoring Status',
//       options: {
//         sorting: true,
//       },
//       align: AlignType.CENTER,
//       render: value => (
//         <div
//           className={`table-dot ${
//             value ? 'dot-success' : 'dot-critical'
//           } flex-center`}
//         ></div>
//       ),
//     },
//     {
//       key: 'isCreateLearning',
//       name: 'Create Learning Model',
//       render: (value, _, __, index) => (
// <div
//   onClick={e => {
//     e.stopPropagation()
//     console.log('click')
//   }}
//   className="device-Management-toggle"
// >
//   <SlideToggle
//     color={ComponentColor.Success}
//     size={ComponentSize.Small}
//     active={value}
//     onChange={() => {
//       onLearningModelChange(value, index)
//     }}
//   />
// </div>
//       ),
//       align: AlignType.CENTER,
//     },
//   ]
// }

export const deviceApplyMonitoringColumn: ColumnInfo[] = [
  {
    key: 'organization',
    name: 'Organization',
    align: AlignType.LEFT,
    options: {
      sorting: true,
    },
    render: item => {
      return (
        <div style={{textAlign: 'left'}}>
          <span>{item}</span>
        </div>
      )
    },
  },
  {
    key: 'device_ip',
    name: 'IP',
    options: {
      sorting: true,
      isIP: true,
    },
    align: AlignType.LEFT,
    render: item => {
      return (
        <div style={{textAlign: 'left'}}>
          <span>{item}</span>
        </div>
      )
    },
  },
  {
    key: 'hostname',
    name: 'Hostname',
    align: AlignType.LEFT,
    options: {
      sorting: true,
    },
    render: item => {
      return (
        <div style={{textAlign: 'left'}}>
          <span>{item}</span>
        </div>
      )
    },
  },
  {
    key: 'isMonitoring',
    name: 'Monitoring Status',
    options: {
      sorting: true,
    },
    align: AlignType.CENTER,
    render: value => (
      <div
        className={`table-dot ${value ? 'dot-success' : ''} flex-center`}
      ></div>
    ),
  },
]

export const deviceconnectionColumn: ColumnInfo[] = [
  {
    key: 'organization',
    name: 'Organization',
    align: AlignType.CENTER,
    options: {
      sorting: true,
    },
  },
  {
    key: 'device_ip',
    name: 'IP',
    options: {
      sorting: true,
      isIP: true,
    },
    align: AlignType.CENTER,
  },
  {
    key: 'hostname',
    name: 'Hostname',
    align: AlignType.CENTER,
    options: {
      sorting: true,
    },
  },
  {
    key: 'device_type',
    name: 'Device Type',
    align: AlignType.CENTER,
    options: {
      sorting: true,
    },
  },
  {
    key: 'device_os',
    name: 'Device OS',
    align: AlignType.CENTER,
    options: {
      sorting: true,
    },
  },
]
