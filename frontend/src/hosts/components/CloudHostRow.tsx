import {isNull} from 'lodash'
import React, {FunctionComponent} from 'react'
import {Link} from 'react-router'

import {CLOUD_HOSTS_TABLE_SIZING} from 'src/hosts/constants/tableSizing'
import {CloudHost} from 'src/types'

import {HostsPage} from 'src/hosts/containers/HostsPage'

import {usageIndacator} from 'src/agent_admin/reusable'
import {fixedDecimalPercentage} from 'src/shared/utils/decimalPlaces'

interface Props {
  sourceID: string
  host: CloudHost
  focusedHost: string
  onClickTableRow: HostsPage['handleClickTableRow']
}

const CloudHostRow: FunctionComponent<Props> = ({
  host,
  sourceID,
  focusedHost,
  onClickTableRow,
}) => {
  const {
    instanceId,
    instanceType,
    alarmStatus,
    instanceState,
    instanceStatusCheck,
    name,
    cpu,
    load,
    disk,
    memory,
    apps = [],
  } = host

  const {
    CloudNameWidth,
    CloudInstanceIDWidth,
    CloudInstanceStateWidth,
    CloudInstanceTypeWidth,
    CloudStatusCheckWidth,
    CloudAlarmStatusWidth,
    CloudAppsWidth,
    CloudCPUWidth,
    CloudMemoryWidth,
    CloudDiskWidth,
  } = CLOUD_HOSTS_TABLE_SIZING

  const cpuValue = isNaN(cpu) || isNull(cpu) ? 'N/A' : `${cpu.toFixed(2)}%`
  const memoryValue =
    isNaN(memory) || isNull(memory) ? 'N/A' : `${memory.toFixed(2)}`
  const diskValue = isNaN(disk) || isNull(disk) ? 'N/A' : `${disk.toFixed(2)}`

  // const dotClassName = classnames(,
  //   'table-dot',
  //   Math.max(host.deltaUptime || 0, host.winDeltaUptime || 0) > 0
  //     ? 'dot-success'
  //     : 'dot-critical'
  // )

  const focusedClasses = (): string => {
    if (instanceId === focusedHost) return 'hosts-table--tr focused'
    return 'hosts-table--tr'
  }

  return (
    <div className={focusedClasses()} onClick={onClickTableRow(instanceId)}>
      <div className="hosts-table--td" style={{width: CloudNameWidth}}>
        {name}
      </div>
      <div className="hosts-table--td" style={{width: CloudInstanceIDWidth}}>
        <Link to={`/sources/${sourceID}/infrastructure/${instanceId}`}>
          {instanceId}
        </Link>
        {/* <div className={dotClassName} /> */}
      </div>
      <div
        style={{width: CloudInstanceStateWidth}}
        className="monotype hosts-table--td"
      >
        {instanceState}
      </div>
      <div
        style={{width: CloudInstanceTypeWidth}}
        className="monotype hosts-table--td"
      >
        {instanceType}
      </div>
      <div
        style={{width: CloudStatusCheckWidth}}
        className="monotype hosts-table--td"
      >
        {instanceStatusCheck}
      </div>
      <div
        style={{width: CloudAlarmStatusWidth}}
        className="monotype hosts-table--td"
      >
        {alarmStatus}
      </div>
      <div
        style={{width: CloudAppsWidth}}
        className="hosts-table--td list-type"
      >
        {apps.map((app, index) => {
          return (
            <span key={app}>
              <Link
                style={{marginLeft: '2px'}}
                to={{
                  pathname: `/sources/${sourceID}/infrastructure/${instanceId}`,
                  query: {app},
                }}
              >
                {app}
              </Link>
              {index === apps.length - 1 ? null : ', '}
            </span>
          )
        })}
      </div>
      <div style={{width: CloudCPUWidth}} className="monotype hosts-table--td">
        {(cpuValue === 'N/A' && cpuValue) ||
          usageIndacator({
            value: fixedDecimalPercentage(parseFloat(cpuValue), 2),
          })}
      </div>
      <div
        style={{width: CloudMemoryWidth}}
        className="monotype hosts-table--td"
      >
        {(memoryValue === 'N/A' && memoryValue) ||
          usageIndacator({
            value: fixedDecimalPercentage(parseFloat(memoryValue), 2),
          })}
      </div>
      <div style={{width: CloudDiskWidth}} className="monotype hosts-table--td">
        {(diskValue === 'N/A' && diskValue) ||
          usageIndacator({
            value: fixedDecimalPercentage(parseFloat(diskValue), 2),
          })}
      </div>
    </div>
  )
}

export default CloudHostRow
