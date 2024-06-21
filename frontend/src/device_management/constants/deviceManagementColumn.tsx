import React from 'react'
import {AlignType, ColumnInfo, DeviceData, ShellInfo, SortType} from 'src/types'

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
      align: AlignType.RIGHT,
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
      key: 'isMonitoring',
      name: 'Monitoring',
      options: {
        sorting: true,
      },
      align: AlignType.CENTER,
      render: value => (
        <div
          className={`table-dot ${
            value ? 'dot-success' : 'dot-critical'
          } flex-center`}
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
            value ? 'indicator--primary' : 'indicator--fail'
          } flex-center`}
        >
          {value ? 'Enabled' : 'Disabled'}
        </div>
      ),
    },
    {
      key: 'learning_state',
      name: 'Learning State',
      align: AlignType.CENTER,
      render: value => <div> {value ? value : '-'}</div>,
    },
    {
      // TODO: Convert Date Time
      align: AlignType.CENTER,
      key: 'learning_update_date',
      name: 'Update Date',
      render: value => (
        <div
          className={`agent--indicator ${
            !!value ? 'indicator--primary' : 'indicator--fail'
          } `}
        >
          <div>{value ? value : '-'}</div>
        </div>
      ),
    },
    {
      // TODO: Convert Date Time
      align: AlignType.CENTER,
      key: 'learning_finish_datetime',
      name: 'Finish Date',
      render: value => (
        <div
          className={`agent--indicator ${
            !!value ? 'indicator--primary' : 'indicator--fail'
          } `}
        >
          <div>{value ? value : '-'}</div>
        </div>
      ),
    },
    {
      align: AlignType.CENTER,
      key: 'ml_function',
      name: 'Algorithm',
      render: value => <div> {value ? value : '-'}</div>,
    },
    {
      key: 'is_collecting_cfg_written',
      name: 'Edit',
      render: (value, rowData: DeviceData) => {
        return (
          <button
            className={`btn btn-sm btn-default`}
            onClick={e => {
              e.stopPropagation()
              onEditClick(rowData)
            }}
          >
            {value ? (
              <div className={'pencil-confirm'} />
            ) : (
              <div className={'pencil-exclamation'} />
            )}
          </button>
        )
      },
    },
    {
      key: 'id',
      name: 'Console',
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
    options: {
      sorting: true,
    },
  },
  {
    key: 'device_ip',
    name: 'IP',
    options: {
      sorting: true,
    },
  },
  {
    key: 'hostname',
    name: 'Hostname',
    options: {
      sorting: true,
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
    options: {
      sorting: true,
    },
  },
  {
    key: 'device_ip',
    name: 'IP',
    options: {
      sorting: true,
    },
    align: AlignType.RIGHT,
  },
  {
    key: 'hostname',
    name: 'Hostname',
    options: {
      sorting: true,
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
        className={`table-dot ${
          value ? 'dot-success' : 'dot-critical'
        } flex-center`}
      ></div>
    ),
  },
]
